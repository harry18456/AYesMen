import * as vscode from "vscode";
import type { ServerInfo, ProcessInfo } from "../types/index.js";
import { probePort } from "./probe.js";
import * as windows from "./platform/windows.js";
import * as unix from "./platform/unix.js";
import { log } from "../logger.js";

const platform = process.platform === "win32" ? windows : unix;

// Cache TTL: invalidate after 5 minutes to handle server restarts where
// the port stays the same (errors only trigger immediate invalidation).
const CACHE_TTL_MS = 5 * 60 * 1000;

let _cachedServerInfo: ServerInfo | undefined;
let _cachedAt = 0;

export function getCachedServerInfo(): ServerInfo | undefined {
  if (_cachedServerInfo && Date.now() - _cachedAt > CACHE_TTL_MS) {
    _cachedServerInfo = undefined;
    _cachedAt = 0;
  }
  return _cachedServerInfo;
}

export function clearCachedServerInfo(): void {
  _cachedServerInfo = undefined;
  _cachedAt = 0;
}

function setCachedServerInfo(info: ServerInfo): void {
  _cachedServerInfo = info;
  _cachedAt = Date.now();
}

export async function discoverServer(): Promise<ServerInfo | undefined> {
  if (getCachedServerInfo()) return _cachedServerInfo;

  const procs = await platform.findLanguageServerProcesses();
  log(`[AYesMan] Found ${procs.length} language server processes`);
  if (procs.length === 0) {
    log("[AYesMan] Language server processes not found");
    return undefined;
  }

  // parentPid mode: filter to processes belonging to this Extension Host.
  // process.pid === Extension Host PID, which is the direct parent of the
  // language_server spawned by the Antigravity extension in this window.
  // workspace mode: filter by `--workspace_id` in cmdline matching current folders.
  const myProcs = procs.filter((p) => {
    if (p.parentPid !== undefined && p.parentPid === process.pid) return true;

    const wsMatch = p.cmdline.match(/--workspace_id\s+(\S+)/);
    if (wsMatch) {
      const serverWsId = wsMatch[1].toLowerCase();
      const hasMatch = (vscode.workspace.workspaceFolders ?? []).some((f) => {
        let path = f.uri.path;
        if (path.startsWith("/")) path = path.substring(1);
        const expected = `${f.uri.scheme}_${path.replace(/:/g, "_3A").replace(/\//g, "_")}`.toLowerCase();
        return expected === serverWsId;
      });
      if (hasMatch) return true;
    }
    return false;
  });

  if (myProcs.length > 0) {
    log(
      `[AYesMan] Workspace/parentPid mode: ${myProcs.length} candidate(s) for ExtHost PID ${process.pid}`,
    );
    const result = await probeProcesses(myProcs, "workspace/parentPid");
    if (result) return result;
  } else {
    log(
      `[AYesMan] Workspace/parentPid mode: no match for ExtHost PID ${process.pid} or workspaces, falling back to global mode`,
    );
  }

  // Global fallback: connect to the first server that responds to Heartbeat.
  return probeProcesses(procs, "global");
}

// Probe a list of processes in order and return the first working ServerInfo.
async function probeProcesses(
  procs: ProcessInfo[],
  mode: string,
): Promise<ServerInfo | undefined> {
  for (const proc of procs) {
    const csrfMatch = proc.cmdline.match(/--csrf_token\s+(\S+)/);
    if (!csrfMatch) {
      log(`[AYesMan] PID ${proc.pid}: no --csrf_token in cmdline, skipping`);
      continue;
    }
    const csrfToken = csrfMatch[1];
    const ports = await platform.findListeningPorts(proc.pid);

    if (ports.length === 0) {
      log(`[AYesMan] PID ${proc.pid}: no listening ports found, skipping`);
      continue;
    }

    log(
      `[AYesMan] LS PID=${proc.pid}, CSRF=${csrfToken.substring(0, 8)}..., ports=${ports.join(",")}`,
    );

    for (const port of ports) {
      for (const useHttps of [true, false]) {
        const proto = useHttps ? "https" : "http";
        const ok = await probePort(port, csrfToken, useHttps);
        log(
          `[AYesMan] PID ${proc.pid} port=${port} ${proto} probe=${ok ? "OK" : "FAIL"}`,
        );
        if (ok) {
          setCachedServerInfo({ port, csrfToken, useHttps });
          log(
            `[AYesMan] ${mode} mode: connected to ${proto}://127.0.0.1:${port}`,
          );
          return _cachedServerInfo;
        }
      }
    }
  }

  log(`[AYesMan] ${mode} mode: could not find any working gRPC port`);
  return undefined;
}
