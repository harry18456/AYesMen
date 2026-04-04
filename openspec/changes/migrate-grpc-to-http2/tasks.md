## 1. 從 Antigravity 安裝目錄載入 cert.pem

- [x] [P] 1.1 在 `src/server/` 新增 `cert.ts` 模組，實作 `loadAntigravityCert(): Buffer | undefined`，從 Antigravity 安裝目錄載入 cert.pem。Windows 路徑: `%LOCALAPPDATA%/Programs/Antigravity/resources/app/extensions/antigravity/dist/languageServer/cert.pem`，macOS 路徑: `/Applications/Antigravity.app/Contents/Resources/app/extensions/antigravity/dist/languageServer/cert.pem`。找不到時回傳 `undefined`

## 2. 核心 Transport 重寫

- [x] 2.1 使用 Node.js 內建 `http2` 模組取代 `http`/`https`：重寫 `src/server/grpc.ts` 的 `callGrpc()` 函式，將 `http.request`/`https.request` 替換為 `http2.connect()` + `session.request()`。使用 `loadAntigravityCert()` 的結果作為 `ca` 選項，若為 `undefined` 則 fallback 至 `rejectUnauthorized: false`。保持 JSON 編碼，不使用 Protobuf binary（`Content-Type: application/json`），保留 `x-codeium-csrf-token` 和 `Connect-Protocol-Version: 1` headers
- [x] 2.2 實作 HTTP/2 session 管理（HTTP/2 session lifecycle management）：在 `grpc.ts` 中維護 module-level session 變數，複用於多次 `callGrpc()` 呼叫。監聽 `close`、`error`、`goaway` 事件自動將 session 設為 `undefined`，下次呼叫時重建。當 `ServerInfo`（port / csrfToken）與目前 session 不符時，關閉舊 session 並建立新的

## 3. Probe 遷移

- [x] 3.1 重寫 `src/server/probe.ts` 的 `probePort()` 函式以支援多專案視窗平行運作：從 `https.request` 遷移至 `http2.connect()` + `session.request()`。使用 `loadAntigravityCert()` 載入憑證，Heartbeat POST 路徑不變（`/exa.language_server_pb.LanguageServerService/Heartbeat`）。probe 完成後關閉 session（probe 是一次性的，不需複用）

## 4. Server Discovery 簡化與 Language Server Discovery 更新

- [x] 4.1 更新 Language Server Discovery：修改 `src/server/discovery.ts`，移除 HTTP/HTTPS 雙重嘗試邏輯（`for (const useHttps of [true, false])` 迴圈），固定只走 HTTPS + HTTP/2。`probePort()` 簽名移除 `useHttps` 參數
- [x] 4.2 從 `src/types/index.ts` 的 `ServerInfo` 移除 `useHttps` 欄位，更新所有使用 `ServerInfo.useHttps` 的程式碼（`grpc.ts`、`discovery.ts`）
- [x] 4.3 實作斷線重連機制 (Cache Invalidation) 的 HTTP/2 整合：修改 `clearCachedServerInfo()` 以連帶關閉 `grpc.ts` 中的 HTTP/2 session（新增一個 `closeGrpcSession()` export 供 `discovery.ts` 呼叫），確保斷線重連時正確釋放資源

## 5. 驗證與修正

- [x] 5.1 執行 `npm run compile` 確認無 TypeScript 編譯錯誤
- [x] 5.2 執行 `npm run package` 確認 esbuild 打包成功
- [x] 5.3 初次部署驗證：probe=OK（HTTP/2 transport 正常），但 quota/cascade 方法回傳 HTTP 501 — LS 只實作 Heartbeat/GetStatus/Exit/ReconnectExtensionServer
- [x] 5.4 根本原因分析：Antigravity v1.19.4 已將 cascade/quota 方法移至 Extension Server（在 VS Code extension host 內部執行，監聽 `--extension_server_port`），LS 不再實作這些方法

## 6. Extension Server 整合

- [x] 6.1 在 `src/types/index.ts` 的 `ServerInfo` 新增 `extensionServerPort?: number` 和 `extensionServerCsrfToken?: string` 欄位
- [x] 6.2 在 `src/server/discovery.ts` 的 `probeProcesses()` 解析 LS cmdline 中的 `--extension_server_port` 和 `--extension_server_csrf_token`，存入 `ServerInfo`
- [x] 6.3 在 `src/server/grpc.ts` 新增 `callExtensionGrpc()` 函式（HTTP/1.1，extension host 不使用 TLS 或 h2c）；extension server 無需 session 管理
- [x] 6.4 更新 `src/quota/fetch.ts`：`GetCascadeModelConfigs`、`GetCommandModelConfigs` 改用 `callExtensionGrpc`
- [x] 6.5 更新 `src/autoAccept/acceptStep.ts`：`GetAllCascadeTrajectories`、`GetCascadeTrajectorySteps`、`HandleCascadeUserInteraction` 改用 `callExtensionGrpc`
- [x] 6.6 執行 `npm run compile` + `npm run package` 確認無錯誤

## 7. 最終驗證

- [x] 7.1 確認 extension server port 從 LS cmdline 解析成功（`Extension server port=XXXXX found in cmdline`）
- [x] 7.2 Extension server 返回 HTTP 404（不服務 LanguageServerService 路徑）— 方向錯誤
- [x] 7.3 發現 daemon JSON（`~/.gemini/antigravity/daemon/ls_*.json`）包含 httpsPort + httpPort + lspPort + csrfToken；LS httpPort = httpsPort+1（fallback）
- [x] 7.4 確認正確 API 端點：LS httpPort（HTTP/1.1）服務 GetUserStatus、GetCascadeModelConfigs；GetCommandModelConfigs 返回 501（不影響）
- [x] 7.5 修正 `fetch.ts`：改用 `GetUserStatus` on httpPort，解析 `userStatus.cascadeModelConfigData.clientModelConfigs`；Part B 非致命
- [x] 7.6 Quota Dashboard 驗證成功：`Quota refreshed: 6 models` ✅
- [ ] 7.7 驗證 Auto-Accept 功能（`GetAllCascadeTrajectories`、`GetCascadeTrajectorySteps`、`HandleCascadeUserInteraction` 在 httpPort 正常）← 等待手動驗證
