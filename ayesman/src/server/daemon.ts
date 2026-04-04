import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface DaemonEntry {
  pid?: number;
  httpsPort?: number;
  httpPort?: number;
  lspPort?: number;
  csrfToken?: string;
}

function getDaemonDir(): string {
  return path.join(os.homedir(), ".gemini", "antigravity", "daemon");
}

// Read all ls_*.json daemon files and return the entry matching the given pid
// or csrfToken. Returns undefined if not found or on any error.
export function findLsDaemonEntry(
  pid: number,
  csrfToken?: string,
): DaemonEntry | undefined {
  try {
    const dir = getDaemonDir();
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("ls_") && f.endsWith(".json"));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dir, file), "utf-8");
        const entry = JSON.parse(content) as DaemonEntry;
        if (entry.pid === pid) return entry;
        if (csrfToken && entry.csrfToken === csrfToken) return entry;
      } catch {
        // ignore malformed files
      }
    }
  } catch {
    // ignore missing daemon dir
  }
  return undefined;
}
