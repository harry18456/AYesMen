import { getCachedServerInfo, clearCachedServerInfo } from "../server/discovery.js";
import { tryAutoAcceptStep } from "./acceptStep.js";
import { fetchQuota } from "../quota/fetch.js";
import { log } from "../logger.js";

const AUTO_ACCEPT_INTERVAL_MS = 500;
// Cooldown before re-triggering server discovery after a connection error.
// Prevents rapid retries while still recovering faster than the 2-min quota poll.
const REDISCOVERY_DELAY_MS = 3000;

// Log a reminder every N consecutive identical errors so the user knows
// the issue is still ongoing, without flooding the output channel.
const ERROR_REPEAT_LOG_INTERVAL = 20;

let _getAutoAcceptEnabled: () => boolean;
let isAccepting = false;
let lastAutoAcceptError = "";
let consecutiveErrorCount = 0;
let firstErrorTime: number | undefined;
let _rediscoveryTimer: ReturnType<typeof setTimeout> | undefined;

export function initAutoAcceptLoop(getAutoAcceptEnabled: () => boolean): void {
  _getAutoAcceptEnabled = getAutoAcceptEnabled;
}

export function startAutoAcceptLoop(): { dispose: () => void } {
  const timer = setInterval(async () => {
    if (!_getAutoAcceptEnabled() || isAccepting) return;

    // IMPORTANT: Use cached server info directly — never call discoverServer() here.
    const server = getCachedServerInfo();
    if (!server) return;

    isAccepting = true;
    try {
      await tryAutoAcceptStep(server);

      // If we had consecutive errors before but now succeeded, log recovery.
      if (consecutiveErrorCount > 0) {
        const elapsed = firstErrorTime
          ? `${Math.round((Date.now() - firstErrorTime) / 1000)}s`
          : "?s";
        log(
          `[AYesMan] auto-accept recovered after ${consecutiveErrorCount} consecutive error(s) (${elapsed})`,
        );
        consecutiveErrorCount = 0;
        lastAutoAcceptError = "";
        firstErrorTime = undefined;
      }
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? String(err);
      // Deduplicate by error prefix (first 50 chars) to avoid log spam when
      // dynamic values (timestamps, PIDs) differ but the error type is the same.
      const msgKey = msg.substring(0, 50);

      if (msgKey !== lastAutoAcceptError) {
        // New error type — always log with full detail.
        log(`[AYesMan] auto-accept error: ${msg}`);
        lastAutoAcceptError = msgKey;
        consecutiveErrorCount = 1;
        firstErrorTime = Date.now();
      } else {
        consecutiveErrorCount++;
        // Periodic reminder so the user knows the issue persists.
        if (consecutiveErrorCount % ERROR_REPEAT_LOG_INTERVAL === 0) {
          const elapsed = firstErrorTime
            ? `${Math.round((Date.now() - firstErrorTime) / 1000)}s`
            : "?s";
          log(
            `[AYesMan] auto-accept still failing (×${consecutiveErrorCount}, ${elapsed} elapsed): ${msgKey}...`,
          );
        }
      }

      clearCachedServerInfo();
      // Schedule a quick re-discovery so auto-accept resumes promptly
      // instead of waiting up to 2 minutes for the next quota poll.
      if (!_rediscoveryTimer) {
        _rediscoveryTimer = setTimeout(() => {
          _rediscoveryTimer = undefined;
          void fetchQuota();
        }, REDISCOVERY_DELAY_MS);
      }
    } finally {
      isAccepting = false;
    }
  }, AUTO_ACCEPT_INTERVAL_MS);

  return {
    dispose: () => {
      clearInterval(timer);
      if (_rediscoveryTimer) {
        clearTimeout(_rediscoveryTimer);
        _rediscoveryTimer = undefined;
      }
    },
  };
}
