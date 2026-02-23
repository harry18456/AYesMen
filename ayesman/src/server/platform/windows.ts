import { exec } from "child_process";
import { promisify } from "util";
import type { ProcessInfo } from "../../types/index.js";

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
      'powershell -Command "Get-CimInstance Win32_Process -Filter \\"name LIKE \'language_server%\'\\" | ForEach-Object { Write-Host $_.ProcessId; Write-Host $_.CommandLine }"',
      { timeout: 10000 },
    );
    const lines = stdout
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const processes: ProcessInfo[] = [];
    for (let i = 0; i < lines.length; i += 2) {
      const pid = parseInt(lines[i], 10);
      const cmdline = lines[i + 1];
      if (pid && cmdline) {
        processes.push({ pid, cmdline });
      }
    }
    return processes;
  } catch (err: unknown) {
    console.error(`[AYesMan] findLanguageServerProcesses error: ${(err as Error).message}`);
    return [];
  }
}

// Uses netstat -ano instead of Get-NetTCPConnection to avoid privilege
// issues that cause the PowerShell cmdlet to silently return nothing
// when called from a non-elevated Extension Host process.
export async function findListeningPorts(pid: number): Promise<number[]> {
  try {
    const stdout = await getNetstatData();
    const ports: number[] = [];
    for (const line of stdout.split(/\r?\n/)) {
      // e.g. "  TCP    0.0.0.0:57213    0.0.0.0:0    LISTENING    60084"
      const match = line.match(/\bTCP\b\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/i);
      if (match && parseInt(match[2], 10) === pid) {
        ports.push(parseInt(match[1], 10));
      }
    }
    return ports;
  } catch (err: unknown) {
    console.error(`[AYesMan] findListeningPorts(${pid}) error: ${(err as Error).message}`);
    return [];
  }
}

export async function findExtHostConnectedPorts(pid: number): Promise<number[]> {
  try {
    const stdout = await getNetstatData();
    const ports: number[] = [];
    for (const line of stdout.split(/\r?\n/)) {
      // e.g. "  TCP    127.0.0.1:54321    127.0.0.1:57213    ESTABLISHED    25128"
      const match = line.match(/\bTCP\b\s+\S+:\d+\s+127\.0\.0\.1:(\d+)\s+ESTABLISHED\s+(\d+)/i);
      if (match && parseInt(match[2], 10) === pid) {
        ports.push(parseInt(match[1], 10));
      }
    }
    return ports;
  } catch (err: unknown) {
    console.error(`[AYesMan] findExtHostConnectedPorts(${pid}) error: ${(err as Error).message}`);
    return [];
  }
}
