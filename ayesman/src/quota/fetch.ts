import * as vscode from "vscode";
import type { QuotaEntry, CreditsInfo } from "../types/index.js";
import { callGrpc } from "../server/grpc.js";
import { discoverServer, clearCachedServerInfo } from "../server/discovery.js";
import {
  setLatestQuota,
  setLatestCredits,
  getLatestQuota,
  getLatestCredits,
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
    const userStatus = await callGrpc(server, "GetUserStatus") as Record<string, unknown>;

    // Extract credits
    const planStatus = (userStatus?.userStatus as Record<string, unknown>)?.planStatus as Record<string, unknown> | undefined;
    if (planStatus) {
      const credits: CreditsInfo = {
        availablePromptCredits: (planStatus.availablePromptCredits as number) || 0,
        availableFlowCredits: (planStatus.availableFlowCredits as number) || 0,
        monthlyPromptCredits:
          ((planStatus.planInfo as Record<string, number>)?.monthlyPromptCredits) || 0,
        monthlyFlowCredits:
          ((planStatus.planInfo as Record<string, number>)?.monthlyFlowCredits) || 0,
        planName: ((planStatus.planInfo as Record<string, string>)?.planName) || "Unknown",
      };
      setLatestCredits(credits);
      updateQuotaStatusBar();
    }

    // Phase 3: Rebuild quota list from scratch each cycle.
    // Using a replace strategy (not append) ensures stale model entries from
    // previous cycles are never retained.
    let newQuota: QuotaEntry[] = [];

    // Part A: cascade model quotas from GetUserStatus
    const cascadeConfigs =
      ((userStatus?.userStatus as Record<string, unknown>)?.cascadeModelConfigData as Record<string, unknown>)?.clientModelConfigs;
    if (cascadeConfigs && Array.isArray(cascadeConfigs)) {
      newQuota = cascadeConfigs
        .filter((c: Record<string, unknown>) => c.quotaInfo)
        .map((c: Record<string, unknown>) => ({
          label: (c.label as string) || "Unknown",
          modelId: ((c.modelOrAlias as Record<string, string>)?.model) || "",
          remainingFraction:
            ((c.quotaInfo as Record<string, number>)?.remainingFraction) ?? 1,
          resetTime: (c.quotaInfo as Record<string, string>)?.resetTime,
        }));
    }

    // Part B: autocomplete model quotas from GetCommandModelConfigs.
    // Only add models not already present from Part A.
    const cmdConfigs = await callGrpc(server, "GetCommandModelConfigs") as Record<string, unknown>;
    if (cmdConfigs?.clientModelConfigs && Array.isArray(cmdConfigs.clientModelConfigs)) {
      const existingIds = new Set(newQuota.map((q) => q.modelId));
      for (const c of cmdConfigs.clientModelConfigs as Record<string, unknown>[]) {
        const modelId = ((c.modelOrAlias as Record<string, string>)?.model) || "";
        if (c.quotaInfo && !existingIds.has(modelId)) {
          newQuota.push({
            label: `${c.label as string} (Autocomplete)`,
            modelId,
            remainingFraction:
              ((c.quotaInfo as Record<string, number>)?.remainingFraction) ?? 1,
            resetTime: (c.quotaInfo as Record<string, string>)?.resetTime,
          });
          existingIds.add(modelId);
        }
      }
    }

    // Replace the entire quota state in one atomic update.
    setLatestQuota(newQuota);
    updateQuotaStatusBar();

    if (showNotification) {
      vscode.window.showInformationMessage(
        `[AYesMan] Quota refreshed: ${getLatestQuota().length} models loaded.`,
      );
    }

    const credits = getLatestCredits();
    log(
      `[AYesMan] Quota refreshed: ${getLatestQuota().length} models, credits: P=${credits?.availablePromptCredits} F=${credits?.availableFlowCredits}`,
    );
  } catch (err: unknown) {
    log(`[AYesMan] Quota fetch error: ${(err as Error).message}`);
    _statusBar.tooltip = `AYesMan: Quota fetch error — ${(err as Error).message}`;
    clearCachedServerInfo();
  }
}
