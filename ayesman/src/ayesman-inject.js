/**
 * AYesMan Content Script
 * 
 * Injected into the Antigravity Webview to:
 * 1. Auto-click terminal execution confirmations.
 * 2. Intercept the `/GetCommandModelConfigs` gRPC calls to extract Model Quota.
 */

(function () {
    if (window.__ayesman_injected) return;
    window.__ayesman_injected = true;
    
    console.log("[AYesMan] Content script injected successfully into Webview.");

    // Utility to post messages back to AYesMan Extension Host via HTTP
    function sendToExtension(type, payload) {
        // Send to a fixed local port run by AYesMan backend
        const AYESMAN_PORT = window.__AYESMAN_PORT__ || 45642;
        fetch(`http://127.0.0.1:${AYESMAN_PORT}/ayesman-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, payload })
        }).catch(e => console.error('[AYesMan] Warning: Failed to reach backend on port ' + AYESMAN_PORT));
    }

    // ==========================================
    // Feature 1: Auto-Accept Clicker (DOM Observer)
    // ==========================================
    let isClicking = false;

    const observer = new MutationObserver((mutations) => {
        if (isClicking) return;

        // Try to find typical Accept or Run buttons in the DOM.
        // Known Antigravity prompts: "Run command", "Accept", "Apply"
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const targetBtn = buttons.find(btn => {
            const text = btn.textContent?.toLowerCase() || '';
            // Match specific confirmation phrasing
            return text.includes('run command') || 
                   (text === 'accept') || 
                   (text === 'run') ||
                   (text === 'apply changes');
        });

        if (targetBtn) {
            console.log("[AYesMan] Detected confirmation button:", targetBtn.textContent);
            isClicking = true;
            // Short delay to mimic human reaction and allow React states to settle
            setTimeout(() => {
                targetBtn.click();
                console.log("[AYesMan] Auto-clicked button!");
                // Wait before allowing another click to prevent loops
                setTimeout(() => { isClicking = false; }, 1000);
            }, 150);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });


    // ==========================================
    // Feature 2: Quota Extractor (RPC Interceptor)
    // ==========================================
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        const url = args[0] instanceof Request ? args[0].url : args[0];
        
        // Let the request proceed normally
        const response = await originalFetch.apply(this, args);

        try {
            // Check if this is the target gRPC endpoint
            if (typeof url === 'string' && url.includes('/GetCommandModelConfigs')) {
                // Clone the response so the original caller can still consume it
                const clone = response.clone();
                const json = await clone.json();

                // Example Payload structure based on HAR analysis:
                // { modelConfigs: [ { isRecommended: true, label: "Gemini", quotaInfo: { remainingFraction: 1 } } ] }
                if (json && Array.isArray(json.modelConfigs)) {
                    // Usually the first recommended model is the active one
                    const activeModel = json.modelConfigs.find(m => m.isRecommended) || json.modelConfigs[0];
                    if (activeModel && activeModel.quotaInfo) {
                        const remaining = activeModel.quotaInfo.remainingFraction;
                        const label = activeModel.label;
                        
                        console.log(`[AYesMan] Intercepted Quota - Model: ${label}, Remaining: ${remaining}`);
                        
                        // Send data to the VS Code extension host
                        sendToExtension('quotaUpdate', { model: label, remainingFraction: remaining });
                    }
                }
            }
        } catch (err) {
            console.error("[AYesMan] Error intercepting fetch response:", err);
        }

        return response;
    };

    // The antigravity UI probably uses fetch, but if it uses XHR we patch it too.
    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
            if (this.responseURL && this.responseURL.includes('/GetCommandModelConfigs')) {
                try {
                    const json = JSON.parse(this.responseText);
                    // Similar logic: (Omitted for brevity, fetch is primary) 
                    if (json && Array.isArray(json.modelConfigs)) {
                        const activeModel = json.modelConfigs.find(m => m.isRecommended) || json.modelConfigs[0];
                        if (activeModel && activeModel.quotaInfo) {
                            sendToExtension('quotaUpdate', { 
                                model: activeModel.label, 
                                remainingFraction: activeModel.quotaInfo.remainingFraction 
                            });
                        }
                    }
                } catch(e) {}
            }
        });
        originalXHRSend.apply(this, arguments);
    };

})();
