import * as http from "http";
import * as http2 from "http2";
import type { ServerInfo } from "../types/index.js";
import { loadAntigravityCert } from "./cert.js";

// Module-level HTTP/2 session for the LS (TLS), reused across callGrpc() calls.
// Recreated when server info changes or session is closed/errored.
let _session: http2.ClientHttp2Session | undefined;
let _sessionKey = ""; // "<port>:<csrfToken>"

function sessionKey(server: ServerInfo): string {
  return `${server.port}:${server.csrfToken}`;
}

function getOrCreateSession(server: ServerInfo): http2.ClientHttp2Session {
  const key = sessionKey(server);
  if (_session && !_session.destroyed && _sessionKey === key) {
    return _session;
  }

  // Close old session if server changed
  if (_session && !_session.destroyed) {
    _session.destroy();
  }

  const ca = loadAntigravityCert();
  const options: http2.SecureClientSessionOptions = ca
    ? { ca }
    : { rejectUnauthorized: false };

  const session = http2.connect(`https://127.0.0.1:${server.port}`, options);

  // On any terminal event, mark session as dead so it's recreated next call.
  const invalidate = () => {
    if (_session === session) {
      _session = undefined;
      _sessionKey = "";
    }
  };
  session.on("error", invalidate);
  session.on("close", invalidate);
  session.on("goaway", invalidate);

  _session = session;
  _sessionKey = key;
  return session;
}

export function closeGrpcSession(): void {
  if (_session && !_session.destroyed) {
    _session.destroy();
  }
  _session = undefined;
  _sessionKey = "";
}

// Shared HTTP/1.1 request builder for Connect protocol calls.
function httpPost(
  hostname: string,
  port: number,
  servicePath: string,
  method: string,
  csrfToken: string,
  body: unknown,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const req = http.request(
      {
        hostname,
        port,
        path: `/${servicePath}/${method}`,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-codeium-csrf-token": csrfToken,
          "connect-protocol-version": "1",
          "content-length": String(data.byteLength),
        },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk: Buffer) => {
          responseBody += chunk.toString();
        });
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(responseBody));
            } catch {
              reject(
                new Error(`Invalid JSON response: ${responseBody.slice(0, 200)}`),
              );
            }
          } else {
            const truncated =
              responseBody.slice(0, 200) +
              (responseBody.length > 200 ? "..." : "");
            reject(new Error(`HTTP ${res.statusCode}: ${truncated}`));
          }
        });
      },
    );
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// Calls a LanguageServerService method on the LS HTTP port (plain HTTP/1.1).
// This is the LS's second port (httpPort from daemon JSON), which may serve
// cascade/quota methods that are not available on the HTTPS port.
export function callLsHttpGrpc(
  server: ServerInfo,
  method: string,
  body: unknown = {},
): Promise<unknown> {
  if (!server.httpPort) {
    return Promise.reject(
      new Error("LS httpPort not available (daemon JSON not found for this PID)"),
    );
  }
  return httpPost(
    "127.0.0.1",
    server.httpPort,
    "exa.language_server_pb.LanguageServerService",
    method,
    server.csrfToken,
    body,
  );
}


export function callGrpc(
  server: ServerInfo,
  method: string,
  body: unknown = {},
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let session: http2.ClientHttp2Session;
    try {
      session = getOrCreateSession(server);
    } catch (err) {
      reject(err);
      return;
    }

    const data = Buffer.from(JSON.stringify(body));
    const req = session.request({
      ":method": "POST",
      ":path": `/exa.language_server_pb.LanguageServerService/${method}`,
      "content-type": "application/json",
      "x-codeium-csrf-token": server.csrfToken,
      "connect-protocol-version": "1",
      "content-length": String(data.byteLength),
    });

    req.setTimeout(10000, () => {
      req.close(http2.constants.NGHTTP2_CANCEL);
      reject(new Error("Timeout"));
    });

    req.on("error", reject);

    let responseBody = "";
    let statusCode: number | undefined;

    req.on("response", (headers) => {
      statusCode = headers[":status"] as number | undefined;
    });

    req.on("data", (chunk: Buffer) => {
      responseBody += chunk.toString();
    });

    req.on("end", () => {
      if (statusCode === 200) {
        try {
          resolve(JSON.parse(responseBody));
        } catch {
          reject(
            new Error(`Invalid JSON response: ${responseBody.slice(0, 200)}`),
          );
        }
      } else {
        const truncated =
          responseBody.slice(0, 200) + (responseBody.length > 200 ? "..." : "");
        reject(new Error(`HTTP ${statusCode}: ${truncated}`));
      }
    });

    req.write(data);
    req.end();
  });
}
