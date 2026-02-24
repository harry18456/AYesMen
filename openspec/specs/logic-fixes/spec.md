# logic-fixes Specification

## Purpose
TBD - created by archiving change ayesman-logic-audit-multiplatform. Update Purpose after archive.
## Requirements
### Requirement: 防止接受空命令步驟
當 Language Server 回傳的步驟中 `proposedCommandLine` 與 `commandLine` 均為空字串或 undefined 時，自動接受程序 SHALL 跳過該步驟而不呼叫 `HandleCascadeUserInteraction`。

#### Scenario: 命令行為空時跳過
- **WHEN** `runCommand.proposedCommandLine` 與 `runCommand.commandLine` 均為空字串或 undefined
- **THEN** 該步驟被跳過，不呼叫 HandleCascadeUserInteraction，繼續掃描下一個步驟

#### Scenario: 命令行有值時正常接受
- **WHEN** `runCommand.proposedCommandLine` 或 `runCommand.commandLine` 至少有一個非空字串
- **THEN** 自動接受程序正常呼叫 HandleCascadeUserInteraction

### Requirement: gRPC 回應 JSON 解析失敗應拒絕
`callGrpc` 函數在收到 HTTP 200 但回應體 JSON 解析失敗時，SHALL `reject` 並附帶明確的錯誤訊息，而非 `resolve` 原始字串。

#### Scenario: 有效 JSON 回應
- **WHEN** HTTP 狀態碼為 200 且回應體為合法 JSON
- **THEN** `callGrpc` resolve 解析後的 JavaScript 物件

#### Scenario: 無效 JSON 回應
- **WHEN** HTTP 狀態碼為 200 但回應體無法解析為 JSON
- **THEN** `callGrpc` reject 並帶有 "Invalid JSON response" 錯誤訊息

### Requirement: 錯誤訊息長度限制
gRPC 呼叫失敗時的錯誤訊息（HTTP 非 200）SHALL 截斷回應體至最多 200 字元，避免超長錯誤訊息。

#### Scenario: 長回應體錯誤
- **WHEN** HTTP 狀態碼非 200 且回應體超過 200 字元
- **THEN** 錯誤訊息中的回應體部分截斷至 200 字元並附加 "..."

#### Scenario: 短回應體錯誤
- **WHEN** HTTP 狀態碼非 200 且回應體不超過 200 字元
- **THEN** 錯誤訊息包含完整的回應體

### Requirement: 自動接受錯誤去重以錯誤類型為鍵
自動接受迴圈 SHALL 使用錯誤的「類型或前綴」而非完整訊息字串進行去重，避免含動態值（例如 PID、時間）的錯誤訊息重複記錄。

#### Scenario: 相同類型的連續錯誤不重複記錄
- **WHEN** 連續多次輪詢都發生相同類型的錯誤（如連線拒絕），且只有動態值（如時間戳）不同
- **THEN** OutputChannel 只記錄一次，不重複輸出

#### Scenario: 錯誤類型切換時重新記錄
- **WHEN** 錯誤類型從「連線拒絕」切換為「逾時」
- **THEN** OutputChannel 記錄新的錯誤訊息

### Requirement: 狀態模組返回不可變副本
`getLatestQuota()` SHALL 返回陣列的淺拷貝而非直接參考，防止呼叫端意外修改全域狀態。

#### Scenario: 呼叫端修改返回值不影響全域狀態
- **WHEN** 呼叫 `getLatestQuota()` 並修改返回的陣列
- **THEN** 全域的 `_latestQuota` 陣列不受影響

### Requirement: 以 VS Code OutputChannel 取代 console.log
所有診斷訊息 SHALL 透過命名為 "AYesMan" 的 VS Code OutputChannel 輸出，不使用 `console.log`。

#### Scenario: 診斷訊息可在輸出面板查看
- **WHEN** 自動接受發生錯誤或伺服器探索記錄診斷資訊
- **THEN** 訊息出現在 VS Code 輸出面板的 "AYesMan" 頻道，而非開發者工具主控台

### Requirement: 跨平台 IPv6 loopback 支援（ExtHost 連接偵測）
`findExtHostConnectedPorts` 在 Windows 和 Unix 上 SHALL 同時識別 `127.0.0.1` 與 `::1` 作為合法的 loopback 目標，以支援 IPv6-first 的 Linux/macOS 環境。

#### Scenario: Unix 系統 IPv6 loopback 連接偵測
- **WHEN** Extension Host 透過 IPv6 loopback (`::1`) 連接到 Language Server
- **THEN** `findExtHostConnectedPorts` 在 Unix 平台正確回傳對應的埠號

#### Scenario: Windows 系統 IPv6 loopback 連接偵測
- **WHEN** Extension Host 透過 IPv6 loopback (`::1`) 連接到 Language Server
- **THEN** `findExtHostConnectedPorts` 在 Windows 平台正確回傳對應的埠號

### Requirement: Unix ps 輸出解析以欄位位置為基礎
`findLanguageServerProcesses` 在 Unix 平台 SHALL 基於 `ps aux` 輸出的固定欄位位置（PID 在第 2 欄，COMMAND 從第 11 欄起）解析，並在欄位數不足時跳過該行。

#### Scenario: 命令列含空格的程序正確解析
- **WHEN** Language Server 程序的命令列包含多個空格分隔的參數
- **THEN** PID 解析正確，完整命令列保留（不因空格切斷）

#### Scenario: 欄位數不足時跳過
- **WHEN** ps 輸出某行欄位數少於 11
- **THEN** 該行被跳過，不拋出異常

