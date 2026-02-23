import { getCachedServerInfo, clearCachedServerInfo } from "../server/discovery.js";
import { tryAutoAcceptStep } from "./acceptStep.js";

const AUTO_ACCEPT_INTERVAL_MS = 500;

let _getAutoAcceptEnabled: () => boolean;
let isAccepting = false;
let lastAutoAcceptError = "";

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
    } finally {
      isAccepting = false;
    }
  }, AUTO_ACCEPT_INTERVAL_MS);

  return { dispose: () => clearInterval(timer) };
}
