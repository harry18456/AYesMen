import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CERT_RELATIVE = "resources/app/extensions/antigravity/dist/languageServer/cert.pem";

function getAntigravityCertPath(): string | undefined {
  switch (process.platform) {
    case "win32": {
      const localAppData = process.env["LOCALAPPDATA"];
      if (!localAppData) return undefined;
      return path.join(localAppData, "Programs", "Antigravity", CERT_RELATIVE);
    }
    case "darwin":
      return path.join("/Applications", "Antigravity.app", "Contents", CERT_RELATIVE);
    case "linux": {
      // Try common Linux installation paths
      const home = os.homedir();
      const candidates = [
        path.join(home, ".local", "share", "antigravity", CERT_RELATIVE),
        path.join("/opt", "antigravity", CERT_RELATIVE),
        path.join("/usr", "share", "antigravity", CERT_RELATIVE),
      ];
      return candidates.find((p) => {
        try {
          fs.accessSync(p);
          return true;
        } catch {
          return false;
        }
      });
    }
    default:
      return undefined;
  }
}

let _cachedCert: Buffer | null | undefined = undefined; // undefined = not yet loaded

export function loadAntigravityCert(): Buffer | undefined {
  if (_cachedCert !== undefined) {
    return _cachedCert ?? undefined;
  }

  const certPath = getAntigravityCertPath();
  if (!certPath) {
    _cachedCert = null;
    return undefined;
  }

  try {
    _cachedCert = fs.readFileSync(certPath);
    return _cachedCert;
  } catch {
    _cachedCert = null;
    return undefined;
  }
}
