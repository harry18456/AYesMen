# AYesMan - Antigravity YesMan ⚡

**AYesMan** 為 [Google Antigravity](https://antigravity.dev) 提供統一的狀態列項目，一眼掌握自動確認狀態，並可懸浮查看即時模型配額儀表板。

> ⚠️ 非官方擴充套件，與 Google 或 Antigravity 無從屬關係。

**[English → README.md](README.md)**

---

## 功能

### ⚡ 統一狀態列

一個狀態列項目，包辦所有事。

- **執行中**：`▶️ YesMan` — 自動確認啟用中
- **暫停中**：`⏸️ YesMan` — 自動確認已關閉（橘色背景）
- **點擊**：切換自動確認開關
- **懸浮**：查看所有模型配額與重置時間
- **背景色**：配額不足時變黃（<40%）或紅（<20%）

### ✅ 自動確認（Auto-Accept）

不用再對每個 Agent 提出的 terminal 指令手動點擊「Accept」，AYesMan 自動幫你確認。

- **隨時切換**：點擊狀態列項目，或 `Ctrl+Shift+P` → `AYesMan: Toggle Auto-Accept`
- **多專案安全**：同時開啟多個 Antigravity 視窗時，各視窗獨立運作，不會互相干擾
- **預設開啟**：擴充套件載入時自動啟用
- **無過濾限制**：Antigravity 內建的 Auto Run 會攔截含有 `|`、`;` 或特定關鍵字（如 `rmdir`）的指令，AYesMan 全部自動確認。

> ⚠️ **資安提醒**：由於 AYesMan 繞過了 Antigravity 的安全過濾機制，在開啟自動確認的情況下處理不受信任的檔案或 repo 時，存在 prompt injection 風險。審查陌生程式碼時，建議先暫停自動確認（`⏸️ YesMan`）。

### 📊 配額儀表板

Antigravity 的 UI 不會顯示各模型的剩餘配額百分比。AYesMan 幫你把它顯示出來。

- **懸浮提示**：所有模型的百分比與重置時間
- **自動刷新**：每 2 分鐘在背景更新
- **手動刷新**：`Ctrl+Shift+P` → `AYesMan: Refresh Quota`

---

## 系統需求

- Google Antigravity IDE

---

## 指令

| 指令                          | 說明               |
| ----------------------------- | ------------------ |
| `AYesMan: Toggle Auto-Accept` | 啟用或停用自動確認 |
| `AYesMan: Refresh Quota`      | 手動刷新配額資料   |

---

## 運作方式

AYesMan 與在你電腦上本機執行的 Antigravity 溝通。除了 Antigravity 本身已傳送的資料外，不會有任何資料離開你的電腦——AYesMan 只讀取並操作本機進程。

- **配額資料**：向本機 Antigravity 查詢 IDE 內部使用的配額資訊。
- **自動確認**：透過本機 Antigravity 偵測待確認的 Agent 步驟，並代替你確認——等同於你自己點了 Accept 按鈕。

---

## 已知限制

- 需要 Antigravity 在擴充套件啟動前已執行
- 本擴充套件使用 Antigravity 的內部 API，Antigravity 更新後偶爾可能造成功能暫時失效，需等待 AYesMan 更新

---

## 免責聲明

AYesMan 是由社群獨立開發的非官方工具，透過與 Antigravity 互動，提供官方 UI 未提供的功能。請自行評估是否使用。

本擴充套件完全在本機（localhost）運作。所有 API 呼叫都在本機與 Antigravity 進行，使用你現有的 session 憑證——與正常 IDE 操作行為完全相同，不會直接接觸 Google 的伺服器。

本擴充套件不會繞過任何配額限制、不會增加 API 使用量，也不會將你的資料傳送至任何第三方。

---

## 授權

MIT
