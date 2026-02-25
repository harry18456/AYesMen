import { exec } from "child_process";
import { promisify } from "util";
import type { ProcessInfo } from "../../types/index.js";
import { log } from "../../logger.js";

const execAsync = promisify(exec);

// Short-lived cache so multiple calls within the same discoverServer()
// execution share one netstat output instead of spawning repeated processes.
let _netstatCache: { data: string; ts: number } | undefined;

async function getNetstatData(): Promise<string> {
  const now = Date.now();
  if (_netstatCache && now - _netstatCache.ts < 2000) {
    return _netstatCache.data;
  }
  const { stdout } = await execAsync("netstat -ano", { timeout: 10000 });
  _netstatCache = { data: stdout, ts: now };
  return stdout;
}

export async function findLanguageServerProcesses(): Promise<ProcessInfo[]> {
  try {
    const { stdout } = await execAsync(
      'powershell -Command "Get-CimInstance Win32_Process -Filter \\"name LIKE \'language_server%\'\\" | ForEach-Object { Write-Output \\"$($_.ProcessId)::::$($_.ParentProcessId)::::$($_.CommandLine)\\" }"',
      { timeout: 10000 },
    );
    const lines = stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const processes: ProcessInfo[] = [];
    for (const line of lines) {
      const parts = line.split("::::");
      if (parts.length >= 3) {
        const pid = parseInt(parts[0], 10);
        const parentPid = parseInt(parts[1], 10);
        const cmdline = parts.slice(2).join("::::");
        if (pid && cmdline) {
          processes.push({
            pid,
            cmdline,
            parentPid: isNaN(parentPid) ? undefined : parentPid,
          });
        }
      }
    }
    return processes;
  } catch (err: unknown) {
    log(`[AYesMan] findLanguageServerProcesses error: ${(err as Error).message}`);
    return [];
  }
}

// Uses netstat -ano instead of Get-NetTCPConnection to avoid privilege
// issues that cause the PowerShell cmdlet to silently return nothing
// when called from a non-elevated Extension Host process.
//
// Uses field-splitting instead of a single regex to handle variable spacing
// across different Windows versions. Supports both IPv4 and IPv6.
export async function findListeningPorts(pid: number): Promise<number[]> {
  try {
    const stdout = await getNetstatData();
    const seen = new Set<number>();
    const ports: number[] = [];
    for (const line of stdout.split(/\r?\n/)) {
      // Expected: TCP  0.0.0.0:57213  0.0.0.0:0  LISTENING  60084
      // Also:     TCP  [::]:57213     [::]:0     LISTENING  60084  (IPv6)
      const parts = line.trim().split(/\s+/);
      if (
        parts.length < 5 ||
        parts[0].toUpperCase() !== "TCP" ||
        parts[3].toUpperCase() !== "LISTENING"
      ) {
        continue;
      }
      const linePid = parseInt(parts[4], 10);
      if (isNaN(linePid) || linePid !== pid) continue;
      // Extract port from local address (last colon-delimited segment)
      const portMatch = parts[1].match(/:(\d+)$/);
      if (!portMatch) continue;
      const port = parseInt(portMatch[1], 10);
      if (!seen.has(port)) {
        seen.add(port);
        ports.push(port);
      }
    }
    return ports;
  } catch (err: unknown) {
    log(`[AYesMan] findListeningPorts(${pid}) error: ${(err as Error).message}`);
    return [];
  }
}

// Finds ports that process `pid` (ExtHost) is connected to via TCP ESTABLISHED.
// Supports both IPv4 (127.0.0.1) and IPv6 ([::1]) loopback addresses.
export async function findExtHostConnectedPorts(pid: number): Promise<number[]> {
  try {
    const stdout = await getNetstatData();
    const seen = new Set<number>();
    const ports: number[] = [];
    for (const line of stdout.split(/\r?\n/)) {
      // Expected: TCP  127.0.0.1:54321  127.0.0.1:57213  ESTABLISHED  25128
      // Also:     TCP  [::1]:54321      [::1]:57213      ESTABLISHED  25128
      const parts = line.trim().split(/\s+/);
      if (
        parts.length < 5 ||
        parts[0].toUpperCase() !== "TCP" ||
        parts[3].toUpperCase() !== "ESTABLISHED"
      ) {
        continue;
      }
      const linePid = parseInt(parts[4], 10);
      if (isNaN(linePid) || linePid !== pid) continue;
      // Extract port from foreign/remote address — must be a loopback target
      const remoteMatch = parts[2].match(/(?:127\.0\.0\.1|\[::1\]):(\d+)$/);
      if (!remoteMatch) continue;
      const port = parseInt(remoteMatch[1], 10);
      if (!seen.has(port)) {
        seen.add(port);
        ports.push(port);
      }
    }
    return ports;
  } catch (err: unknown) {
    log(`[AYesMan] findExtHostConnectedPorts(${pid}) error: ${(err as Error).message}`);
    return [];
  }
}
