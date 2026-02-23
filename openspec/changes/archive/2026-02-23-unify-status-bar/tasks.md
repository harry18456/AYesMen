## 1. 移除 Auto-Accept Status Bar Item

- [x] 1.1 刪除 `autoAcceptStatusBar` 變數宣告與 `createStatusBarItem`（priority 201）
- [x] 1.2 刪除 `autoAcceptStatusBar.command`、`autoAcceptStatusBar.show()` 呼叫
- [x] 1.3 移除 `updateAutoAcceptStatusBar()` 函式
- [x] 1.4 移除 `context.subscriptions.push(autoAcceptStatusBar)` 訂閱

## 2. 改造 Quota Status Bar 為統一 YesMan Item

- [x] 2.1 將 `quotaStatusBar` 的 `command` 改為 `ayesman.toggleAutoAccept`
- [x] 2.2 更新 `updateQuotaStatusBar()`：移除設定 `quotaStatusBar.text` 為 model 資訊的邏輯
- [x] 2.3 讓 `updateQuotaStatusBar()` 呼叫新的 `updateUnifiedStatusBar()` 來同步文字與背景色

## 3. 實作 updateUnifiedStatusBar()

- [x] 3.1 新增 `updateUnifiedStatusBar()` 函式：auto-accept OFF → `$(debug-pause) YesMan` + warningBackground；ON → `$(debug-start) YesMan` + 依 quota 決定背景色（yellow <40%、red <20%、none 其他）
- [x] 3.2 在 `updateAutoAcceptStatusBar()` 中改呼叫 `updateUnifiedStatusBar()`（原本是設定舊的 status bar 文字）
- [x] 3.3 確認 `toggleAutoAccept` command 執行後也會更新統一 item

## 4. 修改 Tooltip

- [x] 4.1 在 `updateQuotaStatusBar()` 中移除 Prompt/Flow credits 區塊（`latestCredits` 相關 markdown）
- [x] 4.2 在 tooltip 頂部加入 auto-accept 狀態一行（例：`Auto-Accept: ON`）
- [x] 4.3 移除 tooltip 最後的 `_Click to refresh_` 文字

## 5. 清理

- [x] 5.1 確認 `quotaStatusBar.command` 不再是 `ayesman.refreshQuota`（改為 `ayesman.toggleAutoAccept`）
- [x] 5.2 確認 `ayesman.refreshQuota` command 仍可透過 command palette 執行（功能保留，只移除 status bar 點擊綁定）
- [ ] 5.3 編譯並在 Extension Development Host 中手動驗證：status bar 文字、點擊 toggle、hover tooltip 內容
