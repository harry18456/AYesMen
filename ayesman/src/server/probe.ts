import * as http2 from "http2";
import { loadAntigravityCert } from "./cert.js";

export function probePort(port: number, csrfToken: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const ca = loadAntigravityCert();
    const options: http2.SecureClientSessionOptions = ca
      ? { ca }
      : { rejectUnauthorized: false };

    let session: http2.ClientHttp2Session;
    try {
      session = http2.connect(`https://127.0.0.1:${port}`, options);
    } catch {
      resolve(false);
      return;
    }

    const cleanup = (result: boolean) => {
      if (!session.destroyed) session.destroy();
      resolve(result);
    };

    session.on("error", () => cleanup(false));
    session.setTimeout(2000, () => cleanup(false));

    const req = session.request({
      ":method": "POST",
      ":path": "/exa.language_server_pb.LanguageServerService/Heartbeat",
      "content-type": "application/json",
      "x-codeium-csrf-token": csrfToken,
      "connect-protocol-version": "1",
      "content-length": "2",
    });

    req.setTimeout(2000, () => cleanup(false));
    req.on("error", () => cleanup(false));

    let statusCode: number | undefined;
    req.on("response", (headers) => {
      statusCode = headers[":status"] as number | undefined;
    });

    req.on("data", () => {}); // drain
    req.on("end", () => cleanup(statusCode === 200));

    req.write("{}");
    req.end();
  });
}
