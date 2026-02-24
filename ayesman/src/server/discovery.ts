import * as vscode from "vscode";
import type { ServerInfo, ProcessInfo } from "../types/index.js";
import { callGrpc } from "./grpc.js";
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

function isSessionMatchEnabled(): boolean {
  return vscode.workspace
    .getConfiguration()
    .get<boolean>("ayesman.sessionMatch", false);
}

function normalizeFileUri(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\/\//, ""))
    .toLowerCase()
    .replace(/\\/g, "/");
}

function currentWorkspacePaths(): Set<string> {
  const paths = (vscode.workspace.workspaceFolders ?? []).map((f) =>
    normalizeFileUri(f.uri.fsPath),
  );
  return new Set(paths);
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

  if (isSessionMatchEnabled()) {
    return discoverServerSession(procs);
  }
  return discoverServerGlobal(procs);
}

// Global mode (default): connect to the first server that responds to Heartbeat.
// No workspace matching — fast, works across all windows.
async function discoverServerGlobal(
  procs: ProcessInfo[],
): Promise<ServerInfo | undefined> {
  for (const proc of procs) {
    const csrfMatch = proc.cmdline.match(/--csrf_token\s+(\S+)/);
    if (!csrfMatch) {
      log(
        `[AYesMan] PID ${proc.pid}: no --csrf_token in cmdline, skipping`,
      );
      continue;
    }
    const csrfToken = csrfMatch[1];
    const ports = await platform.findListeningPorts(proc.pid);

    if (ports.length === 0) {
      log(
        `[AYesMan] PID ${proc.pid}: no listening ports found, skipping`,
      );
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
            `[AYesMan] Global mode: connected to ${proto}://127.0.0.1:${port}`,
          );
          return _cachedServerInfo;
        }
      }
    }
  }

  log("[AYesMan] Global mode: could not find any working gRPC port");
  return undefined;
}

// Session mode: match server to the current VS Code workspace via socket
// binding or trajectory workspace paths. Slower but correct when multiple
// Antigravity windows are open and isolation is desired.
async function discoverServerSession(
  procs: ProcessInfo[],
): Promise<ServerInfo | undefined> {
  const extHostPorts = new Set(
    await platform.findExtHostConnectedPorts(process.pid),
  );
  log(
    `[AYesMan] ExtHost (PID ${process.pid}) connected to potential ports: ${Array.from(extHostPorts).join(",")}`,
  );

  for (const proc of procs) {
    const csrfMatch = proc.cmdline.match(/--csrf_token\s+(\S+)/);
    if (!csrfMatch) {
      log(
        `[AYesMan] PID ${proc.pid}: no --csrf_token in cmdline, skipping`,
      );
      continue;
    }
    const csrfToken = csrfMatch[1];
    const ports = await platform.findListeningPorts(proc.pid);

    if (ports.length === 0) {
      log(
        `[AYesMan] PID ${proc.pid}: no listening ports found, skipping`,
      );
      continue;
    }

    log(
      `[AYesMan] LS PID=${proc.pid}, CSRF=${csrfToken.substring(0, 8)}..., ports=${ports.join(",")}`,
    );

    const wsPaths = currentWorkspacePaths();

    for (const port of ports) {
      for (const useHttps of [true, false]) {
        const proto = useHttps ? "https" : "http";
        const ok = await probePort(port, csrfToken, useHttps);
        log(
          `[AYesMan] PID ${proc.pid} port=${port} ${proto} probe=${ok ? "OK" : "FAIL"}`,
        );

        if (!ok) continue;

        const serverInfo = { port, csrfToken, useHttps };
        try {
          const allTrajs = await callGrpc(
            serverInfo,
            "GetAllCascadeTrajectories",
            {},
          );
          const summaries: Record<string, unknown> =
            (allTrajs as Record<string, unknown>)
              ?.trajectorySummaries as Record<string, unknown> ?? {};

          // 1. Direct Socket Binding — only single-process or extHost socket match
          let isMatch = procs.length === 1 || extHostPorts.has(port);

          // 2. Fallback: Workspace Path Matching (multi-process, no socket match)
          if (!isMatch && procs.length > 1) {
            let hasAnyBoundWorkspaces = false;
            let hasMatchingWorkspace = false;

            for (const s of Object.values(summaries)) {
              const cascadeWorkspaces: unknown[] =
                (s as Record<string, unknown>)?.workspaces as unknown[] ?? [];
              if (cascadeWorkspaces.length > 0) {
                hasAnyBoundWorkspaces = true;
                const overlaps = cascadeWorkspaces.some((w) => {
                  const p = normalizeFileUri(
                    (w as Record<string, string>)
                      ?.workspaceFolderAbsoluteUri ?? "",
                  );
                  return wsPaths.has(p);
                });
                if (overlaps) hasMatchingWorkspace = true;
              }
            }

            // When at least one server has bound workspaces, require an exact match.
            // When no server has bound workspaces, accept only if this is the sole
            // candidate — avoids mis-matching in multi-server scenarios.
            isMatch =
              hasMatchingWorkspace ||
              (!hasAnyBoundWorkspaces && procs.length === 1);
          }

          const hasExtHostSocket = extHostPorts.has(port);
          log(
            `[AYesMan] PID ${proc.pid} port=${port}: workspace match=${isMatch}, extHostSocket=${hasExtHostSocket}`,
          );

          if (isMatch) {
            setCachedServerInfo(serverInfo);
            log(
              `[AYesMan] Session mode: matched gRPC (connected=${hasExtHostSocket}) at ${proto}://127.0.0.1:${port}`,
            );
            return _cachedServerInfo;
          } else {
            log(`[AYesMan] Failed gRPC matching for port ${port}`);
          }
        } catch (err: unknown) {
          log(
            `[AYesMan] Failed to verify grpc on port ${port}: ${(err as Error).message}`,
          );
        }
      }
    }
  }

  log(
    "[AYesMan] Session mode: could not find matching gRPC port for this workspace",
  );
  return undefined;
}
