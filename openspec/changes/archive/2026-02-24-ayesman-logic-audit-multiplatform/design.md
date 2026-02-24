## Context

AYesMan 是一個 VS Code 擴展，透過 gRPC over HTTP 直接與 Antigravity Language Server 溝通，提供自動接受步驟與配額顯示功能。目前版本 1.3.0 已支援 Windows 和 Unix (macOS/Linux) 雙平台，但程式碼審查發現以下類別的問題：

1. **邏輯漏洞**：空命令接受、會話模式誤匹配、配額累積
2. **解析脆弱性**：平台特定命令輸出的正規表達式假設過強
3. **跨平台缺口**：IPv6 loopback (::1) 在 Linux/macOS 常見但未支援
4. **程式碼品質**：production console.log、mutable state 外洩、錯誤訊息失控

主要約束：
- 不引入新的外部依賴（僅使用 Node.js 內建模組 + VS Code API）
- 不改變現有 API（gRPC 方法、VS Code 命令、設定鍵）
- 保持 esbuild 單檔打包架構

## Goals / Non-Goals

**Goals:**
- 修正所有 P0/P1 邏輯漏洞（空命令接受、會話模式、Windows 正規表達式）
- 統一 Windows/Unix 平台的 IPv6 支援，覆蓋 `127.0.0.1` 和 `::1`
- 改善 ps 輸出解析的健壯性（欄位位置策略）
- 讓 gRPC 回應解析有明確的成功/失敗語義
- 以 VS Code OutputChannel 取代 console.log 作為診斷輸出
- 修正配額合併策略（replace 而非 append）

**Non-Goals:**
- 重寫整體架構（仍保持模組化現有設計）
- 引入單元測試框架（此次範圍為 bug fix，非 test infrastructure）
- 支援 SSH 遠端或 WSL 場景
- 改變使用者可見的 UI/UX

## Decisions

### D1: 平台解析策略 — 欄位切割 vs. 欄位位置

**選擇**: Unix ps 改用固定欄位位置切割，而非 `split(/\s+/)` 按空格切割

**理由**: `ps aux` 輸出格式明確定義欄位（USER, PID, %CPU, %MEM, VSZ, RSS, TTY, STAT, START, TIME, COMMAND），PID 永遠在第 2 欄，COMMAND 從第 11 欄起。以位置為主的解析策略不受命令列含空格影響。

**替代方案**: `ps -o pid=,cmd=` 自訂格式——更清晰但部分 Linux 版本行為不一致，macOS 完全支援，風險不確定。

---

### D2: IPv6 支援策略

**選擇**: 在 `findListeningPorts` 和 `findExtHostConnectedPorts` 中同時捕獲 `127.0.0.1` 和 `::1`，`probe.ts` 的探測保持 `127.0.0.1` 不變（Language Server 本身綁定 IPv4）

**理由**: Language Server 程序本身監聽 IPv4 127.0.0.1，但 VS Code Extension Host 與其建立連接時，某些 Linux/macOS 系統預設走 IPv6 loopback。因此只需在 `findExtHostConnectedPorts` 加入 `::1` 匹配，`probe` 端不需改動。

**替代方案**: 完全支援 IPv6 binding——需要同時修改 probe.ts 並處理 `[::1]:port` 格式，過度複雜。

---

### D3: VS Code OutputChannel vs. console.log

**選擇**: 建立單一共享 `OutputChannel`（名稱 "AYesMan"），所有診斷訊息透過 `channel.appendLine()` 輸出，移除所有 `console.log`

**理由**: `console.log` 在打包後的擴展中混入主機訊息，使用者無法便利查閱。OutputChannel 會出現在 VS Code "輸出" 面板，方便除錯，且不污染開發者工具主控台。

**替代方案**: 條件式 console.log (isDevelopment flag)——增加複雜度，且測試部署時容易忘記關閉。

---

### D4: gRPC JSON 解析失敗語義

**選擇**: JSON 解析失敗時 `reject(new Error(...))` 而非 `resolve(rawString)`

**理由**: 所有 gRPC 呼叫的呼叫端都期待對象（Record<string, unknown>），返回字串會在呼叫端造成靜默類型錯誤，比明確拒絕更難除錯。

---

### D5: 配額合併策略

**選擇**: `fetchQuota` 每次完整重建 `currentQuota` 陣列，而非追加 `newEntries`

**理由**: 追加策略在擴展長時間運行後會累積過期的模型配額條目，每次抓取應反映當前的完整狀態。重建策略更直觀且冪等。

---

### D6: 會話模式後備邏輯收緊

**選擇**: 當無伺服器有綁定工作區時，只在「只有一個伺服器」的情況下接受，否則返回 undefined（觸發重新探索）

**理由**: 原先 `!hasAnyBoundWorkspaces` 的後備允許在多伺服器場景下誤匹配第一個找到的伺服器。收緊為單伺服器情境保留後備語義，同時避免多伺服器下的誤匹配。

## Risks / Trade-offs

- **[Windows netstat 格式差異]** → 不同版本的 Windows 可能有略微不同的 netstat 輸出欄位間距；採用更嚴格的正規表達式與欄位切割策略降低依賴格式假設
- **[ps 欄位位置策略]** → 部分嵌入式 Linux 系統使用 busybox ps，欄位數可能不同；增加欄位數量防衛性檢查（`parts.length < 11`）
- **[OutputChannel 效能]** → 頻繁的 appendLine 在低效能機器上可能造成 UI 抖動；僅在真正需要診斷時輸出（Error 和首次狀態），不在 500ms 輪詢中記錄成功路徑
- **[會話模式後備收緊]** → 若單一工作區使用者伺服器重啟後尚未掛起任何工作區，需等待下一個探索週期；以現有的重新探索延遲機制（3s）緩解

## Migration Plan

1. 所有修改為向後相容的 bug fix，無 API breaking changes
2. 版本號從 1.3.0 → 1.4.0（minor bump，新功能為 IPv6 支援與 OutputChannel）
3. 修改後執行本地 `npm run package` 驗證打包成功
4. 在 Windows 11 + macOS + Ubuntu 22.04 上手動測試伺服器探索流程

## Open Questions

- `auto-accept` spec 定義「最後 10 步」，但實作為 50 步——是否應改回 10，或 spec 需更新？（建議與 spec owner 確認後在 specs delta 中解決）
- 是否需要為 `normalizeFileUri` 加入 `file://localhost/` 支援（企業環境）？（建議保留為後續 issue，此次不納入範圍）
