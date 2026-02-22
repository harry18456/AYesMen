import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

// Constants
const AYESMAN_PORT = 45642;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('[AYesMan] Extension Activated.');

    // 1. Create Status Bar Item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(zap) AYesMan: Wait...';
    statusBarItem.tooltip = 'Model Quota - Initializing';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // 2. Start Local HTTP Server to receive messages from Webview
    const server = http.createServer((req, res) => {
        // Simple CORS to allow the webview iframe strictly to talk to this server
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (req.method === 'POST' && req.url === '/ayesman-event') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => {
                res.writeHead(200);
                res.end(JSON.stringify({ status: 'ok' }));

                try {
                    const data = JSON.parse(body);
                    if (data.type === 'quotaUpdate') {
                        const remaining = data.payload.remainingFraction;
                        const model = data.payload.model;
                        
                        // Update UI
                        const percentage = Math.round(remaining * 100);
                        statusBarItem.text = `$(color-mode) ${model}: ${percentage}%`;
                        if (percentage < 20) {
                            statusBarItem.color = new vscode.ThemeColor('errorForeground');
                        } else {
                            statusBarItem.color = undefined;
                        }
                    }
                } catch (e) {
                    console.error('[AYesMan] Error parsing incoming body', e);
                }
            });
            return;
        }

        res.writeHead(404);
        res.end();
    });

    server.listen(AYESMAN_PORT, '127.0.0.1', () => {
        console.log(`[AYesMan] HTTP Server listening on port ${AYESMAN_PORT}`);
    });
    // Ensure the server closes on deactivation
    context.subscriptions.push({ dispose: () => server.close() });

    // 3. Patch the Antigravity (Codeium) Extension Webview
    patchCodeiumWebview(context);
    
    // Command to manually re-patch or check
    let disposable = vscode.commands.registerCommand('ayesman.patchIt', () => {
        patchCodeiumWebview(context, true);
    });
    context.subscriptions.push(disposable);
}

function patchCodeiumWebview(context: vscode.ExtensionContext, forcePrompt = false) {
    const codeiumExt = vscode.extensions.getExtension('google.antigravity') || vscode.extensions.getExtension('codeium.codeium');
    if (!codeiumExt) {
        if (forcePrompt) vscode.window.showErrorMessage('[AYesMan] Antigravity/Codeium extension not found.');
        return;
    }

    // Try finding the primary dist/webview file or similar path where they host the js
    // Typically: ~/.vscode/extensions/codeium.codeium-*/dist/extension.js or comparable.
    // However, Webview code is often inside something like dist/webview/index.js.
    const extPath = codeiumExt.extensionPath;
    
    // We search simple hardcoded common paths
    const possiblePaths = [
        path.join(extPath, 'out', 'media', 'chat.js'), // Antigravity IDE path
        path.join(extPath, 'dist', 'webview', 'index.js'),
        path.join(extPath, 'dist', 'chat', 'index.js'),
        path.join(extPath, 'dist', 'panel', 'index.js')
    ];

    let targetFile = '';
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            targetFile = p;
            break;
        }
    }

    if (!targetFile) {
        // Fallback: search recursively in extPath but limit depth (too intensive for UI thread in practice, keeping simple)
        if (forcePrompt) vscode.window.showErrorMessage('[AYesMan] Could not find Codeium webview JS file.');
        return;
    }

    try {
        const content = fs.readFileSync(targetFile, 'utf8');
        if (content.includes('__ayesman_injected')) {
            if (forcePrompt) vscode.window.showInformationMessage('[AYesMan] Patch already applied!');
            return;
        }

        // Read our inject script
        const injectScriptPath = path.join(context.extensionPath, 'src', 'ayesman-inject.js');
        if (!fs.existsSync(injectScriptPath)) {
             console.error('[AYesMan] inject script not found at', injectScriptPath);
             return;
        }
        
        let scriptContent = fs.readFileSync(injectScriptPath, 'utf8');
        
        // Safety wrapper to avoid breaking webview with "const AYESMAN" syntax collisions
        const appendedContent = content + `\n\n// AYESMAN INJECTION START\ntry {\n${scriptContent}\n} catch(e) { console.error('AYesMan inject failed', e); }\n// AYESMAN INJECTION END\n`;
        
        fs.writeFileSync(targetFile, appendedContent, 'utf8');
        vscode.window.showInformationMessage('[AYesMan] Successfully patched Codeium webview! Please "Developer: Reload Window" to apply.', 'Reload Window').then(res => {
            if (res === 'Reload Window') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        });
        
    } catch (e: any) {
        console.error('[AYesMan] Failed to patch Webview JS:', e);
        if (forcePrompt) vscode.window.showErrorMessage('[AYesMan] Failed to patch file: ' + e.message);
    }
}

export function deactivate() {}
