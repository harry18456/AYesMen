## MODIFIED Requirements

### Requirement: 支援多專案視窗平行運作

AYesMan MUST connect exclusively to the Language Server belonging to the current VS Code window when multiple projects are open simultaneously.

Session 匹配 SHALL 以 parentPid 策略為預設：

- 若 `ProcessInfo.parentPid` 可用，系統 SHALL 只考慮 `parentPid === process.pid` 的 Language Server process
- 若過濾後有候選 LS，直接對其 probe port，不發任何 gRPC workspace 比對呼叫
- 若 `parentPid` 不可用（undefined）或過濾後無候選，系統 SHALL fallback 到 workspace mode 或 global mode（第一個可 probe 通的 LS）

Server discovery SHALL use HTTPS with HTTP/2 exclusively. The `ServerInfo` type SHALL NOT include a `useHttps` field — all connections MUST use HTTPS over HTTP/2.

The probe mechanism (`probePort`) SHALL use the Node.js `http2` module (`http2.connect()`) to send the `Heartbeat` POST request over HTTP/2, instead of `http.request` or `https.request`.

TLS verification SHALL use Antigravity's self-signed certificate (`cert.pem`) loaded from the Antigravity installation directory. If the certificate file is not found, the system SHALL fall back to disabling certificate verification (`rejectUnauthorized: false`).

#### Scenario: parentPid 精準匹配
- **WHEN** 使用者同時開啟了視窗 A（ExtHost PID=59932）與視窗 B（ExtHost PID=90476）
- **WHEN** `findLanguageServerProcesses()` 回傳兩個 LS，parentPid 分別為 59932 和 90476
- **WHEN** 視窗 A 的 AYesMan 執行 `discoverServer()`
- **THEN** 只對 parentPid=59932 的 LS 執行 HTTP/2 probe，不對另一個 LS 發出任何呼叫

#### Scenario: parentPid 不可用時 fallback global
- **WHEN** `findLanguageServerProcesses()` 回傳的 processes 中 `parentPid` 全為 undefined
- **THEN** `discoverServer()` fallback 到 global mode，對第一個可 probe 通的 LS 建立 HTTP/2 連線

#### Scenario: parentPid 過濾後無結果時 fallback global
- **WHEN** `findLanguageServerProcesses()` 回傳的 processes 中無任何 `parentPid === process.pid`
- **THEN** `discoverServer()` fallback 到 global mode

#### Scenario: Probe uses HTTP/2 with TLS certificate
- **WHEN** `probePort()` is called to validate a candidate Language Server port
- **THEN** it MUST establish an HTTP/2 session via `http2.connect()` with Antigravity's `cert.pem` as the CA certificate
- **THEN** it MUST send a POST request to `/exa.language_server_pb.LanguageServerService/Heartbeat`
- **THEN** it MUST resolve to `true` if the server responds with HTTP 200, `false` otherwise

#### Scenario: Certificate file not found
- **WHEN** `cert.pem` does not exist at the expected Antigravity installation path
- **THEN** the system SHALL fall back to `rejectUnauthorized: false` for TLS connections
- **THEN** server discovery SHALL still proceed normally

### Requirement: 斷線重連機制 (Cache Invalidation)

AYesMan MUST automatically re-discover the Language Server when it crashes, restarts, or changes its port, rather than staying permanently disconnected.

When the cached server info is cleared, the HTTP/2 session associated with the previous server MUST also be closed to release resources.

#### Scenario: 伺服器崩潰後重新連線
- **WHEN** 已綁定的 Language Server（Port 54321）崩潰或重啟，導致連線拒絕或 Timeout
- **THEN** AYesMan 清空快取並關閉 HTTP/2 session，在下一次 `fetchQuota` 或 `autoAcceptLoop` 中重新執行 `discoverServer`

#### Scenario: HTTP/2 session error triggers re-discovery
- **WHEN** the HTTP/2 session emits an `error` or `goaway` event
- **THEN** the system SHALL close the session, clear cached server info, and trigger re-discovery on the next poll cycle

## ADDED Requirements

### Requirement: HTTP/2 session lifecycle management

The gRPC transport layer SHALL maintain a single HTTP/2 session per active server connection, reused across all gRPC method calls (`callGrpc`).

The session SHALL be automatically recreated when:
- The cached `ServerInfo` changes (different port or csrfToken)
- The session is closed by the server (via `close` or `goaway` events)
- The session encounters an unrecoverable error

#### Scenario: Session reuse across multiple gRPC calls
- **WHEN** `callGrpc()` is called multiple times with the same server info
- **THEN** all calls MUST reuse the same HTTP/2 session without establishing new TLS handshakes

#### Scenario: Session recreation after server change
- **WHEN** `clearCachedServerInfo()` is called followed by a new `discoverServer()` that finds a different port
- **THEN** the old HTTP/2 session MUST be closed and a new session MUST be created for the new server

#### Scenario: Session recovery after goaway
- **WHEN** the HTTP/2 session receives a GOAWAY frame from the server
- **THEN** the session MUST be closed and a new session MUST be established on the next `callGrpc()` invocation
