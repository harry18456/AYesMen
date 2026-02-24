## Why

目前 AYesMan 的 auto-accept 狀態存在 VS Code Global Settings，導致所有視窗共用同一份設定，無法做到各視窗獨立開關。Session 匹配（`ayesman.sessionMatch`）雖能對應正確的 Language Server，但須對每個 LS process 發出 gRPC call（`GetAllCascadeTrajectories`）才能比對 workspace 路徑，速度慢且預設關閉。

透過確認 Antigravity 在 Windows 上的 process tree，發現 language_server 的 parentPid 正是對應視窗的 Extension Host（`node.mojom.NodeService`）。`process.pid` 在 extension 內即等於 Extension Host PID，可直接以 `language_server.parentPid === process.pid` 精準匹配，不需要任何網路呼叫。

## What Changes

- 在 `ProcessInfo` 型別加入 `parentPid?: number` 欄位
- `platform/windows.ts`：`findLanguageServerProcesses` 額外回傳 `ParentProcessId`（PowerShell `Get-CimInstance` 已有此欄位）
- `platform/unix.ts`：改用 `ps -eo pid,ppid,args` 取得 PPID，同樣在 `findLanguageServerProcesses` 回傳
- `discovery.ts`：新增 parentPid 模式作為 session 匹配的預設策略，`parentPid` 可用時直接過濾，不需 gRPC workspace path 比對；移除或降級 `ayesman.sessionMatch` 設定
- `extension.ts` / `acceptStep.ts`：auto-accept 狀態改為 module-level in-memory variable（預設 `true`），每次 extension 啟動重置；移除對 `vscode.workspace.getConfiguration()` 的讀寫

## Capabilities

### New Capabilities

- （無新增 capability）

### Modified Capabilities

- `ayesman-session`：Session 匹配機制從 gRPC workspace path 比對改為 parentPid 直接匹配（快速、預設開啟）；`ayesman.sessionMatch` 設定廢棄
- `auto-accept`：Toggle 狀態改為 per-window in-memory，每次視窗啟動預設為 ON；不再讀寫 VS Code Global Settings

## Impact

- `ayesman/src/types/index.ts`：`ProcessInfo` 新增 `parentPid`
- `ayesman/src/server/platform/windows.ts`：`findLanguageServerProcesses` 回傳 parentPid
- `ayesman/src/server/platform/unix.ts`：`findLanguageServerProcesses` 改指令、回傳 parentPid
- `ayesman/src/server/discovery.ts`：新增 parentPid 過濾邏輯，簡化 session matching
- `ayesman/src/extension.ts`：移除 global setting 讀寫，改 in-memory state
- `ayesman/src/autoAccept/acceptStep.ts`：讀取 in-memory state 而非 VS Code config
- **Breaking**：`ayesman.sessionMatch` 設定移除（原本預設 false，新行為預設啟用 parentPid matching）
- **Breaking**：auto-accept 狀態不再持久化，重新開啟視窗一律恢復 ON
