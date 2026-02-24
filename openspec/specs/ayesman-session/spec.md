# Spec: AYesMan Session 機制行為規範

## Purpose

Manage Language Server discovery, session matching, and cache lifecycle. Ensures each VS Code window connects to the correct Antigravity Language Server when multiple projects are open simultaneously, handles server restarts gracefully, and provides fallback behavior when no server is found.
## Requirements
### Requirement: 支援多專案視窗平行運作

AYesMan MUST connect exclusively to the Language Server belonging to the current VS Code window when multiple projects are open simultaneously. 系統 SHALL 精準連線到專屬於該視窗正在執行的 Language Server。

會話模式（`ayesman.sessionMatch: true`）下的後備邏輯 SHALL 遵守以下規則：
- 若多個 Server 中，至少一個有綁定的工作區（`hasAnyBoundWorkspaces = true`），則只選擇其工作區路徑與當前視窗路徑重疊的 Server；若無吻合，返回 undefined。
- 若所有 Server 皆無綁定工作區（`hasAnyBoundWorkspaces = false`），則只在「只有一個候選 Server」時接受，否則返回 undefined（避免多 Server 場景誤匹配）。

#### Scenario: 多視窗精準匹配
- **WHEN** 使用者同時開啟了 "專案 A" 與 "專案 B" 兩個視窗
- **WHEN** 在 "專案 B" 視窗下觸發 AYesMan 輪詢或指令
- **THEN** AYesMan 必須掃描系統中所有的 Language Server，並只綁定其 `userStatus.cascadeModelConfigData.workspaces` 含有 "專案 B" 路徑的 Server

#### Scenario: 多伺服器無綁定工作區時返回 undefined
- **WHEN** 系統中有多個 Language Server 候選，但所有候選均無綁定工作區
- **THEN** 會話模式 SHALL 返回 undefined，不誤匹配任何 Server，等待下一次探索週期

#### Scenario: 單伺服器無綁定工作區時接受
- **WHEN** 系統中只有一個 Language Server 候選且無綁定工作區
- **THEN** 會話模式 SHALL 接受該 Server 作為連線目標

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

