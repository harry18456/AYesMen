import * as https from "https";
import * as http from "http";

export function probePort(
  port: number,
  csrfToken: string,
  useHttps: boolean,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const options: https.RequestOptions = {
      hostname: "127.0.0.1",
      port,
      path: "/exa.language_server_pb.LanguageServerService/Heartbeat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-codeium-csrf-token": csrfToken,
        "Connect-Protocol-Version": "1",
      },
      timeout: 2000,
      rejectUnauthorized: false,
    };

    const makeReq = useHttps ? https.request : http.request;
    const req = makeReq(options, (res) => {
      res.on("data", () => {}); // drain
      res.on("end", () => resolve(res.statusCode === 200));
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.write("{}");
    req.end();
  });
}
