import { getCachedServerInfo, clearCachedServerInfo } from "../server/discovery.js";
import { tryAutoAcceptStep } from "./acceptStep.js";
import { fetchQuota } from "../quota/fetch.js";

const AUTO_ACCEPT_INTERVAL_MS = 500;
// Cooldown before re-triggering server discovery after a connection error.
// Prevents rapid retries while still recovering faster than the 2-min quota poll.
const REDISCOVERY_DELAY_MS = 3000;

let _getAutoAcceptEnabled: () => boolean;
let isAccepting = false;
let lastAutoAcceptError = "";
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
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? String(err);
      if (msg !== lastAutoAcceptError) {
        console.log(`[AYesMan] auto-accept error: ${msg}`);
        lastAutoAcceptError = msg;
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
