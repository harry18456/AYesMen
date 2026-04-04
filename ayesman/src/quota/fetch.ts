import * as vscode from "vscode";
import type { QuotaEntry } from "../types/index.js";
import { callLsHttpGrpc } from "../server/grpc.js";
import { discoverServer, clearCachedServerInfo } from "../server/discovery.js";
import {
  setLatestQuota,
  getLatestQuota,
} from "./state.js";
import { updateQuotaStatusBar } from "../ui/statusBar.js";
import { log } from "../logger.js";

let _statusBar: vscode.StatusBarItem;

export function initQuotaFetch(statusBar: vscode.StatusBarItem): void {
  _statusBar = statusBar;
}

export async function fetchQuota(showNotification = false): Promise<void> {
  // Phase 1: server discovery — failure clears the cache.
  let server;
  try {
    server = await discoverServer();
  } catch (err: unknown) {
    log(`[AYesMan] Server discovery error: ${(err as Error).message}`);
    clearCachedServerInfo();
    _statusBar.tooltip = `AYesMan: Quota fetch error — ${(err as Error).message}`;
    return;
  }

  if (!server) {
    _statusBar.tooltip =
      "AYesMan: Could not connect to Antigravity language server";
    if (showNotification) {
      vscode.window.showWarningMessage(
        "[AYesMan] Cannot find Antigravity language server.",
      );
    }
    return;
  }

  // Phase 2: quota fetch. If this fails, the server is likely unreachable.
  // Clear cachedServerInfo so it can be re-discovered.
  try {
    // Rebuild quota list from scratch each cycle.
    // Using a replace strategy (not append) ensures stale model entries from
    // previous cycles are never retained.
    let newQuota: QuotaEntry[] = [];

    // Part A: cascade model quotas from GetUserStatus on httpPort.
    // Response shape: { userStatus: { cascadeModelConfigData: { clientModelConfigs: [...] } } }
    try {
      const userStatusResp = await callLsHttpGrpc(server, "GetUserStatus") as Record<string, unknown>;
      const userStatus = userStatusResp?.userStatus as Record<string, unknown> | undefined;
      log(`[AYesMan] GetUserStatus userStatus keys: ${userStatus ? Object.keys(userStatus).join(", ") : "none"}`);
      const configs = (
        (userStatus?.cascadeModelConfigData as Record<string, unknown>)?.clientModelConfigs
      ) as Record<string, unknown>[] | undefined;
      if (configs && Array.isArray(configs)) {
        newQuota = configs
          .filter((c) => c.quotaInfo)
          .map((c) => ({
            label: (c.label as string) || "Unknown",
            modelId: ((c.modelOrAlias as Record<string, string>)?.model) || "",
            remainingFraction:
              ((c.quotaInfo as Record<string, number>)?.remainingFraction) ?? 0,
            resetTime: (c.quotaInfo as Record<string, string>)?.resetTime,
          }));
        log(`[AYesMan] Part A: ${newQuota.length} cascade model(s) from GetUserStatus`);
      } else {
        log(`[AYesMan] Part A: no cascadeModelConfigData.clientModelConfigs in GetUserStatus response`);
      }
    } catch (err) {
      log(`[AYesMan] Part A (GetUserStatus) failed: ${(err as Error).message}`);
    }

    // Part B: autocomplete model quotas from GetCommandModelConfigs on httpPort.
    // Non-fatal: if unavailable, continue with Part A results.
    try {
      const cmdConfigs = await callLsHttpGrpc(server, "GetCommandModelConfigs") as Record<string, unknown>;
      const cmdList = (cmdConfigs?.clientModelConfigs) as Record<string, unknown>[] | undefined;
      if (cmdList && Array.isArray(cmdList)) {
        const existingIds = new Set(newQuota.map((q) => q.modelId));
        for (const c of cmdList) {
          const modelId = ((c.modelOrAlias as Record<string, string>)?.model) || "";
          if (c.quotaInfo && !existingIds.has(modelId)) {
            newQuota.push({
              label: `${c.label as string} (Autocomplete)`,
              modelId,
              remainingFraction:
                ((c.quotaInfo as Record<string, number>)?.remainingFraction) ?? 0,
              resetTime: (c.quotaInfo as Record<string, string>)?.resetTime,
            });
            existingIds.add(modelId);
          }
        }
        log(`[AYesMan] Part B: total ${newQuota.length} model(s) after GetCommandModelConfigs`);
      }
    } catch (err) {
      log(`[AYesMan] Part B (GetCommandModelConfigs) skipped: ${(err as Error).message}`);
    }

    // Replace the entire quota state in one atomic update.
    setLatestQuota(newQuota);
    updateQuotaStatusBar();

    if (showNotification) {
      vscode.window.showInformationMessage(
        `[AYesMan] Quota refreshed: ${getLatestQuota().length} models loaded.`,
      );
    }

    log(`[AYesMan] Quota refreshed: ${getLatestQuota().length} models`);
  } catch (err: unknown) {
    log(`[AYesMan] Quota fetch error: ${(err as Error).message}`);
    _statusBar.tooltip = `AYesMan: Quota fetch error — ${(err as Error).message}`;
    clearCachedServerInfo();
  }
}
