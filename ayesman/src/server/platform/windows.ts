import { exec } from "child_process";
import { promisify } from "util";
import type { ProcessInfo } from "../../types/index.js";

const execAsync = promisify(exec);

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
  } catch {
    return [];
  }
}

export async function findListeningPorts(pid: number): Promise<number[]> {
  try {
    const { stdout } = await execAsync(
      `powershell -Command "Get-NetTCPConnection -OwningProcess ${pid} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort"`,
      { timeout: 10000 },
    );
    return stdout
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter((p) => !isNaN(p) && p > 0);
  } catch {
    return [];
  }
}

export async function findExtHostConnectedPorts(pid: number): Promise<number[]> {
  try {
    const { stdout } = await execAsync(
      `powershell -Command "$ErrorActionPreference = 'SilentlyContinue'; Get-NetTCPConnection -OwningProcess ${pid} -State Established | Select-Object -ExpandProperty RemotePort"`,
      { timeout: 10000 },
    );
    return stdout
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter((p) => !isNaN(p) && p > 0);
  } catch {
    return [];
  }
}
