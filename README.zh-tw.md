# AYesMan ⚡

**AYesMan** 為 [Google Antigravity](https://antigravity.dev) 提供兩項實用功能：即時配額儀表板，以及 Agent 步驟自動確認。

> ⚠️ 非官方擴充套件，與 Google 或 Antigravity 無從屬關係。

**[English → README.md](README.md)**

---

## 功能

### 📊 配額儀表板

Antigravity 的 UI 不會顯示各模型的剩餘配額百分比。AYesMan 幫你把它顯示出來。

- **狀態列**：一眼看到剩餘配額最低的模型（例如 `⚠ Gemini 3 Pro: 20%`）
- **色彩指示**：🟢 充足（≥80%）· 🟡 適中（40–79%）· 🔴 不足（<40%）
- **懸浮提示**：所有模型的百分比、重置時間，以及帳號的 Prompt 與 Flow Credits 使用量
- **自動刷新**：每 2 分鐘在背景更新，點擊狀態列項目可立即手動刷新

### ✅ 自動確認（Auto-Accept）

不用再對每個 Agent 提出的 terminal 指令手動點擊「Accept」，AYesMan 自動幫你確認。

- **隨時切換**：點擊狀態列項目，或 `Ctrl+Shift+P` → `AYesMan: Toggle Auto-Accept`
- **多專案安全**：同時開啟多個 Antigravity 視窗時，各視窗獨立運作，不會互相干擾
- **預設開啟**：擴充套件載入時自動啟用

---

## 系統需求

- Google Antigravity IDE
- Antigravity 語言伺服器需在執行中（隨 IDE 自動啟動）

---

## 指令

| 指令 | 說明 |
|------|------|
| `AYesMan: Toggle Auto-Accept` | 啟用或停用自動確認 |
| `AYesMan: Refresh Quota` | 手動刷新配額資料 |
| `AYesMan: Diagnose Auto-Accept` | 顯示除錯資訊 |

---

## 運作方式

AYesMan 與在你電腦上本機執行的 Antigravity 語言伺服器溝通。除了 Antigravity 本身已傳送的資料外，不會有任何資料離開你的電腦——AYesMan 只讀取並操作本機進程。

- **配額資料**：向本機語言伺服器查詢 IDE 內部使用的配額資訊。
- **自動確認**：透過本機語言伺服器偵測待確認的 Agent 步驟，並代替你確認——等同於你自己點了 Accept 按鈕。

---

## 已知限制

- 需要 Antigravity 在擴充套件啟動前已執行
- 本擴充套件使用 Antigravity 的內部 API，Antigravity 更新後偶爾可能造成功能暫時失效，需等待 AYesMan 更新

---

## 免責聲明

AYesMan 是由社群獨立開發的非官方工具，透過與 Antigravity 本機語言伺服器互動，提供官方 UI 未提供的功能。請自行評估是否使用。

本擴充套件不會繞過任何配額限制、不會增加 API 使用量，也不會將你的資料傳送至任何第三方。

---

## 授權

MIT
