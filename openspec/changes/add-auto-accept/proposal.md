## Why

Google Antigravity 內建的 auto-run 不穩定（管線、複合指令等會被 DEFAULT_DENY 攔截），而原本社群套件 pesosz/antigravity-auto-accept 在 Antigravity 更新後因命令名稱變更（`antigravity.terminal.accept` → `antigravity.terminalCommand.accept`）而失效。AYesMan 需要自行實作可靠的 auto-accept 功能。

## What Changes

- AYesMan extension 新增 auto-accept 輪詢迴圈，每 500ms 自動呼叫 Antigravity 的 accept 命令
- 新增 `ayesman.toggleAutoAccept` VS Code 命令，允許用戶切換 ON/OFF
- 新增獨立的 status bar item 顯示 auto-accept 當前狀態（✅ ON / 🛑 OFF）
- 啟動時預設為 **ON**，與 pesosz 套件行為一致

## Capabilities

### New Capabilities

- `auto-accept`: 自動接受 Antigravity agent steps 的功能，包含輪詢邏輯、toggle 命令、狀態列顯示

### Modified Capabilities

（無現有 spec 需要修改）

## Impact

- 修改：`ayesman/src/extension.ts`（加入 auto-accept 邏輯）
- 修改：`ayesman/package.json`（新增 `ayesman.toggleAutoAccept` 命令貢獻）
- 相依：Antigravity IDE >= 0.2.0（使用新版命令名 `antigravity.terminalCommand.accept`）
