## 1. 型別擴充

- [x] 1.1 在 `types/index.ts` 的 `ProcessInfo` 加入 `parentPid?: number` 欄位

## 2. Platform 層：windows.ts

- [x] 2.1 修改 `findLanguageServerProcesses()` PowerShell 指令，加入 `ParentProcessId` 輸出
- [x] 2.2 解析 `ParentProcessId` 並填入 `ProcessInfo.parentPid`

## 3. Platform 層：unix.ts

- [x] 3.1 將 `ps aux` 改為 `ps -eo pid,ppid,args`，調整欄位解析（pid=col1, ppid=col2, cmd=col3+）
- [x] 3.2 解析 ppid 並填入 `ProcessInfo.parentPid`

## 4. Discovery：parentPid Session Matching

- [x] 4.1 在 `discovery.ts` 新增 parentPid 過濾邏輯：`procs.filter(p => p.parentPid === process.pid)`
- [x] 4.2 有過濾結果時直接走 global-style probe（不呼叫 GetAllCascadeTrajectories）
- [x] 4.3 過濾後無結果或 parentPid 全為 undefined 時 fallback 到原 global mode
- [x] 4.4 移除 `isSessionMatchEnabled()` 及 `discoverServerSession()` 函式（包含 gRPC workspace path 邏輯）
- [x] 4.5 移除 `package.json` 中 `ayesman.sessionMatch` configuration contribution

## 5. Auto-Accept：In-Memory State

- [x] 5.1 在 `extension.ts` 加入 module-level `let _autoAcceptEnabled = true`
- [x] 5.2 將 `getAutoAcceptEnabled()` 改為直接回傳 `_autoAcceptEnabled`（移除對 `vscode.workspace.getConfiguration()` 的讀取）
- [x] 5.3 將 `toggleAutoAccept` command 改為直接修改 `_autoAcceptEnabled`（移除 `getConfiguration().update()` 呼叫及 `ConfigurationTarget.Global`）
- [x] 5.4 移除 `onDidChangeConfiguration` 監聽器（不再需要同步外部設定變更）

## 6. 清理

- [x] 6.1 確認 `acceptStep.ts` 透過 `_getAutoAcceptEnabled()` callback 取得狀態，無直接讀取 config（應已正確，確認即可）
- [x] 6.2 從 `package.json` 的 `contributes.configuration` 移除 `ayesman.sessionMatch` 屬性定義
