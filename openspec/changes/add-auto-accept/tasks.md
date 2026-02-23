## 1. package.json 更新

- [x] 1.1 在 `ayesman/package.json` 的 `contributes.commands` 新增 `ayesman.toggleAutoAccept` 命令（title: "AYesMan: Toggle Auto-Accept"）

## 2. extension.ts 核心實作

- [x] 2.1 新增 `autoAcceptEnabled` 狀態變數（預設 `true`）
- [x] 2.2 新增 `autoAcceptStatusBar` status bar item（alignment Right, priority 201，高於 quota bar）
- [x] 2.3 實作 `updateAutoAcceptStatusBar()` 函式（ON 顯示 ✅，OFF 顯示 🛑 with warningBackground）
- [x] 2.4 實作 `startAutoAcceptLoop()` 函式：每 500ms 透過 gRPC 直接呼叫
  - `GetUserTrajectoryDescriptions` → 取得 currentTrajectoryId
  - `GetAllCascadeTrajectories` → match cascadeId
  - `GetCascadeTrajectorySteps` (offset stepCount-10) → 取最後 10 步
  - `HandleCascadeUserInteraction` → confirm runCommand step
- [x] 2.5 在 `activate()` 中註冊 `ayesman.toggleAutoAccept` 命令，切換 `autoAcceptEnabled` 並更新 status bar
- [x] 2.6 在 `activate()` 中建立並顯示 auto-accept status bar item
- [x] 2.7 在 `activate()` 中啟動 auto-accept loop（`startAutoAcceptLoop()`）
- [x] 2.8 在 `deactivate()` 中清除 auto-accept interval

## 3. 驗證

- [x] 3.1 執行 `npm run compile`，確認無 TypeScript 錯誤
- [x] 3.6 commit `feat(ayesman): implement auto-accept via gRPC HandleCascadeUserInteraction`（3b606c5）

**以下為手動驗證（需在 Antigravity IDE 中進行）：**
- [ ] 3.2 在 Antigravity IDE 中 Reload Window，確認兩個 status bar items 都顯示
- [ ] 3.3 觸發一個 agent step，確認自動被 accept（不需手動按鍵）
- [ ] 3.4 點擊 auto-accept status bar item，確認切換至 OFF 狀態
- [ ] 3.5 再次點擊，確認回到 ON 狀態

