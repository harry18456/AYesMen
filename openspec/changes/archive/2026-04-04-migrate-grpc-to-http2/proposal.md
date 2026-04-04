## Why

Antigravity 更新後，language server 的 Connect transport 從 HTTP/1.1 + JSON 升級為 HTTP/2 + Protobuf binary（`useBinaryFormat: true`, `httpVersion: "2"`）。現有的 `callGrpc()` 使用 Node.js `http`/`https` 模組發送 HTTP/1.1 JSON POST，所有業務 method（`GetUserStatus`、`GetAllCascadeTrajectories` 等）皆回傳 HTTP 501 `unimplemented`，Quota Dashboard 與 Auto-Accept 功能完全失效。唯獨 `Heartbeat`（空 payload）僥倖通過，導致 server discovery 正常但後續呼叫全部失敗。

## What Changes

- 將 `callGrpc()` 從 HTTP/1.1（`http.request`/`https.request`）遷移至 Node.js 內建 `http2` 模組
- 將 `probePort()` 同步遷移至 HTTP/2，確保 probe 與業務呼叫使用相同的 transport
- 優先嘗試 `Content-Type: application/json`（Connect 協議規範要求 server 必須支援 JSON），若 server 拒絕 JSON 則 fallback 至 `application/proto`（需引入 protobuf 序列化）
- 載入 Antigravity 自簽憑證 `cert.pem` 用於 TLS 驗證（取代 `rejectUnauthorized: false`）

## Non-Goals

- **不引入 `@connectrpc/connect` 套件** — 先以 Node.js 內建 `http2` 模組實作，避免引入大量依賴。若日後 Antigravity 再次變更協議，再評估引入完整 Connect 框架
- **不變更 API method 名稱或 service path** — 經逆向確認，service path `exa.language_server_pb.LanguageServerService` 及所有 method 名稱均未改變
- **不變更 auto-accept 或 quota 的業務邏輯** — 本次僅修復 transport 層，不調整輪詢間隔、重試策略或 UI 行為

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `ayesman-session`: server discovery 的 probe 機制需從 HTTP/1.1 遷移至 HTTP/2，TLS 憑證載入方式變更
- `quota-dashboard`: quota fetch 的 gRPC 呼叫需透過 HTTP/2 transport 進行
- `auto-accept`: auto-accept step 的 gRPC 呼叫需透過 HTTP/2 transport 進行

## Impact

- 受影響的程式碼：
  - `src/server/grpc.ts` — 核心 transport 重寫（HTTP/1.1 → HTTP/2）
  - `src/server/probe.ts` — probe 遷移至 HTTP/2
  - `src/server/discovery.ts` — 可能需調整 TLS 憑證路徑解析
- 受影響的 specs：`ayesman-session`、`quota-dashboard`、`auto-accept`
- 無新增外部依賴（使用 Node.js 內建 `http2` 模組）
