## Why

AYesMan 在多個核心模組中存在邏輯漏洞與行為不正確的問題，包括會話模式誤匹配、空命令接受、Windows/Unix 平台特定解析錯誤、以及跨平台 IPv6 缺失支援。這些問題會導致自動接受功能在邊界情境下失效或產生非預期行為，需要系統性審查與修正。

## What Changes

- **修正** discovery.ts 會話模式後備邏輯過於寬鬆，多伺服器場景下可能誤匹配
- **修正** acceptStep.ts 允許接受命令為空字串的步驟
- **修正** platform/windows.ts netstat 正規表達式在多空格輸出時貪婪匹配失敗
- **修正** platform/unix.ts ps 輸出解析假設固定欄位，命令列含空格時索引錯位
- **修正** grpc.ts JSON 解析失敗時應 reject 而非返回原始字串
- **修正** loop.ts 錯誤去重只比較訊息字串，含動態值時會重複記錄
- **修正** fetch.ts cascadeConfigs 配額合併邏輯使用追加，可能累積舊資料
- **新增** platform/windows.ts 與 platform/unix.ts 支援 IPv6 loopback (::1) 探測
- **新增** state.ts 返回不可變副本而非直接陣列參考
- **移除** 生產程式碼中的 `console.log` 語句（改用 VS Code outputChannel）

## Capabilities

### New Capabilities

- `logic-fixes`: 修正所有已識別的邏輯漏洞，包括會話模式誤匹配、空命令接受、JSON 回應類型錯誤、錯誤去重失效、配額合併重複

### Modified Capabilities

- `ayesman-session`: 嚴格化會話模式後備邏輯，確保多伺服器場景下不會誤匹配；補充快取 TTL 機制
- `auto-accept`: 修正接受空命令的漏洞；修正步驟視窗數從 50 改回 spec 定義的值
- `quota-dashboard`: 修正配額合併邏輯（重新計算而非追加）

## Impact

- **ayesman/src/server/discovery.ts**: 會話模式後備邏輯、normalizeFileUri 改進
- **ayesman/src/server/platform/windows.ts**: netstat 正規表達式修正、IPv6 支援
- **ayesman/src/server/platform/unix.ts**: ps 解析策略改為欄位位置、IPv6 支援
- **ayesman/src/server/grpc.ts**: JSON 解析錯誤處理、回應體截斷保護
- **ayesman/src/autoAccept/acceptStep.ts**: 空命令防衛、步驟視窗正確化
- **ayesman/src/autoAccept/loop.ts**: 錯誤去重改進
- **ayesman/src/quota/fetch.ts**: 配額合併重新計算
- **ayesman/src/quota/state.ts**: 返回不可變副本
- **ayesman/src/extension.ts**: 移除 console.log，引入 outputChannel
