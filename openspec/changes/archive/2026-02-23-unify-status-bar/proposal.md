## Why

目前 AYesMan 在 status bar 佔用兩個獨立 item（Auto-Accept 與 Quota），外觀與其他套件（如 Windsurf/Codeium）的 status bar item 過於相似，容易混淆。合併為單一 item 可提高辨識度，並減少 status bar 雜訊。

## What Changes

- 移除獨立的 Auto-Accept status bar item
- 將 Quota status bar item 改為統一的 `YesMan` status bar item
- Status bar 文字改為 `$(debug-start) YesMan`（ON）/ `$(debug-pause) YesMan`（OFF）
- 點擊行為從「重新整理 quota」改為「toggle auto-accept」
- Tooltip 移除 Prompt/Flow credits 區塊，只保留 model quota 資訊

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `auto-accept`: Status bar indicator 合併至統一 item，不再是獨立的 status bar item；點擊統一 item 即可 toggle
- `quota-dashboard`: Status bar 文字格式改變（移除 model 名稱與百分比，改由 hover tooltip 顯示）；移除點擊重新整理；移除 Prompt/Flow credits 顯示；保留 command palette 指令 `ayesman.refreshQuota` 供手動重新整理

## Impact

- `src/extension.ts`：移除 `autoAcceptStatusBar`，修改 `quotaStatusBar` 為統一 item
- 不影響 gRPC 呼叫邏輯、auto-accept 輪詢邏輯、server discovery 邏輯
- `package.json` 中 `autoAcceptStatusBar` 相關 command 移除（若有）
