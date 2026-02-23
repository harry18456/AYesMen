## Context

AYesMan 目前只有 Quota Dashboard 功能。Antigravity 的內建 auto-run 因黑名單機制（DEFAULT_DENY）導致不穩定；社群套件 pesosz/antigravity-auto-accept 因命令名稱更新而失效。

根據對 Antigravity workbench.desktop.main.js 的逆向工程研究：
- `antigravity.agent.acceptAgentStep` — 接受 file edit steps（仍有效）
- `antigravity.terminalCommand.accept` — 接受 terminal commands（舊名 `antigravity.terminal.accept` 已失效）
- `antigravity.command.accept` — 接受 command palette 式操作
- `antigravity.interactiveCascade.acceptSuggestedAction` — 接受 interactive cascade 建議

## Goals / Non-Goals

**Goals:**
- 每 500ms 輪詢所有 accept 命令，自動接受任何 pending agent steps
- 提供 toggle ON/OFF 機制（命令 + status bar click）
- 啟動時預設 ON
- 不影響現有 Quota Dashboard 功能

**Non-Goals:**
- 不實作選擇性 accept（只接受某類步驟）
- 不修改 Antigravity 的 `terminalAutoExecutionPolicy` 設定（gRPC SetUserSettings 太複雜且有副作用）
- 不實作 deny list 或 per-command 過濾

## Decisions

### 決定 1：命令輪詢 vs gRPC 直接呼叫

**選擇：命令輪詢**

原因：
- `antigravity.agent.acceptAgentStep` 的命令 handler 在 workbench 內部擁有 cascade state 存取權，直接呼叫比我們自己構建 gRPC cascade_id 邏輯簡單得多
- gRPC 直接呼叫 `HandleCascadeUserInteraction` 需要 cascade_id（workbench 內部狀態，無法從外部取得）
- pesosz 套件驗證了命令輪詢方法有效（36,000+ 安裝、5 星評分）
- 命令呼叫無 pending step 時會 no-op 或 throw（被 catch 處理），不會有副作用

**替代方案排除：**
- gRPC SetUserSettings → 只能設定 EAGER 但仍有 deny list，且需要複雜的 protobuf 序列化
- DOM 注入 → Chat panel 不是標準 Webview，已驗證無效

### 決定 2：輪詢間隔

**選擇：500ms**（與 pesosz 套件相同）

原因：足夠快讓用戶感覺即時，但不會過度消耗 CPU。

### 決定 3：Status bar 設計

**選擇：獨立的 auto-accept status bar item**（不與 quota 合併）

原因：兩個功能獨立，各自可以 ON/OFF，合併會讓 UI 複雜化。

Auto-accept bar 放在 quota bar 左邊（更高優先權）。

### 決定 4：預設狀態

**選擇：預設 ON**

原因：符合用戶安裝此套件的意圖（他們就是想要 auto-accept）。

## Risks / Trade-offs

- **[風險] 命令失效** → 若 Antigravity 再次更名，輪詢靜默失敗。緩解：error logging，未來可加 health check
- **[風險] 過度 accept** → 用戶可能誤觸 toggle 或忘記 auto-accept 開著。緩解：status bar 顯示清楚
- **[Trade-off] 輪詢消耗** → 每秒 2 次 × 4 個命令 = 每秒 8 個空操作。可接受，命令無 pending step 時幾乎無成本

## Migration Plan

1. 修改 `extension.ts` 加入 auto-accept 邏輯
2. 修改 `package.json` 新增命令貢獻
3. 重新 compile：`npm run compile`
4. 在 Antigravity IDE 中重新載入套件（Developer: Reload Window）
5. Rollback：停用 ayesman 套件即可
