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
let autoAcceptTimer: ReturnType<typeof setInterval> | undefined;

// ─── Activate ────────────────────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext) {
  console.log("[AYesMan] Extension Activated.");

  // ── Auto-Accept Toggle Command ──
  context.subscriptions.push(
    vscode.commands.registerCommand("ayesman.toggleAutoAccept", () => {
      autoAcceptEnabled = !autoAcceptEnabled;
      updateUnifiedStatusBar();
      vscode.window.showInformationMessage(
        autoAcceptEnabled
          ? "[AYesMan] Auto-Accept: ON"
          : "[AYesMan] Auto-Accept: OFF",
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
  quotaStatusBar.command = "ayesman.toggleAutoAccept";
  updateUnifiedStatusBar();
  quotaStatusBar.show();
  context.subscriptions.push(quotaStatusBar);

  // ── Quota Refresh Command ──
  context.subscriptions.push(
    vscode.commands.registerCommand("ayesman.refreshQuota", () =>
      fetchQuota(true),
    ),
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

// ─── Unified Status Bar ───────────────────────────────────────────────────────
function updateUnifiedStatusBar() {
  if (!quotaStatusBar) return;
  if (!autoAcceptEnabled) {
    quotaStatusBar.text = "$(debug-pause) YesMan";
    quotaStatusBar.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground",
    );
    return;
  }
  quotaStatusBar.text = "$(debug-start) YesMan";
  if (latestQuota.length > 0) {
    const lowest = latestQuota.reduce((min, q) =>
      q.remainingFraction < min.remainingFraction ? q : min,
      latestQuota[0],
    );
    const pct = Math.round(lowest.remainingFraction * 100);
    quotaStatusBar.backgroundColor =
      pct < 20
        ? new vscode.ThemeColor("statusBarItem.errorBackground")
        : pct < 40
          ? new vscode.ThemeColor("statusBarItem.warningBackground")
          : undefined;
  } else {
    quotaStatusBar.backgroundColor = undefined;
  }
}

// Normalize "file:///d:/foo" or "file:///d%3A/foo" → "d:/foo" (lowercase, forward slashes)
function normalizeFileUri(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\/\//, ""))
    .toLowerCase()
    .replace(/\\/g, "/");
}

// Current workspace paths (e.g. ["d:/side_project/ayesman"])
function currentWorkspacePaths(): Set<string> {
  return new Set(
    (vscode.workspace.workspaceFolders ?? []).map((f) =>
      f.uri.fsPath.toLowerCase().replace(/\\/g, "/"),
    ),
  );
}

// Try to accept the current pending step via direct gRPC call.
//
// Flow:
//   GetAllCascadeTrajectories {}
//     → filter by current VS Code workspace (summary.workspaces[].workspaceFolderAbsoluteUri)
//     → prefer non-IDLE, sort by lastModifiedTime desc, take top 3
//   GetCascadeTrajectorySteps (last 10 steps)
//     → find pending runCommand (not DONE/CANCELLED)
//   HandleCascadeUserInteraction { confirm: true }
//     → using cascade's own trajectoryId (NOT user-level trajectory)
async function tryAutoAcceptStep(server: ServerInfo): Promise<void> {
  const allTrajs = await callGrpc(server, "GetAllCascadeTrajectories", {});
  const summaries: Record<string, any> = allTrajs?.trajectorySummaries ?? {};

  const wsPaths = currentWorkspacePaths();

  // Build candidate list filtered to this workspace, prefer non-IDLE, newest first
  const candidates = Object.entries(summaries)
    .filter(([, s]) => {
      if (wsPaths.size === 0) return true; // no workspace open → accept all
      const cascadeWorkspaces: any[] = (s as any)?.workspaces ?? [];
      return cascadeWorkspaces.some((w) => {
        const p = normalizeFileUri(w?.workspaceFolderAbsoluteUri ?? "");
        return wsPaths.has(p);
      });
    })
    .map(([cascadeId, s]) => ({
      cascadeId,
      trajectoryId: (s as any)?.trajectoryId as string ?? "",
      stepCount: (s as any)?.stepCount as number ?? 0,
      idle: (s as any)?.status === "CASCADE_RUN_STATUS_IDLE",
      lastModified: new Date((s as any)?.lastModifiedTime ?? 0),
    }))
    .sort((a, b) => {
      if (a.idle !== b.idle) return a.idle ? 1 : -1;
      return b.lastModified.getTime() - a.lastModified.getTime();
    })
    .slice(0, 3);

  for (const { cascadeId, trajectoryId, stepCount } of candidates) {
    if (stepCount === 0) continue;

    const stepsResult = await callGrpc(server, "GetCascadeTrajectorySteps", {
      cascadeId,
      stepOffset: 0,
    });
    const steps: any[] = stepsResult?.steps ?? [];

    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      if (!step?.runCommand) continue;
      if (
        step.status === "CORTEX_STEP_STATUS_DONE" ||
        step.status === "CORTEX_STEP_STATUS_CANCELLED"
      ) continue;

      const runCmd = step.runCommand;
      const proposedCmd: string =
        runCmd.proposedCommandLine ?? runCmd.commandLine ?? "";
      // Use cascade's own trajectoryId (not user-level trajectory)
      await callGrpc(server, "HandleCascadeUserInteraction", {
        cascadeId,
        interaction: {
          trajectoryId,
          stepIndex: i,
          runCommand: {
            confirm: true,
            proposedCommandLine: proposedCmd,
            submittedCommandLine: proposedCmd,
          },
        },
      });
      console.log(
        `[AYesMan] Auto-accepted step ${i}: ${proposedCmd.substring(0, 80)}`,
      );
      return;
    }
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

interface ProcessInfo {
  pid: number;
  cmdline: string;
}

// Find language_server process and return PID + full command line.
// Uses platform-specific commands:
//   Windows → PowerShell Get-CimInstance
//   macOS/Linux → ps aux + grep
function findLanguageServerProcess(): ProcessInfo | undefined {
  try {
    if (process.platform === "win32") {
      const out = execSync(
        'powershell -Command "Get-CimInstance Win32_Process -Filter \\"name LIKE \'language_server%\'\\" | Select-Object -First 1 | ForEach-Object { Write-Host $_.ProcessId; Write-Host $_.CommandLine }"',
        { encoding: "utf-8", timeout: 10000 },
      ).trim();
      const lines = out.split("\n").map((l) => l.trim());
      const pid = parseInt(lines[0], 10);
      const cmdline = lines.slice(1).join(" ");
      if (!pid || !cmdline) return undefined;
      return { pid, cmdline };
    } else {
      // macOS / Linux: ps aux lists all processes with full command line
      const out = execSync(
        "ps aux | grep 'language_server' | grep -v grep | head -1",
        { encoding: "utf-8", timeout: 10000 },
      ).trim();
      if (!out) return undefined;
      // ps aux columns: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND...
      const parts = out.trim().split(/\s+/);
      const pid = parseInt(parts[1], 10);
      const cmdline = parts.slice(10).join(" ");
      if (!pid || !cmdline) return undefined;
      return { pid, cmdline };
    }
  } catch {
    return undefined;
  }
}

// Find ports the language server process is listening on.
// Windows → PowerShell Get-NetTCPConnection
// macOS/Linux → lsof -i -n -P -p <pid>
function findListeningPorts(pid: number): number[] {
  try {
    if (process.platform === "win32") {
      const out = execSync(
        `powershell -Command "Get-NetTCPConnection -OwningProcess ${pid} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort"`,
        { encoding: "utf-8", timeout: 10000 },
      ).trim();
      return out.split(/\s+/).map(Number).filter((p) => !isNaN(p) && p > 0);
    } else {
      // lsof -i: all internet connections, -n: no DNS, -P: no port names
      const out = execSync(
        `lsof -i -n -P -p ${pid} 2>/dev/null | grep LISTEN`,
        { encoding: "utf-8", timeout: 10000 },
      ).trim();
      const ports: number[] = [];
      for (const line of out.split("\n")) {
        const match = line.match(/:(\d+)\s+\(LISTEN\)/);
        if (match) ports.push(parseInt(match[1], 10));
      }
      return ports;
    }
  } catch {
    return [];
  }
}

async function discoverServer(): Promise<ServerInfo | undefined> {
  if (cachedServerInfo) return cachedServerInfo;

  const proc = findLanguageServerProcess();
  if (!proc) {
    console.error("[AYesMan] Language server process not found");
    return undefined;
  }

  const csrfMatch = proc.cmdline.match(/--csrf_token\s+(\S+)/);
  if (!csrfMatch) {
    console.error("[AYesMan] Could not extract CSRF token from process args");
    return undefined;
  }
  const csrfToken = csrfMatch[1];
  const ports = findListeningPorts(proc.pid);

  if (ports.length === 0) {
    console.error("[AYesMan] No listening ports found for language server");
    return undefined;
  }

  console.log(
    `[AYesMan] LS PID=${proc.pid}, CSRF=${csrfToken.substring(0, 8)}..., ports=${ports.join(",")}`,
  );

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
      quotaStatusBar.tooltip = "AYesMan: Could not connect to Antigravity language server";
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
    quotaStatusBar.tooltip = `AYesMan: Quota fetch error — ${err.message}`;
  }
}

// ─── Quota Status Bar Updates ─────────────────────────────────────────────────
function updateQuotaStatusBar() {
  const autoAcceptLine = `Auto-Accept: ${autoAcceptEnabled ? "ON" : "OFF"}`;

  if (latestQuota.length === 0) {
    const md = new vscode.MarkdownString(`### YesMan\n\n${autoAcceptLine}\n\n_No quota data yet_`);
    md.isTrusted = true;
    quotaStatusBar.tooltip = md;
    updateUnifiedStatusBar();
    return;
  }

  const sorted = [...latestQuota].sort((a, b) => a.label.localeCompare(b.label));

  const modelLines = sorted.map((q) => {
    const p = Math.round(q.remainingFraction * 100);
    const dot = p >= 80 ? "🟢" : p >= 40 ? "🟡" : "🔴";
    const resetStr = q.resetTime ? ` _(${formatResetTime(q.resetTime)})_` : "";
    return `${dot} **${q.label}** — ${p}%${resetStr}`;
  });

  const tooltipMd = `### YesMan\n\n${autoAcceptLine}\n\n${modelLines.join("  \n")}`;

  const md = new vscode.MarkdownString(tooltipMd);
  md.isTrusted = true;
  quotaStatusBar.tooltip = md;

  updateUnifiedStatusBar();
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
