## 1. 基礎設施：OutputChannel 取代 console.log

- [x] 1.1 在 `extension.ts` 建立全域 OutputChannel（名稱 "AYesMan"），並透過 export 函數 `getOutputChannel()` 供其他模組使用
- [x] 1.2 將 `extension.ts` 中的 `console.log` 替換為 `outputChannel.appendLine()`
- [x] 1.3 將 `loop.ts` 中的 `console.log` 替換為 `outputChannel.appendLine()`
- [x] 1.4 將 `acceptStep.ts` 中的 `console.log` 替換為 `outputChannel.appendLine()`
- [x] 1.5 確認所有其他 .ts 檔案不含 `console.log`

## 2. P0 邏輯漏洞修正

- [x] 2.1 `acceptStep.ts`：在計算 `proposedCmd` 後，若其為空字串則以 `continue` 跳過該步驟，不呼叫 HandleCascadeUserInteraction
- [x] 2.2 `platform/windows.ts`：修正 `findListeningPorts` 正規表達式，改用欄位切割（`line.split(/\s+/)` 加欄位索引）取代單一正規表達式貪婪匹配
- [x] 2.3 `discovery.ts`：修正會話模式後備邏輯 — 當 `hasAnyBoundWorkspaces = false` 時，只在候選伺服器數量為 1 時接受，否則返回 undefined

## 3. P1 邏輯與解析修正

- [x] 3.1 `platform/unix.ts`：修改 `findLanguageServerProcesses`，改為取 `parts[1]` 為 PID、`parts.slice(10).join(" ")` 為 cmdline，並在 `parts.length < 11` 時跳過該行
- [x] 3.2 `grpc.ts`：修改 JSON 解析邏輯，解析失敗時改為 `reject(new Error('Invalid JSON response: ...'))` 而非 `resolve(rawString)`
- [x] 3.3 `grpc.ts`：在非 200 狀態碼的錯誤訊息中，截斷 responseBody 至 200 字元（`responseBody.slice(0, 200) + (responseBody.length > 200 ? '...' : '')`）
- [x] 3.4 `loop.ts`：修改錯誤去重邏輯，以錯誤訊息的前 50 字元作為去重鍵，而非完整訊息字串

## 4. 跨平台 IPv6 支援

- [x] 4.1 `platform/unix.ts`：修改 `findExtHostConnectedPorts` 的正規表達式，同時匹配 `->127.0.0.1:port` 與 `->:::1:port` 或 `->localhost:port`（使用 `(?:127\.0\.0\.1|::1|localhost)`）
- [x] 4.2 `platform/windows.ts`：修改 `findExtHostConnectedPorts` 的正規表達式，同時匹配 `127.0.0.1` 與 `[::1]`（Windows netstat IPv6 格式為 `[::1]:port`）

## 5. 快取機制改進

- [x] 5.1 `discovery.ts`：在 `_cachedServerInfo` 物件中增加 `cachedAt: number` 時間戳欄位（或獨立變數）
- [x] 5.2 `discovery.ts`：在 `getCachedServerInfo()` 中加入 TTL 檢查（超過 5 分鐘則清除快取並返回 undefined）

## 6. 配額合併策略修正

- [x] 6.1 `fetch.ts`：修改配額合併邏輯，將「追加 newEntries」改為「完整重建」：每次抓取後以 GetUserStatus 的結果為基礎，再以 GetCommandModelConfigs 補充未包含的模型，形成完整新列表，替換舊的 `_latestQuota`

## 7. 狀態模組不可變性

- [x] 7.1 `state.ts`：修改 `getLatestQuota()` 返回 `[..._latestQuota]`（淺拷貝）而非直接返回 `_latestQuota` 的參考

## 8. 驗證與打包

- [x] 8.1 執行 `npm run compile`（或 `tsc --noEmit`）確認 TypeScript 無型別錯誤
- [x] 8.2 執行 `npm run package` 確認 esbuild 打包成功，`dist/extension.js` 正確產出
- [x] 8.3 在 Windows 環境手動測試：啟動 VS Code，確認 AYesMan 自動接受與配額顯示正常
- [x] 8.4 在 macOS 或 Linux 環境手動測試（若可用）：確認伺服器探索與自動接受正常
- [x] 8.5 將版本號從 `1.3.0` 升至 `1.4.0`（`package.json`）
