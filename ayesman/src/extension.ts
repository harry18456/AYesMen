import * as vscode from "vscode";
import * as https from "https";
import * as http from "http";
import { execSync } from "child_process";

// ─── Types ───────────────────────────────────────────────────────────────────
interface QuotaEntry {
  label: string;
  modelId: string;
  remainingFraction: number;
  resetTime?: string;
}

interface CreditsInfo {
  availablePromptCredits: number;
  availableFlowCredits: number;
  monthlyPromptCredits: number;
  monthlyFlowCredits: number;
  planName: string;
}

interface ServerInfo {
  port: number;
  csrfToken: string;
  useHttps: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const QUOTA_POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const AUTO_ACCEPT_INTERVAL_MS = 500;

// ─── Quota State ─────────────────────────────────────────────────────────────
let quotaStatusBar: vscode.StatusBarItem;
let quotaPollTimer: ReturnType<typeof setInterval> | undefined;
let latestQuota: QuotaEntry[] = [];
let latestCredits: CreditsInfo | undefined;
let cachedServerInfo: ServerInfo | undefined;

// ─── Auto-Accept State ────────────────────────────────────────────────────────
let autoAcceptEnabled = true;
let autoAcceptStatusBar: vscode.StatusBarItem;
let autoAcceptTimer: ReturnType<typeof setInterval> | undefined;

// ─── Activate ────────────────────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext) {
  console.log("[AYesMan] Extension Activated.");

  // ── Auto-Accept Status Bar ──
  autoAcceptStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    201,
  );
  autoAcceptStatusBar.command = "ayesman.toggleAutoAccept";
  context.subscriptions.push(autoAcceptStatusBar);
  updateAutoAcceptStatusBar();
  autoAcceptStatusBar.show();

  // ── Auto-Accept Toggle Command ──
  context.subscriptions.push(
    vscode.commands.registerCommand("ayesman.toggleAutoAccept", () => {
      autoAcceptEnabled = !autoAcceptEnabled;
      updateAutoAcceptStatusBar();
      vscode.window.showInformationMessage(
        autoAcceptEnabled
          ? "[AYesMan] Auto-Accept: ON ✅"
          : "[AYesMan] Auto-Accept: OFF 🛑",
      );
    }),
  );

  // ── Start Auto-Accept Loop ──
  startAutoAcceptLoop();
  context.subscriptions.push({
    dispose: () => {
      if (autoAcceptTimer) clearInterval(autoAcceptTimer);
    },
  });

  // ── Quota Status Bar ──
  quotaStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    200,
  );
  quotaStatusBar.text = "$(loading~spin) Quota: Loading...";
  quotaStatusBar.tooltip = "AYesMan - Loading quota data...";
  quotaStatusBar.command = "ayesman.refreshQuota";
  quotaStatusBar.show();
  context.subscriptions.push(quotaStatusBar);

  // ── Quota Refresh Command ──
  context.subscriptions.push(
    vscode.commands.registerCommand("ayesman.refreshQuota", () =>
      fetchQuota(true),
    ),
  );

  // ── Diagnose Command ──
  context.subscriptions.push(
    vscode.commands.registerCommand("ayesman.diagnose", async () => {
      const server = cachedServerInfo;
      if (!server) {
        vscode.window.showWarningMessage("[AYesMan] No server cached yet. Wait 10s after reload.");
        return;
      }
      try {
        // 1) GetUserTrajectoryDescriptions - log full response including trajectoryScope
        const descs = await callGrpc(server, "GetUserTrajectoryDescriptions", {});
        const current = (descs?.trajectories ?? []).find((t: any) => t.current);
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
            const steps: any[] = stepsResult?.steps ?? [];
            console.log(`[AYesMan] diagnose GetCascadeTrajectorySteps cascadeId=${lastCascadeId} steps=${steps.length}`);
            if (steps.length > 0) {
              const lastStep = steps[steps.length - 1];
              console.log("[AYesMan] diagnose lastStep keys:", Object.keys(lastStep ?? {}).join(","));
              console.log("[AYesMan] diagnose lastStep:", JSON.stringify(lastStep).substring(0, 500));
            }
          } catch (e: any) {
            console.log(`[AYesMan] diagnose GetCascadeTrajectorySteps error: ${e.message}`);
          }
        }

        vscode.window.showInformationMessage(
          `[AYesMan] diagnose: ${descs?.trajectories?.length ?? 0} trajectories, current=${current?.trajectoryId?.substring(0,8) ?? "none"}, ${cascadeIds.length} cascades. Check console.`,
        );
      } catch (err: any) {
        console.log(`[AYesMan] diagnose error: ${err.message}`);
        vscode.window.showErrorMessage(`[AYesMan] diagnose error: ${err.message}`);
      }
    }),
  );

  // ── Start Quota Polling ──
  setTimeout(() => fetchQuota(), 5000);
  quotaPollTimer = setInterval(() => fetchQuota(), QUOTA_POLL_INTERVAL_MS);
  context.subscriptions.push({
    dispose: () => {
      if (quotaPollTimer) clearInterval(quotaPollTimer);
    },
  });

  console.log("[AYesMan] Ready. Auto-Accept: ON, Quota Dashboard: polling.");
}

// ─── Auto-Accept Logic ────────────────────────────────────────────────────────
function updateAutoAcceptStatusBar() {
  if (!autoAcceptStatusBar) return;
  if (autoAcceptEnabled) {
    autoAcceptStatusBar.text = "✅ Auto-Accept: ON";
    autoAcceptStatusBar.tooltip =
      "AYesMan Auto-Accept is active (click to pause)";
    autoAcceptStatusBar.backgroundColor = undefined;
  } else {
    autoAcceptStatusBar.text = "🛑 Auto-Accept: OFF";
    autoAcceptStatusBar.tooltip =
      "AYesMan Auto-Accept is paused (click to resume)";
    autoAcceptStatusBar.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground",
    );
  }
}

// Try to accept the current pending step via direct gRPC call.
//
// Flow (confirmed from diagnose output):
//   GetUserTrajectoryDescriptions {}          → currentTrajectoryId
//   GetAllCascadeTrajectories {}              → summaries map (cascadeId → {trajectoryId, stepCount, ...})
//   Match summary.trajectoryId === current    → cascadeId + stepCount
//   GetCascadeTrajectorySteps {cascadeId, stepOffset: stepCount-10}  → last 10 steps
//   Find last step with runCommand (not DONE) → accept via HandleCascadeUserInteraction
async function tryAutoAcceptStep(server: ServerInfo): Promise<void> {
  // Step 1: Get current trajectoryId
  const descs = await callGrpc(server, "GetUserTrajectoryDescriptions", {});
  const currentDesc = (descs?.trajectories ?? []).find((t: any) => t.current);
  if (!currentDesc?.trajectoryId) return;
  const currentTrajectoryId: string = currentDesc.trajectoryId;

  // Step 2: Find cascadeId by matching trajectoryId in cascade summaries
  const allTrajs = await callGrpc(server, "GetAllCascadeTrajectories", {});
  const summaries: Record<string, any> = allTrajs?.trajectorySummaries ?? {};

  let cascadeId: string | undefined;
  let stepCount = 0;
  for (const [cId, s] of Object.entries(summaries)) {
    if ((s as any)?.trajectoryId === currentTrajectoryId) {
      cascadeId = cId;
      stepCount = (s as any)?.stepCount ?? 0;
      break;
    }
  }
  if (!cascadeId || stepCount === 0) return;

  // Step 3: Get last 10 steps efficiently (avoid fetching all 800+ steps)
  const offset = Math.max(0, stepCount - 10);
  const stepsResult = await callGrpc(server, "GetCascadeTrajectorySteps", {
    cascadeId,
    stepOffset: offset,
  });
  const steps: any[] = stepsResult?.steps ?? [];

  // Step 4: Find last pending runCommand step and accept it
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (!step?.runCommand) continue;
    // Skip already-completed steps
    if (
      step.status === "CORTEX_STEP_STATUS_DONE" ||
      step.status === "CORTEX_STEP_STATUS_CANCELLED"
    )
      continue;

    const runCmd = step.runCommand;
    const proposedCmd: string =
      runCmd.proposedCommandLine ?? runCmd.commandLine ?? "";
    const absoluteIdx = offset + i;

    await callGrpc(server, "HandleCascadeUserInteraction", {
      cascadeId,
      interaction: {
        trajectoryId: currentTrajectoryId,
        stepIndex: absoluteIdx,
        runCommand: {
          confirm: true,
          proposedCommandLine: proposedCmd,
          submittedCommandLine: proposedCmd,
        },
      },
    });
    console.log(
      `[AYesMan] Auto-accepted step ${absoluteIdx}: ${proposedCmd.substring(0, 80)}`,
    );
    return;
  }
}

let lastAutoAcceptError = "";

function startAutoAcceptLoop() {
  autoAcceptTimer = setInterval(async () => {
    if (!autoAcceptEnabled) return;
    // IMPORTANT: Use cached server info directly — never call discoverServer() here.
    // discoverServer() uses execSync (blocking PowerShell) which freezes the Extension
    // Host thread and causes "unresponsive" errors. Server discovery happens in
    // fetchQuota() which runs every 2 minutes and properly caches the result.
    if (!cachedServerInfo) return;
    try {
      await tryAutoAcceptStep(cachedServerInfo);
    } catch (err: any) {
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
async function discoverServer(): Promise<ServerInfo | undefined> {
  if (cachedServerInfo) return cachedServerInfo;

  try {
    // Step 1: Extract CSRF token and PID from language server process args
    const cmdlineOutput = execSync(
      'powershell -Command "Get-CimInstance Win32_Process -Filter \\"name = \'language_server_windows_x64.exe\'\\" | Select-Object -First 1 | ForEach-Object { Write-Host $_.ProcessId; Write-Host $_.CommandLine }"',
      { encoding: "utf-8", timeout: 10000 },
    ).trim();

    const lines = cmdlineOutput.split("\n").map((l) => l.trim());
    const pid = parseInt(lines[0], 10);
    const cmdline = lines.slice(1).join(" ");

    const csrfMatch = cmdline.match(/--csrf_token\s+(\S+)/);
    if (!csrfMatch || !pid) {
      console.error(
        "[AYesMan] Could not extract CSRF/PID from language server",
      );
      return undefined;
    }
    const csrfToken = csrfMatch[1];

    // Step 2: Get listening ports for the process
    const portsOutput = execSync(
      `powershell -Command "Get-NetTCPConnection -OwningProcess ${pid} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort"`,
      { encoding: "utf-8", timeout: 10000 },
    ).trim();
    const ports = portsOutput
      .split(/\s+/)
      .map((p) => parseInt(p, 10))
      .filter((p) => !isNaN(p));

    if (ports.length === 0) {
      console.error("[AYesMan] No listening ports found for language server");
      return undefined;
    }

    console.log(
      `[AYesMan] LS PID=${pid}, CSRF=${csrfToken.substring(0, 8)}..., ports=${ports.join(",")}`,
    );

    // Step 3: Probe ports to find the gRPC API (try HTTPS first, then HTTP)
    for (const port of ports) {
      for (const useHttps of [true, false]) {
        const ok = await probePort(port, csrfToken, useHttps);
        if (ok) {
          cachedServerInfo = { port, csrfToken, useHttps };
          console.log(
            `[AYesMan] Found gRPC at ${useHttps ? "https" : "http"}://127.0.0.1:${port}`,
          );
          return cachedServerInfo;
        }
      }
    }

    console.error("[AYesMan] Could not find working gRPC port");
    return undefined;
  } catch (err: any) {
    console.error("[AYesMan] Server discovery failed:", err.message);
    return undefined;
  }
}

function probePort(
  port: number,
  csrfToken: string,
  useHttps: boolean,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const options: https.RequestOptions = {
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
      res.on("data", () => {}); // drain
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
function callGrpc(
  server: ServerInfo,
  method: string,
  body: any = {},
): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options: http.RequestOptions = {
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
      res.on("data", (chunk: Buffer) => (responseBody += chunk.toString()));
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(responseBody));
          } catch {
            resolve(responseBody);
          }
        } else {
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
        vscode.window.showWarningMessage(
          "[AYesMan] Cannot find Antigravity language server.",
        );
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
    const cascadeConfigs =
      userStatus?.userStatus?.cascadeModelConfigData?.clientModelConfigs;
    if (cascadeConfigs && Array.isArray(cascadeConfigs)) {
      latestQuota = cascadeConfigs
        .filter((c: any) => c.quotaInfo)
        .map((c: any) => ({
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
        if (
          c.quotaInfo &&
          !latestQuota.find(
            (q: QuotaEntry) => q.modelId === c.modelOrAlias?.model,
          )
        ) {
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
      vscode.window.showInformationMessage(
        `[AYesMan] Quota refreshed: ${latestQuota.length} models loaded.`,
      );
    }

    console.log(
      `[AYesMan] Quota refreshed: ${latestQuota.length} models, credits: P=${latestCredits?.availablePromptCredits} F=${latestCredits?.availableFlowCredits}`,
    );
  } catch (err: any) {
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
  const lowest = [...latestQuota].reduce((min, q) =>
    q.remainingFraction < min.remainingFraction ? q : min,
    latestQuota[0],
  );

  const pct = Math.round(lowest.remainingFraction * 100);
  const icon = pct >= 80 ? "$(check)" : pct >= 40 ? "$(warning)" : "$(error)";
  const shortName =
    lowest.label.length > 18
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
    const {
      availablePromptCredits,
      monthlyPromptCredits,
      availableFlowCredits,
      monthlyFlowCredits,
      planName,
    } = latestCredits;
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

function formatResetTime(isoStr: string): string {
  try {
    const reset = new Date(isoStr);
    const now = new Date();
    const diffMs = reset.getTime() - now.getTime();
    if (diffMs < 0) return "resets now";
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    if (hrs > 0) return `resets in ${hrs}h ${mins}m`;
    return `resets in ${mins}m`;
  } catch {
    return isoStr;
  }
}

// ─── Deactivate ──────────────────────────────────────────────────────────────
export function deactivate() {
  if (autoAcceptTimer) clearInterval(autoAcceptTimer);
  if (quotaPollTimer) clearInterval(quotaPollTimer);
}
