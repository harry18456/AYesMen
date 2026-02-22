# AYesMan ⚡

AYesMan 是一個專為 Google Antigravity 開發的 VS Code 擴充套件，旨在強化 Agent 的使用體驗，提供更透明的模型配額監控與額度顯示。

> ⚠️ **注意**：本專案為非官方工具，透過逆向工程 Antigravity 內部語言伺服器 API 取得資料。

---

## 🌟 功能亮點

### 📊 即時 Quota Dashboard (配額儀表板)

Antigravity 內建的 UI 隱藏了具體的模型剩餘額度百分比，AYesMan 幫你把這些隱藏數據抓出來！

- **狀態列即時顯示**：在編輯器右下角永遠顯示目前**剩餘配額最低**的模型與百分比（例如 `⚠ Gemini 3 Pro: 20%`）。
- **智慧色彩警示**：
  - 🟢 綠色 (`$(check)`)：配額充足 (≥ 80%)
  - 🟡 黃色 (`$(warning)`)：配額消耗中 (40% ~ 79%)
  - 🔴 紅色 (`$(error)`)：配額即將耗盡 (< 40%，背景變色)
- **統整懸浮視窗 (Hover Tooltip)**：滑鼠停留在狀態列項目上，即可查看：
  - 所有模型的剩餘百分比（依字母排序排列，方便尋找同系列模型）
  - 每個模型的重置時間（例如 `resets in 2h 30m`）
  - 目前帳號方案 (Plan) 的 Prompt 與 Flow Credits 使用量與上限
- **自動刷新**：每 2 分鐘自動從背景更新資料，點擊狀態列項目亦可立即手動刷新。

---

## 🛠️ 開發與技術內幕

本擴充套件並未要求使用者手動輸入任何 API Key 或登入資訊，而是透過直接與 Antigravity 內部的 gRPC 語言伺服器溝通來取得即時資料：

1. **進程解析 (Process Inspection)**：擴充套件啟動時，會透過 PowerShell 掃描本機執行的 `language_server_windows_x64.exe` 進程。
2. **參數擷取**：從進程的命令列參數中動態擷取對應的 `CSRF Token`。
3. **通訊埠探測 (Port Probing)**：列出該進程所有監聽中的 TCP Port，並透過送出 `Heartbeat` 請求找出正確的 gRPC HTTPS/HTTP 端點。
4. **資料獲取**：直接呼叫 `GetUserStatus` 與 `GetCommandModelConfigs` 兩個尚未公開的 API，取得最即時、精確的模型額度與帳號狀態。

---

## 🚧 關於 Auto-Accept (自動同意命令) 功能

**目前狀態：暫停開發 (Blocked)**

本專案最初的目標之一是「自動點擊 Agent 的執行許可按鈕」，以實現真正的全自動工作流。經過廣泛的研究，目前面臨以下技術瓶頸：

- **無法透過內建 Command 觸發**：`executeCommand('antigravity.agent.acceptAgentStep')` 背後依賴內部 gRPC 呼叫，必須夾帶動態生成的 `cascade_id`，外部無法取得。
- **無法進行 Webview 注入**：Antigravity 的 Chat 面板是原生 Workbench 元件，而非標準 VS Code Webview，因此無法透過傳統的 DOM 注入方式（如 MutationObserver）自動點擊按鈕。
- **純模擬按鍵的副作用**：雖然能模擬按下 `Alt+Enter`，但缺乏精準的 Context 判斷會嚴重干擾開發者的正常打字與操作。

詳細的失敗嘗試與未來的 5 個潛在研究方向，請參考專案內的 `temp_auto_run_plan.md`。

---

## 📦 安裝說明 (開發者模式)

由於這是一個客製化的輔助工具，需透過原始碼自行編譯並放入 Antigravity 的擴充套件資料夾中。

1. **編譯**：
   ```bash
   cd ayesman
   npm install
   npx tsc -p .
   ```
2. **部署到 Antigravity**：

   ```powershell
   # 移除舊版 (如果有)
   if (Test-Path "c:\Users\harry\.antigravity\extensions\ayesmen.ayesman-0.1.0") {
       Remove-Item "c:\Users\harry\.antigravity\extensions\ayesmen.ayesman-0.1.0" -Recurse -Force
   }

   # 複製新版
   Copy-Item -Recurse ".\ayesman" "c:\Users\harry\.antigravity\extensions\ayesmen.ayesman-0.1.0"
   ```

3. **重新啟動** Antigravity 即可生效。

---

## 📝 授權與免責聲明

本工具僅供個人研究與優化開發體驗使用。使用內部未公開 API 可能面臨隨時失效的風險，且過度頻繁的 API 呼叫可能會影響本機效能或違反使用者條款。請斟酌使用。
