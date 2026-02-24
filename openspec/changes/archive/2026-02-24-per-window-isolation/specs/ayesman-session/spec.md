## MODIFIED Requirements

### Requirement: 支援多專案視窗平行運作

AYesMan MUST connect exclusively to the Language Server belonging to the current VS Code window when multiple projects are open simultaneously.

Session 匹配 SHALL 以 parentPid 策略為預設：

- 若 `ProcessInfo.parentPid` 可用，系統 SHALL 只考慮 `parentPid === process.pid` 的 Language Server process
- 若過濾後有候選 LS，直接對其 probe port，不發任何 gRPC workspace 比對呼叫
- 若 `parentPid` 不可用（undefined）或過濾後無候選，系統 SHALL fallback 到 global mode（第一個可 probe 通的 LS）

`ayesman.sessionMatch` 設定 SHALL 被廢棄，extension 不再讀取此設定。

#### Scenario: parentPid 精準匹配
- **WHEN** 使用者同時開啟了視窗 A（ExtHost PID=59932）與視窗 B（ExtHost PID=90476）
- **WHEN** `findLanguageServerProcesses()` 回傳兩個 LS，parentPid 分別為 59932 和 90476
- **WHEN** 視窗 A 的 AYesMan 執行 `discoverServer()`
- **THEN** 只對 parentPid=59932 的 LS 執行 probe，不對另一個 LS 發出任何呼叫

#### Scenario: parentPid 不可用時 fallback global
- **WHEN** `findLanguageServerProcesses()` 回傳的 processes 中 `parentPid` 全為 undefined
- **THEN** `discoverServer()` fallback 到 global mode，對第一個可 probe 通的 LS 建立連線

#### Scenario: parentPid 過濾後無結果時 fallback global
- **WHEN** `findLanguageServerProcesses()` 回傳的 processes 中無任何 `parentPid === process.pid`
- **THEN** `discoverServer()` fallback 到 global mode

## REMOVED Requirements

### Requirement: sessionMatch 設定控制會話模式

**Reason**: parentPid 匹配已成為預設策略，不需要額外的 feature flag；舊 gRPC workspace-path matching 邏輯一併移除

**Migration**: 移除 `ayesman.sessionMatch: true` 設定即可，新版本自動使用 parentPid matching
