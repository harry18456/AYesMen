import * as vscode from "vscode";
import { initStatusBar, updateUnifiedStatusBar } from "./ui/statusBar.js";
import { initQuotaFetch, fetchQuota } from "./quota/fetch.js";
import { initAcceptStep } from "./autoAccept/acceptStep.js";
import { initAutoAcceptLoop, startAutoAcceptLoop } from "./autoAccept/loop.js";
import { getCachedServerInfo } from "./server/discovery.js";
import { initOutputChannel, log } from "./logger.js";

const QUOTA_POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

// Per-window in-memory auto-accept state.
// Each Extension Host has its own JS heap, so this is naturally isolated
// per VS Code window. Defaults to true on every extension activation.
let _autoAcceptEnabled = true;

function getAutoAcceptEnabled(): boolean {
  return _autoAcceptEnabled;
}

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = initOutputChannel();
  context.subscriptions.push(outputChannel);
  log("[AYesMan] Extension Activated.");
  const extVersion = context.extension.packageJSON.version as string;

  // ── Status Bar ──
  const quotaStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    200,
  );
  quotaStatusBar.command = "ayesman.toggleAutoAccept";
  context.subscriptions.push(quotaStatusBar);

  // ── Init Modules ──
  initStatusBar(quotaStatusBar, () => extVersion, getAutoAcceptEnabled);
  initQuotaFetch(quotaStatusBar);
  initAcceptStep(getAutoAcceptEnabled);
  initAutoAcceptLoop(getAutoAcceptEnabled);

  updateUnifiedStatusBar();
  quotaStatusBar.show();

  // ── Auto-Accept Toggle Command ──
  context.subscriptions.push(
    vscode.commands.registerCommand("ayesman.toggleAutoAccept", async () => {
      _autoAcceptEnabled = !_autoAcceptEnabled;
      updateUnifiedStatusBar();
      vscode.window.showInformationMessage(
        _autoAcceptEnabled
          ? "[AYesMan] Auto-Accept: ON"
          : "[AYesMan] Auto-Accept: OFF",
      );
    }),
  );

  // ── Auto-Accept Loop ──
  const autoAcceptDisposable = startAutoAcceptLoop();
  context.subscriptions.push(autoAcceptDisposable);

  // ── Quota Refresh Command ──
  context.subscriptions.push(
    vscode.commands.registerCommand("ayesman.refreshQuota", () =>
      fetchQuota(true),
    ),
  );

  // ── Quota Polling with Exponential Backoff on Startup ──
  // Schedule: +5s, +15s, +35s, +75s, then fall through to the regular 2-min interval.
  // Guards against race condition between extension activation and language server init.
  const startupDelays = [5000, 10000, 20000, 40000];
  let startupAttempt = 0;
  function scheduleStartupFetch() {
    setTimeout(async () => {
      await fetchQuota();
      startupAttempt++;
      if (!getCachedServerInfo() && startupAttempt < startupDelays.length) {
        scheduleStartupFetch();
      }
    }, startupDelays[startupAttempt]);
  }
  scheduleStartupFetch();

  const quotaPollTimer = setInterval(() => fetchQuota(), QUOTA_POLL_INTERVAL_MS);
  context.subscriptions.push({ dispose: () => clearInterval(quotaPollTimer) });

  log("[AYesMan] Ready. Auto-Accept: ON, Quota Dashboard: polling.");
}

export function deactivate() {}
