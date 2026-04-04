## Context

AYesMan 透過 Connect protocol 與 Antigravity language server 溝通。目前的實作使用 Node.js `http`/`https` 模組發送 HTTP/1.1 JSON POST。新版 Antigravity 的 language server 改用 `@connectrpc/connect-node` 的 `createConnectTransport`，設定為 `httpVersion: "2"` + `useBinaryFormat: true`，並以自簽憑證 `cert.pem` 進行 TLS。

現有 `callGrpc()` 和 `probePort()` 需遷移至 HTTP/2 transport。`ServerInfo` 目前紀錄 `useHttps: boolean` 來區分 HTTP/HTTPS，遷移後固定為 HTTPS + HTTP/2，此欄位可能不再需要。

## Goals / Non-Goals

**Goals:**

- 恢復 Quota Dashboard 和 Auto-Accept 功能（修復 HTTP 501 錯誤）
- 使用 Node.js 內建 `http2` 模組實作 HTTP/2 transport
- 載入 Antigravity 的自簽憑證 `cert.pem` 進行正確的 TLS 驗證

**Non-Goals:**

- 不引入 `@connectrpc/connect` 或 protobuf 依賴
- 不更改 auto-accept 或 quota 的業務邏輯
- 不更改 server discovery 的三層優先級邏輯（parentPid → workspace_id → global）

## Decisions

### 使用 Node.js 內建 `http2` 模組取代 `http`/`https`

**選擇**: 使用 `node:http2` 的 `http2.connect()` 建立 HTTP/2 session，透過 `session.request()` 發送 POST。

**替代方案**:
- `@connectrpc/connect-node`: 完整的 Connect 框架，自帶 HTTP/2 transport 和 protobuf 序列化。但會大幅增加 bundle 大小和依賴數量，對一個輕量 VS Code extension 而言過度。
- `undici` (HTTP/2 support): Node.js 內建但 API 不如 `http2` 模組穩定且直接。

**理由**: `http2` 是 Node.js 標準模組、零外部依賴、API 成熟。VS Code Extension Host 運行的 Node.js 版本（≥18）完整支援 HTTP/2。

### 保持 JSON 編碼，不使用 Protobuf binary

**選擇**: 繼續使用 `Content-Type: application/json`，不實作 protobuf 序列化。

**理由**: Connect protocol 規範（connectrpc.com）要求 server 必須同時支援 JSON 和 binary 格式。新版 Antigravity 客戶端雖然選擇了 `useBinaryFormat: true`，但 server 端仍然應該接受 JSON。這讓我們保持零外部依賴、程式碼簡潔。

**風險**: 如果 Antigravity server 違反規範不接受 JSON，需要退回引入 protobuf。見 Risks 區段。

### 從 Antigravity 安裝目錄載入 cert.pem

**選擇**: 在 runtime 從 Antigravity extension 的 `dist/languageServer/cert.pem` 讀取自簽憑證，作為 `http2.connect()` 的 `ca` 選項。

**路徑解析**:
- Windows: `%LOCALAPPDATA%/Programs/Antigravity/resources/app/extensions/antigravity/dist/languageServer/cert.pem`
- macOS: `/Applications/Antigravity.app/Contents/Resources/app/extensions/antigravity/dist/languageServer/cert.pem`
- Linux: 需調查確認，暫以 `/usr/share/antigravity/` 或使用者安裝目錄為候選

**Fallback**: 如果 cert.pem 不存在或無法讀取，fallback 至 `rejectUnauthorized: false`（現有行為）。

### 移除 HTTP/HTTPS 雙重嘗試邏輯

**選擇**: 新版 Antigravity 固定使用 HTTPS + HTTP/2。移除 `discovery.ts` 中 `for (const useHttps of [true, false])` 的雙重嘗試，固定走 HTTPS。同時從 `ServerInfo` 移除 `useHttps` 欄位。

**理由**: 逆向分析確認新版 Antigravity 只使用 HTTPS (`baseUrl: https://...`)。保留 HTTP fallback 會增加不必要的複雜度和 probe 時間。

### HTTP/2 session 管理

**選擇**: 在 `grpc.ts` 中維護一個 module-level 的 HTTP/2 session，複用於多次 gRPC 呼叫。Session 在以下情況重建：
- Server info 變更（port / csrfToken 改變）
- Session 發生 error 或被 server 關閉
- `clearCachedServerInfo()` 被呼叫時一併關閉 session

**理由**: HTTP/2 的核心優勢就是連線複用。每次呼叫都重新 `http2.connect()` 會浪費 TLS 握手的開銷，且 auto-accept loop 每 500ms 呼叫一次，頻率很高。

## Risks / Trade-offs

**[Server 拒絕 JSON 格式]** → 如果 Antigravity server 不接受 `application/json`，需引入 protobuf 序列化。驗證方法：實作 HTTP/2 + JSON 後測試 `GetUserStatus`。若回 415 或 501，確認需要 binary。屆時可考慮引入 `@bufbuild/protobuf` 或手動構造 binary payload。

**[cert.pem 路徑跨平台差異]** → 不同 OS 的 Antigravity 安裝路徑不同。fallback 至 `rejectUnauthorized: false` 確保即使找不到憑證也不會崩潰。

**[HTTP/2 session 生命週期管理]** → session 可能因為 server 重啟、idle timeout 等原因被關閉。需監聽 `close`、`error`、`goaway` 事件並自動重建。

**[Antigravity 未來繼續變更 API]** → 這是逆向工程專案的固有風險。本次修復不會改變此風險的性質。
