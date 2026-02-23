import * as https from "https";
import * as http from "http";
import type { ServerInfo } from "../types/index.js";

export function callGrpc(
  server: ServerInfo,
  method: string,
  body: unknown = {},
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: server.port,
      path: `/exa.language_server_pb.LanguageServerService/${method}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-codeium-csrf-token": server.csrfToken,
        "Connect-Protocol-Version": "1",
        "Content-Length": Buffer.byteLength(data),
      },
      timeout: 10000,
      ...(server.useHttps ? { rejectUnauthorized: false } : {}),
    };

    const makeReq = server.useHttps ? https.request : http.request;
    const req = makeReq(options, (res) => {
      let responseBody = "";
      res.on("data", (chunk: Buffer) => (responseBody += chunk.toString()));
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(responseBody));
          } catch {
            resolve(responseBody);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
    req.write(data);
    req.end();
  });
}
