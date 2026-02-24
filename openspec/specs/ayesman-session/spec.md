# Spec: AYesMan Session 機制行為規範

## Purpose

Manage Language Server discovery, session matching, and cache lifecycle. Ensures each VS Code window connects to the correct Antigravity Language Server when multiple projects are open simultaneously, handles server restarts gracefully, and provides fallback behavior when no server is found.
## Requirements
### Requirement: 支援多專案視窗平行運作

AYesMan MUST connect exclusively to the Language Server belonging to the current VS Code window when multiple projects are open simultaneously.

Session 匹配 SHALL 以 parentPid 策略為預設：

- 若 `ProcessInfo.parentPid` 可用，系統 SHALL 只考慮 `parentPid === process.pid` 的 Language Server process
- 若過濾後有候選 LS，直接對其 probe port，不發任何 gRPC workspace 比對呼叫
- 若 `parentPid` 不可用（undefined）或過濾後無候選，系統 SHALL fallback 到 global mode（第一個可 probe 通的 LS）

`ayesman.sessionMatch` 設定已廢棄，extension 不再讀取此設定。

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

### Requirement: 斷線重連機制 (Cache Invalidation)

AYesMan MUST automatically re-discover the Language Server when it crashes, restarts, or changes its port, rather than staying permanently disconnected.

#### Scenario: 伺服器崩潰後重新連線
- **WHEN** 已綁定的 Language Server（Port 54321）崩潰或重啟，導致連線拒絕或 Timeout
- **THEN** AYesMan 清空快取，並在下一次 `fetchQuota` 或 `autoAcceptLoop` 中重新執行 `discoverServer`

### Requirement: 健全的 Fallback 與提示

When no Language Server is found, AYesMan SHALL provide clear status feedback and retry on the next scheduled scan, rather than hanging indefinitely.

#### Scenario: 找不到伺服器時顯示狀態
- **WHEN** `discoverServer` 搜尋所有程序皆無法找到吻合的 Port
- **THEN** Status Bar 顯示 "AYesMan: Could not connect to Antigravity language server" 並維持無背景色，等待下一次定時掃描

### Requirement: 伺服器快取 TTL 保護

快取的伺服器連線資訊 SHALL 在超過 5 分鐘未更新時自動失效，強制下一次呼叫重新執行 `discoverServer`，以處理伺服器重啟但埠號不變的情境。

#### Scenario: 快取超時後重新探索
- **WHEN** 快取的伺服器資訊已存在超過 5 分鐘
- **THEN** 下一次呼叫 `discoverServer` 時忽略快取，重新掃描並探測

#### Scenario: 快取未超時時直接使用
- **WHEN** 快取的伺服器資訊存在且未超過 5 分鐘
- **THEN** 直接返回快取的 ServerInfo，不重新掃描

