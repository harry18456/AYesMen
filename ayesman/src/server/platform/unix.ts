import { exec } from "child_process";
import { promisify } from "util";
import type { ProcessInfo } from "../../types/index.js";

const execAsync = promisify(exec);

export async function findLanguageServerProcesses(): Promise<ProcessInfo[]> {
  try {
    const { stdout } = await execAsync(
      "ps aux | grep 'language_server' | grep -v grep",
      { timeout: 10000 },
    );
    if (!stdout.trim()) return [];
    const lines = stdout
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const processes: ProcessInfo[] = [];
    // ps aux columns: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND...
    for (const line of lines) {
      const parts = line.split(/\s+/);
      const pid = parseInt(parts[1], 10);
      const cmdline = parts.slice(10).join(" ");
      if (pid && cmdline) {
        processes.push({ pid, cmdline });
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
      `lsof -i -n -P -p ${pid} 2>/dev/null | grep LISTEN`,
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

export async function findExtHostConnectedPorts(pid: number): Promise<number[]> {
  try {
    const { stdout } = await execAsync(
      `lsof -iTCP -sTCP:ESTABLISHED -n -P -p ${pid} 2>/dev/null`,
      { timeout: 10000 },
    );
    const ports: number[] = [];
    for (const line of stdout.split("\n")) {
      const match = line.match(/->(?:127\.0\.0\.1|localhost):(\d+)/);
      if (match) ports.push(parseInt(match[1], 10));
    }
    return ports;
  } catch {
    return [];
  }
}
