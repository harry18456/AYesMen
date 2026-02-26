# AYesMan - Antigravity YesMan ⚡

![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/harry18456.ayesman?style=flat-square&label=version&color=007acc)
![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/harry18456.ayesman?style=flat-square&color=4c1)
![GitHub License](https://img.shields.io/github/license/harry18456/AYesMen?style=flat-square&color=blue)
![GitHub stars](https://img.shields.io/github/stars/harry18456/AYesMen?style=flat-square)

**AYesMan** enhances your [Google Antigravity](https://antigravity.dev) experience with a unified status bar item that shows your auto-accept state and provides a real-time model quota dashboard on hover.

> ⚠️ Unofficial extension. Not affiliated with or endorsed by Google or Antigravity.

---

## Features

### ⚡ Unified Status Bar

One status bar item does it all.

- **Active**: `▶️ YesMan` — auto-accept is running
- **Paused**: `⏸️ YesMan` — auto-accept is off (orange background)
- **Click** to toggle auto-accept on/off
- **Hover** to see a full quota breakdown — all models with percentages and reset timers
- **Background color**: turns yellow (<40%) or red (<20%) when quota is critically low

### ✅ Auto-Accept

Stop clicking "Accept" on every terminal command the Agent proposes. AYesMan does it for you.

- **Toggle anytime**: Click the status bar item or use `Ctrl+Shift+P` → `AYesMan: Toggle Auto-Accept`
- **Multi-project aware**: Works correctly when multiple Antigravity windows are open for different projects
- **On by default**: Starts enabled when the extension loads
- **No filter restrictions**: Antigravity's built-in Auto Run blocks commands with `|`, `;`, or certain keywords (e.g. `rmdir`). AYesMan accepts all of them.

> ⚠️ **Security note**: Because AYesMan bypasses Antigravity's safety filters, working with untrusted files or repositories while auto-accept is active carries prompt injection risk. Pause auto-accept (`⏸️ YesMan`) when reviewing unfamiliar code.

### 📊 Quota Dashboard

Antigravity's UI doesn't show you exactly how much quota you have left per model. AYesMan does.

- **Hover tooltip**: All models with percentages and reset timers
- **Auto-refresh**: Updates every 2 minutes in the background
- **Manual refresh**: `Ctrl+Shift+P` → `AYesMan: Refresh Quota`

---

## Requirements

- Google Antigravity IDE

---

## Commands

| Command                       | Description                   |
| ----------------------------- | ----------------------------- |
| `AYesMan: Toggle Auto-Accept` | Enable or disable auto-accept |
| `AYesMan: Refresh Quota`      | Manually refresh quota data   |

---

## How It Works

AYesMan communicates with Antigravity running locally on your machine. No data leaves your computer beyond what Antigravity itself already sends — AYesMan only reads and interacts with a local process.

- **Quota data** is fetched by querying Antigravity locally for the same quota information the IDE uses internally.
- **Auto-Accept** works by detecting pending agent steps via Antigravity and confirming them on your behalf — equivalent to clicking the Accept button yourself.

---

## Known Limitations

- **Requires Antigravity to be running** before the extension activates.
- **Fragility**: Since this extension uses Antigravity's internal APIs, updates to Antigravity may occasionally break functionality until AYesMan is updated.
- **Outside Workspace Files**: Prompts to read files outside the current VS Code workspace will not be auto-accepted.
- **Ignored Files**: Prompts to read files matched by `.gitignore` will not be auto-accepted (Antigravity has a built-in feature to allow this).
- **Browser Automation**: Browser injected executions and operations will not be auto-accepted.
- **Platform Utility**: This extension is currently most useful for **Windows users**, as Antigravity's built-in Auto Run feature struggles with chained commands on Windows.

---

## Support

☕ Buy me a coffee: [harry18456](https://www.buymeacoffee.com/harry18456)

---

## Disclaimer

AYesMan is an independent, unofficial tool created by the community. It interacts with Antigravity to provide features not available in the official UI. Use at your own discretion.

This extension operates entirely on localhost. All API calls are made to Antigravity locally using your existing session credentials — they are indistinguishable from normal IDE activity and do not touch Google's servers directly.

This extension does not bypass any quota limits, does not increase API usage, and does not transmit your data to any third party.

---

## License

MIT

---

---

# AYesMan - Antigravity YesMan ⚡ (繁體中文說明)

**AYesMan** 專為 [Google Antigravity](https://antigravity.dev) 提供更佳的體驗，新增即時配額儀表板與 Agent 步驟自動確認功能。

> ⚠️ 非官方擴充套件。與 Google 或 Antigravity 無附屬關係或背書。

---

## 功能

### ⚡ 統一狀態列

單一狀態列項目整合兩項功能。

- **執行中**：`▶️ YesMan` — 自動確認啟用中
- **暫停中**：`⏸️ YesMan` — 自動確認已關閉（橘色背景）
- **點擊**切換自動確認開關
- **懸浮**查看所有模型配額與重置倒數時間
- **背景色**：當模型配額極低 (<20%) 或較低 (<40%) 時，會變為紅色或黃色

### ✅ 自動確認（Auto-Accept）

無須再手動點擊 Agent 提出的 terminal 指令確認，AYesMan 會為您代勞。

- **隨時切換**：點擊狀態列或使用 `Ctrl+Shift+P` → `AYesMan: Toggle Auto-Accept`
- **多專案支援**：開啟多個 Antigravity 視窗時也能正確運作不衝突
- **預設啟動**：擴充套件載入時預設啟用
- **無過濾限制**：Antigravity 內建的 Auto Run 刻意攔截含有 `|`、`;` 或特定黑名單關鍵字（例如 `rmdir`）的指令。AYesMan 完全繞過這些過濾機制。

> ⚠️ **安全性提醒**：由於 AYesMan 繞過 Antigravity 的安全過濾機制，當您在自動確認啟用時處理不受信任的程式碼庫或檔案，將會有 Prompt Injection 的風險。當審閱不熟悉的程式碼時，請暫停自動確認（`⏸️ YesMan`）。

### 📊 配額儀表板

Antigravity 內建 UI 隱藏了各模型的剩餘配額。AYesMan 讓您一目了然。

- **懸浮提示**：所有模型百分比與重置倒數
- **自動刷新**：每 2 分鐘在背景更新
- **手動刷新**：`Ctrl+Shift+P` → `AYesMan: Refresh Quota`

---

## 使用需求

- Google Antigravity IDE

---

## 指令集

| 指令                          | 說明                 |
| ----------------------------- | -------------------- |
| `AYesMan: Toggle Auto-Accept` | 啟用或停用自動確認   |
| `AYesMan: Refresh Quota`      | 手動重新整理配額資料 |

---

## 運作原理

AYesMan 與本機端執行的 Antigravity 進行通訊。除 Antigravity 原本傳送的內容外，不會有任何資料傳送到外部 — AYesMan 僅與本機行程進行讀取與互動。

- **配額資料**透過向本機 Antigravity 請求 IDE 內部使用的同樣資料取得。
- **自動確認**透過偵測 Antigravity 待處理的 agent 步驟並為您自動確認 — 相當於您手動點擊了 Accept 按鈕。

---

## 已知限制

- **需要 Antigravity 執行中**才能啟動擴充套件。
- **脆弱性**：由於此套件依賴未公開的內部 API，Antigravity 更新可能會導致功能中斷，直到 AYesMan 釋出更新。
- **工作區外檔案**：讀取 VS Code workspace 外檔案的詢問不會自動允許。
- **忽略的檔案**：讀取在 `.gitignore` 內的相關檔案路徑詢問不會自動允許（Antigravity 已有內建允許功能）。
- **瀏覽器操作**：瀏覽器操作的注入執行不會自動允許。
- **平台實用性**：這款套件目前對於 **Windows 用戶**最為有用，因為 Antigravity 內建的 Auto Run 功能在 Windows 處理串連指令時較有問題。

---

## 支持

☕ 買杯咖啡：[harry18456](https://www.buymeacoffee.com/harry18456)

---

## 免責聲明

AYesMan 是一款由社群製作的獨立、非官方工具。它透過與 Antigravity 互動提供官方 UI 不具備的功能。請自行判斷使用風險。

此擴充套件完全在 localhost 的環境下運作。所有的 API 呼叫皆使用您的開發金鑰與本機的 Antigravity 進行通訊 — 這些請求與一般的 IDE 活動無從分辨，也不會直接聯繫 Google 伺服器。

此擴充套件**不會**繞過任何配額限制、**不會**增加 API 的消耗用量，也**不會**將您的資料傳送給第三方。

---

## 授權

MIT
