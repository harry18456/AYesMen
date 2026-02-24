## MODIFIED Requirements

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

