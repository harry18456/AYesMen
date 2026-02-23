"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const child_process_1 = require("child_process");
// ─── Constants ───────────────────────────────────────────────────────────────
const QUOTA_POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const AUTO_ACCEPT_INTERVAL_MS = 500;
// ─── Quota State ─────────────────────────────────────────────────────────────
let quotaStatusBar;
let quotaPollTimer;
let latestQuota = [];
let latestCredits;
let cachedServerInfo;
// ─── Auto-Accept State ────────────────────────────────────────────────────────
let autoAcceptEnabled = true;
let autoAcceptStatusBar;
let autoAcceptTimer;
// ─── Activate ────────────────────────────────────────────────────────────────
function activate(context) {
    console.log("[AYesMan] Extension Activated.");
    // ── Auto-Accept Status Bar ──
    autoAcceptStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 201);
    autoAcceptStatusBar.command = "ayesman.toggleAutoAccept";
    context.subscriptions.push(autoAcceptStatusBar);
    updateAutoAcceptStatusBar();
    autoAcceptStatusBar.show();
    // ── Auto-Accept Toggle Command ──
    context.subscriptions.push(vscode.commands.registerCommand("ayesman.toggleAutoAccept", () => {
        autoAcceptEnabled = !autoAcceptEnabled;
        updateAutoAcceptStatusBar();
        vscode.window.showInformationMessage(autoAcceptEnabled
            ? "[AYesMan] Auto-Accept: ON ✅"
            : "[AYesMan] Auto-Accept: OFF 🛑");
    }));
    // ── Start Auto-Accept Loop ──
    startAutoAcceptLoop();
    context.subscriptions.push({
        dispose: () => {
            if (autoAcceptTimer)
                clearInterval(autoAcceptTimer);
        },
    });
    // ── Quota Status Bar ──
    quotaStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200);
    quotaStatusBar.text = "$(loading~spin) Quota: Loading...";
    quotaStatusBar.tooltip = "AYesMan - Loading quota data...";
    quotaStatusBar.command = "ayesman.refreshQuota";
    quotaStatusBar.show();
    context.subscriptions.push(quotaStatusBar);
    // ── Quota Refresh Command ──
    context.subscriptions.push(vscode.commands.registerCommand("ayesman.refreshQuota", () => fetchQuota(true)));
    // ── Diagnose Command ──
    context.subscriptions.push(vscode.commands.registerCommand("ayesman.diagnose", async () => {
        const server = cachedServerInfo;
        if (!server) {
            vscode.window.showWarningMessage("[AYesMan] No server cached yet. Wait 10s after reload.");
            return;
        }
        try {
            // 1) GetUserTrajectoryDescriptions - log full response including trajectoryScope
            const descs = await callGrpc(server, "GetUserTrajectoryDescriptions", {});
            const current = (descs?.trajectories ?? []).find((t) => t.current);
            console.log("[AYesMan] diagnose GetUserTrajectoryDescriptions:", JSON.stringify(descs).substring(0, 2000));
            // 2) GetAllCascadeTrajectories - map keys are likely cascadeIds
            const allTrajs = await callGrpc(server, "GetAllCascadeTrajectories", {});
            const summaries = allTrajs?.trajectorySummaries ?? {};
            const cascadeIds = Object.keys(summaries);
            console.log("[AYesMan] diagnose GetAllCascadeTrajectories cascadeIds:", cascadeIds.join(","));
            if (cascadeIds.length > 0) {
                // Log the value structure of the first summary to understand what fields it has
                const firstSummary = summaries[cascadeIds[0]];
                console.log("[AYesMan] diagnose summary[0] keys:", Object.keys(firstSummary ?? {}).join(","));
                console.log("[AYesMan] diagnose summary[0]:", JSON.stringify(firstSummary).substring(0, 500));
            }
            // 3) GetCascadeTrajectorySteps for the last cascadeId
            if (cascadeIds.length > 0) {
                const lastCascadeId = cascadeIds[cascadeIds.length - 1];
                try {
                    const stepsResult = await callGrpc(server, "GetCascadeTrajectorySteps", {
                        cascadeId: lastCascadeId,
                        stepOffset: 0,
                    });
                    const steps = stepsResult?.steps ?? [];
                    console.log(`[AYesMan] diagnose GetCascadeTrajectorySteps cascadeId=${lastCascadeId} steps=${steps.length}`);
                    if (steps.length > 0) {
                        const lastStep = steps[steps.length - 1];
                        console.log("[AYesMan] diagnose lastStep keys:", Object.keys(lastStep ?? {}).join(","));
                        console.log("[AYesMan] diagnose lastStep:", JSON.stringify(lastStep).substring(0, 500));
                    }
                }
                catch (e) {
                    console.log(`[AYesMan] diagnose GetCascadeTrajectorySteps error: ${e.message}`);
                }
            }
            vscode.window.showInformationMessage(`[AYesMan] diagnose: ${descs?.trajectories?.length ?? 0} trajectories, current=${current?.trajectoryId?.substring(0, 8) ?? "none"}, ${cascadeIds.length} cascades. Check console.`);
        }
        catch (err) {
            console.log(`[AYesMan] diagnose error: ${err.message}`);
            vscode.window.showErrorMessage(`[AYesMan] diagnose error: ${err.message}`);
        }
    }));
    // ── Start Quota Polling ──
    setTimeout(() => fetchQuota(), 5000);
    quotaPollTimer = setInterval(() => fetchQuota(), QUOTA_POLL_INTERVAL_MS);
    context.subscriptions.push({
        dispose: () => {
            if (quotaPollTimer)
                clearInterval(quotaPollTimer);
        },
    });
    console.log("[AYesMan] Ready. Auto-Accept: ON, Quota Dashboard: polling.");
}
// ─── Auto-Accept Logic ────────────────────────────────────────────────────────
function updateAutoAcceptStatusBar() {
    if (!autoAcceptStatusBar)
        return;
    if (autoAcceptEnabled) {
        autoAcceptStatusBar.text = "✅ Auto-Accept: ON";
        autoAcceptStatusBar.tooltip =
            "AYesMan Auto-Accept is active (click to pause)";
        autoAcceptStatusBar.backgroundColor = undefined;
    }
    else {
        autoAcceptStatusBar.text = "🛑 Auto-Accept: OFF";
        autoAcceptStatusBar.tooltip =
            "AYesMan Auto-Accept is paused (click to resume)";
        autoAcceptStatusBar.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    }
}
// Try to accept the current pending step via direct gRPC call.
// This bypasses the VS Code command registry (which does NOT have
// antigravity.agent.acceptAgentStep etc.) and calls HandleCascadeUserInteraction
// directly on the language server, the same way the workbench React code does it.
async function tryAutoAcceptStep(server) {
    // Step 1: Get current trajectory ID
    const descs = await callGrpc(server, "GetUserTrajectoryDescriptions", {});
    const currentDesc = descs?.trajectories?.find((t) => t.current);
    if (!currentDesc?.trajectoryId)
        return;
    const trajectoryId = currentDesc.trajectoryId;
    // Step 2: Get full trajectory (includes cascadeId + steps)
    const result = await callGrpc(server, "GetUserTrajectory", { trajectoryId });
    // Response may be { trajectory: {...} } or the trajectory object directly
    const traj = result?.trajectory ?? result;
    const cascadeId = traj?.cascadeId;
    const steps = traj?.steps ?? [];
    if (!cascadeId || steps.length === 0) {
        console.log(`[AYesMan] debug: trajectoryId=${trajectoryId} cascadeId=${cascadeId} steps=${steps.length} resultKeys=${Object.keys(result ?? {}).join(",")}`);
        return;
    }
    // Step 3: Check the last step — if it's a runCommand awaiting confirmation, accept it.
    // The workbench React code ($Sd function) reads the same trajectory state and calls
    // HandleCascadeUserInteraction when the user presses Alt+Enter.
    const lastIdx = steps.length - 1;
    const lastStep = steps[lastIdx];
    const runCmd = lastStep?.runCommand;
    if (!runCmd) {
        // Log the last step type for debugging
        const stepKeys = Object.keys(lastStep ?? {}).join(",");
        console.log(`[AYesMan] debug: last step keys=${stepKeys}`);
        return;
    }
    const proposedCommandLine = runCmd.proposedCommandLine ?? runCmd.commandLine ?? "";
    // Call HandleCascadeUserInteraction — if the step is already processed the
    // server will reject it (we catch that silently). If pending, it gets accepted.
    await callGrpc(server, "HandleCascadeUserInteraction", {
        cascadeId,
        interaction: {
            trajectoryId,
            stepIndex: lastIdx,
            runCommand: {
                confirm: true,
                proposedCommandLine,
                submittedCommandLine: proposedCommandLine,
            },
        },
    });
    console.log(`[AYesMan] Auto-accepted step ${lastIdx}: ${proposedCommandLine.substring(0, 80)}`);
}
let lastAutoAcceptError = "";
function startAutoAcceptLoop() {
    autoAcceptTimer = setInterval(async () => {
        if (!autoAcceptEnabled)
            return;
        // IMPORTANT: Use cached server info directly — never call discoverServer() here.
        // discoverServer() uses execSync (blocking PowerShell) which freezes the Extension
        // Host thread and causes "unresponsive" errors. Server discovery happens in
        // fetchQuota() which runs every 2 minutes and properly caches the result.
        if (!cachedServerInfo)
            return;
        try {
            await tryAutoAcceptStep(cachedServerInfo);
        }
        catch (err) {
            // Log errors (deduplicated to avoid spam)
            const msg = err?.message ?? String(err);
            if (msg !== lastAutoAcceptError) {
                console.log(`[AYesMan] auto-accept error: ${msg}`);
                lastAutoAcceptError = msg;
            }
        }
    }, AUTO_ACCEPT_INTERVAL_MS);
}
// ─── Language Server Discovery ───────────────────────────────────────────────
async function discoverServer() {
    if (cachedServerInfo)
        return cachedServerInfo;
    try {
        // Step 1: Extract CSRF token and PID from language server process args
        const cmdlineOutput = (0, child_process_1.execSync)('powershell -Command "Get-CimInstance Win32_Process -Filter \\"name = \'language_server_windows_x64.exe\'\\" | Select-Object -First 1 | ForEach-Object { Write-Host $_.ProcessId; Write-Host $_.CommandLine }"', { encoding: "utf-8", timeout: 10000 }).trim();
        const lines = cmdlineOutput.split("\n").map((l) => l.trim());
        const pid = parseInt(lines[0], 10);
        const cmdline = lines.slice(1).join(" ");
        const csrfMatch = cmdline.match(/--csrf_token\s+(\S+)/);
        if (!csrfMatch || !pid) {
            console.error("[AYesMan] Could not extract CSRF/PID from language server");
            return undefined;
        }
        const csrfToken = csrfMatch[1];
        // Step 2: Get listening ports for the process
        const portsOutput = (0, child_process_1.execSync)(`powershell -Command "Get-NetTCPConnection -OwningProcess ${pid} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort"`, { encoding: "utf-8", timeout: 10000 }).trim();
        const ports = portsOutput
            .split(/\s+/)
            .map((p) => parseInt(p, 10))
            .filter((p) => !isNaN(p));
        if (ports.length === 0) {
            console.error("[AYesMan] No listening ports found for language server");
            return undefined;
        }
        console.log(`[AYesMan] LS PID=${pid}, CSRF=${csrfToken.substring(0, 8)}..., ports=${ports.join(",")}`);
        // Step 3: Probe ports to find the gRPC API (try HTTPS first, then HTTP)
        for (const port of ports) {
            for (const useHttps of [true, false]) {
                const ok = await probePort(port, csrfToken, useHttps);
                if (ok) {
                    cachedServerInfo = { port, csrfToken, useHttps };
                    console.log(`[AYesMan] Found gRPC at ${useHttps ? "https" : "http"}://127.0.0.1:${port}`);
                    return cachedServerInfo;
                }
            }
        }
        console.error("[AYesMan] Could not find working gRPC port");
        return undefined;
    }
    catch (err) {
        console.error("[AYesMan] Server discovery failed:", err.message);
        return undefined;
    }
}
function probePort(port, csrfToken, useHttps) {
    return new Promise((resolve) => {
        const options = {
            hostname: "127.0.0.1",
            port,
            path: "/exa.language_server_pb.LanguageServerService/Heartbeat",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-codeium-csrf-token": csrfToken,
                "Connect-Protocol-Version": "1",
            },
            timeout: 2000,
            rejectUnauthorized: false,
        };
        const makeReq = useHttps ? https.request : http.request;
        const req = makeReq(options, (res) => {
            res.on("data", () => { }); // drain
            res.on("end", () => resolve(res.statusCode === 200));
        });
        req.on("error", () => resolve(false));
        req.on("timeout", () => {
            req.destroy();
            resolve(false);
        });
        req.write("{}");
        req.end();
    });
}
// ─── gRPC Call ───────────────────────────────────────────────────────────────
function callGrpc(server, method, body = {}) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: "127.0.0.1",
            port: server.port,
            path: `/exa.language_server_pb.LanguageServerService/${method}`,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-codeium-csrf-token": server.csrfToken,
                "Connect-Protocol-Version": "1",
                "Content-Length": Buffer.byteLength(data),
            },
            timeout: 10000,
            ...(server.useHttps ? { rejectUnauthorized: false } : {}),
        };
        const makeReq = server.useHttps ? https.request : http.request;
        const req = makeReq(options, (res) => {
            let responseBody = "";
            res.on("data", (chunk) => (responseBody += chunk.toString()));
            res.on("end", () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(responseBody));
                    }
                    catch {
                        resolve(responseBody);
                    }
                }
                else {
                    reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
                }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Timeout"));
        });
        req.write(data);
        req.end();
    });
}
// ─── Fetch Quota ─────────────────────────────────────────────────────────────
async function fetchQuota(showNotification = false) {
    try {
        const server = await discoverServer();
        if (!server) {
            quotaStatusBar.text = "$(warning) Quota: No Server";
            quotaStatusBar.tooltip =
                "Could not connect to Antigravity language server";
            if (showNotification) {
                vscode.window.showWarningMessage("[AYesMan] Cannot find Antigravity language server.");
            }
            return;
        }
        const userStatus = await callGrpc(server, "GetUserStatus");
        // Extract credits
        const planStatus = userStatus?.userStatus?.planStatus;
        if (planStatus) {
            latestCredits = {
                availablePromptCredits: planStatus.availablePromptCredits || 0,
                availableFlowCredits: planStatus.availableFlowCredits || 0,
                monthlyPromptCredits: planStatus.planInfo?.monthlyPromptCredits || 0,
                monthlyFlowCredits: planStatus.planInfo?.monthlyFlowCredits || 0,
                planName: planStatus.planInfo?.planName || "Unknown",
            };
            updateQuotaStatusBar();
        }
        // Extract model quota from cascade configs
        const cascadeConfigs = userStatus?.userStatus?.cascadeModelConfigData?.clientModelConfigs;
        if (cascadeConfigs && Array.isArray(cascadeConfigs)) {
            latestQuota = cascadeConfigs
                .filter((c) => c.quotaInfo)
                .map((c) => ({
                label: c.label || "Unknown",
                modelId: c.modelOrAlias?.model || "",
                remainingFraction: c.quotaInfo?.remainingFraction ?? 1,
                resetTime: c.quotaInfo?.resetTime,
            }));
            updateQuotaStatusBar();
        }
        // Also get command model configs for completion quota
        const cmdConfigs = await callGrpc(server, "GetCommandModelConfigs");
        if (cmdConfigs?.clientModelConfigs) {
            for (const c of cmdConfigs.clientModelConfigs) {
                if (c.quotaInfo &&
                    !latestQuota.find((q) => q.modelId === c.modelOrAlias?.model)) {
                    latestQuota.push({
                        label: `${c.label} (Autocomplete)`,
                        modelId: c.modelOrAlias?.model || "",
                        remainingFraction: c.quotaInfo.remainingFraction ?? 1,
                        resetTime: c.quotaInfo.resetTime,
                    });
                }
            }
            updateQuotaStatusBar();
        }
        if (showNotification) {
            vscode.window.showInformationMessage(`[AYesMan] Quota refreshed: ${latestQuota.length} models loaded.`);
        }
        console.log(`[AYesMan] Quota refreshed: ${latestQuota.length} models, credits: P=${latestCredits?.availablePromptCredits} F=${latestCredits?.availableFlowCredits}`);
    }
    catch (err) {
        console.error("[AYesMan] Quota fetch error:", err.message);
        cachedServerInfo = undefined;
        quotaStatusBar.text = "$(error) Quota: Error";
        quotaStatusBar.tooltip = `Error: ${err.message}`;
    }
}
// ─── Quota Status Bar Updates ─────────────────────────────────────────────────
function updateQuotaStatusBar() {
    if (latestQuota.length === 0) {
        quotaStatusBar.text = "$(pulse) Quota: No Data";
        return;
    }
    const sorted = [...latestQuota].sort((a, b) => a.label.localeCompare(b.label));
    const lowest = [...latestQuota].reduce((min, q) => q.remainingFraction < min.remainingFraction ? q : min, latestQuota[0]);
    const pct = Math.round(lowest.remainingFraction * 100);
    const icon = pct >= 80 ? "$(check)" : pct >= 40 ? "$(warning)" : "$(error)";
    const shortName = lowest.label.length > 18
        ? lowest.label.substring(0, 15) + "..."
        : lowest.label;
    quotaStatusBar.text = `${icon} ${shortName}: ${pct}%`;
    const modelLines = sorted.map((q) => {
        const p = Math.round(q.remainingFraction * 100);
        const dot = p >= 80 ? "🟢" : p >= 40 ? "🟡" : "🔴";
        const resetStr = q.resetTime ? ` _(${formatResetTime(q.resetTime)})_` : "";
        return `${dot} **${q.label}** — ${p}%${resetStr}`;
    });
    let tooltipMd = `### AYesMan Quota\n\n${modelLines.join("  \n")}`;
    if (latestCredits) {
        const { availablePromptCredits, monthlyPromptCredits, availableFlowCredits, monthlyFlowCredits, planName, } = latestCredits;
        tooltipMd += `\n\n---\n\n`;
        tooltipMd += `**${planName} Plan**\n\n`;
        tooltipMd += `💬 **Prompt** (autocomplete & chat): ${availablePromptCredits.toLocaleString()} / ${monthlyPromptCredits.toLocaleString()}\n\n`;
        tooltipMd += `🔄 **Flow** (agent workflows): ${availableFlowCredits.toLocaleString()} / ${monthlyFlowCredits.toLocaleString()}`;
    }
    tooltipMd += `\n\n_Click to refresh_`;
    const md = new vscode.MarkdownString(tooltipMd);
    md.isTrusted = true;
    quotaStatusBar.tooltip = md;
    quotaStatusBar.backgroundColor =
        pct < 20
            ? new vscode.ThemeColor("statusBarItem.errorBackground")
            : pct < 40
                ? new vscode.ThemeColor("statusBarItem.warningBackground")
                : undefined;
}
function formatResetTime(isoStr) {
    try {
        const reset = new Date(isoStr);
        const now = new Date();
        const diffMs = reset.getTime() - now.getTime();
        if (diffMs < 0)
            return "resets now";
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        if (hrs > 0)
            return `resets in ${hrs}h ${mins}m`;
        return `resets in ${mins}m`;
    }
    catch {
        return isoStr;
    }
}
// ─── Deactivate ──────────────────────────────────────────────────────────────
function deactivate() {
    if (autoAcceptTimer)
        clearInterval(autoAcceptTimer);
    if (quotaPollTimer)
        clearInterval(quotaPollTimer);
}
//# sourceMappingURL=extension.js.map