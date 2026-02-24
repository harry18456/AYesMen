import * as vscode from "vscode";
import { getLatestQuota } from "../quota/state.js";
import type { QuotaEntry } from "../types/index.js";

let _statusBar: vscode.StatusBarItem;
let _getVersion: () => string;
let _getAutoAcceptEnabled: () => boolean;

export function initStatusBar(
  bar: vscode.StatusBarItem,
  getVersion: () => string,
  getAutoAcceptEnabled: () => boolean,
): void {
  _statusBar = bar;
  _getVersion = getVersion;
  _getAutoAcceptEnabled = getAutoAcceptEnabled;
}

export function updateUnifiedStatusBar(): void {
  if (!_statusBar) return;
  const isEnabled = _getAutoAcceptEnabled();
  if (!isEnabled) {
    _statusBar.text = "$(debug-pause) AYesMan";
    _statusBar.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground",
    );
    return;
  }
  _statusBar.text = "$(debug-start) AYesMan";
  const latestQuota = getLatestQuota();
  if (latestQuota.length > 0) {
    const lowest = latestQuota.reduce(
      (min, q) => (q.remainingFraction < min.remainingFraction ? q : min),
      latestQuota[0],
    );
    const pct = Math.round(lowest.remainingFraction * 100);
    _statusBar.backgroundColor =
      pct < 20
        ? new vscode.ThemeColor("statusBarItem.errorBackground")
        : pct < 40
          ? new vscode.ThemeColor("statusBarItem.warningBackground")
          : undefined;
  } else {
    _statusBar.backgroundColor = undefined;
  }
}

export function updateQuotaStatusBar(): void {
  const latestQuota = getLatestQuota();
  const version = _getVersion();
  const versionLine = `AYesMan v${version}`;
  const autoAcceptLine = `Auto-Accept: ${_getAutoAcceptEnabled() ? "ON" : "OFF"}`;

  if (latestQuota.length === 0) {
    const md = new vscode.MarkdownString(
      `### ${versionLine}\n\n${autoAcceptLine}\n\n_No quota data yet_`,
    );
    md.isTrusted = true;
    _statusBar.tooltip = md;
    updateUnifiedStatusBar();
    return;
  }

  const sorted = [...latestQuota].sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  const modelLines = sorted.map((q: QuotaEntry) => {
    const p = Math.round(q.remainingFraction * 100);
    const dot = p >= 80 ? "🟢" : p >= 40 ? "🟡" : "🔴";
    const resetStr = q.resetTime ? ` _(${formatResetTime(q.resetTime)})_` : "";
    return `${dot} **${q.label}** — ${p}%${resetStr}`;
  });

  const tooltipMd = `### ${versionLine}\n\n${autoAcceptLine}\n\n${modelLines.join("  \n")}`;
  const md = new vscode.MarkdownString(tooltipMd);
  md.isTrusted = true;
  _statusBar.tooltip = md;

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
