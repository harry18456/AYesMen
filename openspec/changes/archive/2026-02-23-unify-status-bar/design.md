## Context

AYesMan 目前在 VS Code status bar 有兩個獨立 item：
1. `autoAcceptStatusBar`（priority 201）：顯示 Auto-Accept 狀態，點擊 toggle
2. `quotaStatusBar`（priority 200）：顯示最低 quota model 資訊，點擊 refresh

兩個 item 緊鄰排列，外觀與 Windsurf/Codeium 等套件的 status bar item 相似，容易讓使用者感到混淆。

所有變更集中在 `ayesman/src/extension.ts` 單一檔案。

## Goals / Non-Goals

**Goals:**
- 合併為單一 status bar item，文字為 `$(debug-start) YesMan` / `$(debug-pause) YesMan`
- 點擊統一 item → toggle auto-accept
- Tooltip 只顯示 model quota 資訊（移除 Prompt/Flow credits 區塊）
- 保留 `ayesman.refreshQuota` command palette 指令供手動重新整理

**Non-Goals:**
- 不修改 gRPC 呼叫邏輯
- 不修改 auto-accept 輪詢邏輯（500ms interval）
- 不修改 server discovery 邏輯
- 不新增任何功能

## Decisions

### 決策 1：用 VSCode codicon 而非 emoji

**選擇**：`$(debug-start)` / `$(debug-pause)`
**理由**：Emoji 在 Windows 上有對齊偏移問題；codicon 與 VS Code 原生風格一致，跨平台渲染穩定。

**替代方案**：`✅` / `🛑`（當前 auto-accept bar 用法）→ 已排除，跨平台問題。

### 決策 2：Status bar 文字不顯示 model 資訊

**選擇**：文字固定為 `$(debug-start) YesMan` 或 `$(debug-pause) YesMan`，model 使用量只在 tooltip 顯示。
**理由**：套件核心功能是 auto-accept，model 使用量是次要資訊；文字越短越清楚，hover 才需要細節。

**替代方案**：文字包含 `Sonnet: 85%`，但這樣容易讓圖示被誤解為 model 被禁用，且 status bar 變長。

### 決策 3：移除 Prompt/Flow credits 顯示

**選擇**：Tooltip 只保留 model quota % 與 reset countdown。
**理由**：Credits 數字對日常使用幫助有限，暫時隱藏以精簡 tooltip。

### 決策 4：background color 反映 auto-accept OFF 狀態優先

**選擇**：auto-accept OFF → `statusBarItem.warningBackground`；ON 時依 quota 嚴重度決定顏色。
**理由**：auto-accept 被關閉是使用者最需要注意的狀態。

## Risks / Trade-offs

- **[Risk] 手動 refresh 需開 command palette** → 低影響，2 分鐘輪詢足夠日常使用，command palette 保留緊急使用路徑。
- **[Trade-off] Tooltip 移除 credits 資訊** → 使用者無法即時看到 Prompt/Flow 剩餘額度，但可透過 Windsurf 官方介面查詢。
