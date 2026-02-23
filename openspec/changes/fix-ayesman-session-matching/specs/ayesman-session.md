# Spec: AYesMan Session 機制行為規範

## ADDED Requirements

### Requirement: 支援多專案視窗平行運作

AYesMan 必須能夠在使用者同時開啟多個 VS Code 或 Cursor 專案視窗時，精準連線到專屬於該視窗正在執行的 Language Server。

- **GIVEN** 使用者同時開啟了 "專案 A" 與 "專案 B" 兩個視窗。
- **WHEN** 在 "專案 B" 視窗下觸發 AYesMan 輪詢或指令。
- **THEN** AYesMan 必須掃描系統中所有的 Language Server，並只綁定其 `userStatus.cascadeModelConfigData.workspaces` 含有 "專案 B" 路徑的 Server。

### Requirement: 斷線重連機制 (Cache Invalidation)

AYesMan 必須能夠在底層 Language Server 崩潰、重啟、或更換 Port 的情況下，自動重新尋找新的 Language Server，而不是永久失效。

- **GIVEN** AYesMan 已經綁定了一個 Port 為 54321 的 Server。
- **WHEN** 該 Language Server 崩潰或重啟，導致 Port 54321 拒絕連線或 Timeout。
- **THEN** AYesMan 必須清空對 54321 的快取，並在下一次的 `fetchQuota` 或 `autoAcceptLoop` 中重新執行 `discoverServer` 來尋找新的 Port。

### Requirement: 健全的 Fallback 與提示

當完全找不到任何適用的 Language Server 時，不應該卡死，應提供明確的回饋。

- **GIVEN** 使用者未喚醒 Language Server，或被防毒軟體阻擋。
- **WHEN** `discoverServer` 搜尋所有程序皆無法找到吻合的 Port。
- **THEN** Status Bar 應該顯示 "AYesMan: Could not connect to Antigravity language server" 並維持無背景色，等待下一次定時掃描。
