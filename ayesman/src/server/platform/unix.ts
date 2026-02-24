import { exec } from "child_process";
import { promisify } from "util";
import type { ProcessInfo } from "../../types/index.js";

const execAsync = promisify(exec);

export async function findLanguageServerProcesses(): Promise<ProcessInfo[]> {
  try {
    const { stdout } = await execAsync(
      "ps -eo pid,ppid,args | grep 'language_server' | grep -v grep",
      { timeout: 10000 },
    );
    if (!stdout.trim()) return [];
    const lines = stdout
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const processes: ProcessInfo[] = [];
    // ps -eo pid,ppid,args columns: PID(0) PPID(1) ARGS(2+)
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 3) continue;
      const pid = parseInt(parts[0], 10);
      const parentPid = parseInt(parts[1], 10);
      const cmdline = parts.slice(2).join(" ");
      if (pid && cmdline) {
        processes.push({
          pid,
          cmdline,
          parentPid: isNaN(parentPid) ? undefined : parentPid,
        });
      }
    }
    return processes;
  } catch {
    return [];
  }
}

export async function findListeningPorts(pid: number): Promise<number[]> {
  try {
    const { stdout } = await execAsync(
      `lsof -a -i -n -P -p ${pid} 2>/dev/null | grep LISTEN`,
      { timeout: 10000 },
    );
    const ports: number[] = [];
    for (const line of stdout.split("\n")) {
      const match = line.match(/:(\d+)\s+\(LISTEN\)/);
      if (match) ports.push(parseInt(match[1], 10));
    }
    return ports;
  } catch {
    return [];
  }
}

// Finds ports that process `pid` (ExtHost) is connected to via TCP ESTABLISHED.
// Supports both IPv4 (127.0.0.1) and IPv6 (::1) loopback addresses,
// as some Linux/macOS systems default to IPv6-first connections.
export async function findExtHostConnectedPorts(pid: number): Promise<number[]> {
  try {
    const { stdout } = await execAsync(
      `lsof -a -iTCP -sTCP:ESTABLISHED -n -P -p ${pid} 2>/dev/null`,
      { timeout: 10000 },
    );
    const ports: number[] = [];
    for (const line of stdout.split("\n")) {
      const match = line.match(/->(?:127\.0\.0\.1|::1|localhost):(\d+)/);
      if (match) ports.push(parseInt(match[1], 10));
    }
    return ports;
  } catch {
    return [];
  }
}
