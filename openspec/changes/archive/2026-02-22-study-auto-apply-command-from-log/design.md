## Context

為了實作 AYesMen 的「自動套用 (auto-apply)」功能，我們需要知道 Antigravity 代理在等待使用者授權時，具體是透過哪些 VS Code 指令進行「接受 (accept)」或「執行 (run)」。
先前我們透過 `antigravity-explorer` 導出了 `dump.log`，其中紀錄了擴充套件註冊的各種指令與設定。我們需要從這份日誌中找出關聯的指令，並設計實驗來驗證這些指令的實際行為。

## Goals

- 從 `dump.log` 中盤點所有可能與 auto-apply 相關的 VS Code 指令。
- 設計一個研究計畫，以釐清這些指令的行為模式：
  1. 呼叫指令後是否會有 Return Value 讓呼叫端知道結果？
  2. 我們能否知道目前 Antigravity 是否正在「詢問使用者」等待授權？
  3. 背景呼叫這些指令是否會成功（是否需要特定的 UI 焦點）？

## Non-goals

- 尚未要直接在大專案中實作完整的 auto-apply 邏輯。這階段僅為「研究與驗證設計」。
- 繞過 Antigravity 內部的驗證機制（僅使用正規的 command invoke）。

## Architecture / Approach

我們將透過檢視 `dump.log` 內的 `discoveredCommands` 陣列，篩選出包含 `accept`, `run`, `command`, `step` 等關鍵字，並歸納出可疑的指令列表。
對於確認指令行為，我們將在 `antigravity-explorer` 擴充套件中加入實驗性質的功能，當特定條件觸發時嘗試透過 `vscode.commands.executeCommand` 呼叫這些指令，並印出其回傳結果。

## Solution

### 1. 潛在指令分析 (Candidate Commands)

從 `dump.log` 中，我們初步辨識出以下可能影響 auto-apply 的指令：

**執行與接受指令：**

- `antigravity.command.accept`
- `antigravity.command.reject`
- `antigravity.terminalCommand.run`
- `antigravity.terminalCommand.accept`
- `antigravity.terminalCommand.reject`

**代理步驟控制：**

- `antigravity.agent.acceptAgentStep`
- `antigravity.agent.rejectAgentStep`

**程式碼更動接受：**

- `antigravity.prioritized.agentAcceptAllInFile`
- `antigravity.prioritized.agentAcceptFocusedHunk`
- `antigravity.prioritized.supercompleteAccept`

### 2. 行為檢驗方法 (Behavior Verification)

為了瞭解這些指令的行為（是否無聲無息、有無需參數等），我們將在目前的專案中撰寫測試腳本（或透過 explorer 的暫時功能）：

- **State Polling/Observing:** 我們需尋找是否有指令或配置可以得知「目前是否正在等候操作」。例如觀察特定 Context Key 或是定時去執行某些獲取狀態的方法。
- **Action Execution:** 在 Antigravity 發出需要授權的動作時（例如要求執行終端機指令），手動或半自動地發動 `executeCommand("antigravity.terminalCommand.accept")`，觀察該動作是否成功被執行。並檢查回傳值 (Promise 的 resolve value)。

## Alternatives Considered

- **直接注入 (Patching) Antigravity 的程式碼**：此方法維護成本高，且容易因為 Antigravity 版本更新而失效，因此優先考慮透過標準的 `vscode.commands` 進入點。

## Risks / Trade-offs

- **缺乏 Context 的執行失敗**：許多指令可能被設計為「必須在特定 UI 焦點 (例如在終端機內或程式碼按鈕上)」才能執行。若我們在背景強制執行，可能會被略過或出錯。
- **無狀態回饋**：指令執行後可能回傳 `undefined`，若它不發布特定的事件，我們將很難精確知道自動套用何時完成。

## Conclusion (已結案)

經過進一步的 HAR 網路封包攔截分析，我們發現 Antigravity Webview 介面並不是透過註冊的 VS Code Commands (`executeCommand`) 來送出「接受 (Accept)」的動作，而是 **直接對本機的 gRPC Server (`127.0.0.1:59664`) 發送 HTTP POST 請求 (`HandleCascadeUserInteraction`)**，並且這類請求需要每次隨機生成的 `x-codeium-csrf-token` 作為認證。

**結論**：由於直接呼叫 VS Code 內部指令被安全機制阻擋，且偽造 HTTP Request 的難度極高（需破解 CSRF Token），因此本研究計畫確認「透過指令繞過 UI」的方案不可行。後續的真實實作，將改為透過 Webview 注入 Content Script 的方式，即模擬實體 DOM Click 來達成相同目的。本計畫至此結案封存。
