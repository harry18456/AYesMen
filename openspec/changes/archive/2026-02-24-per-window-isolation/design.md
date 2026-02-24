## Context

AYesMan 是一個 VS Code extension，在 Antigravity（Google，基於 Electron/VS Code）中運行。每個 VS Code 視窗都有獨立的 Extension Host process（在 Antigravity 中為 `--type=utility --utility-sub-type=node.mojom.NodeService`）。

**現況問題**：
1. auto-accept 狀態寫入 `vscode.ConfigurationTarget.Global`，所有視窗共享
2. session 匹配（`ayesman.sessionMatch`）預設關閉；開啟後需對每個 LS process 發 gRPC call 來比對 workspace 路徑，速度慢

**實測確認（Windows）**：
- `language_server` process 的 `ParentProcessId` 正是 Extension Host（NodeService）的 PID
- AYesMan 中 `process.pid` 即 Extension Host PID
- 因此 `language_server.parentPid === process.pid` 可精準匹配，無需網路呼叫

## Goals / Non-Goals

**Goals:**
- 每個視窗的 auto-accept 狀態獨立，互不干擾，重啟視窗預設 ON
- Session 匹配預設開啟且快速（不需 gRPC）
- Platform 特有的 parentPid 取得方式隔離在 `platform/windows.ts` 和 `platform/unix.ts`

**Non-Goals:**
- 持久化 per-window 設定（不寫檔，重開視窗就重置）
- 支援 Remote Extension Host（SSH、WSL、Container）環境
- 完整 fallback 到舊 gRPC workspace-path session matching

## Decisions

### Decision 1：parentPid 加入 `ProcessInfo`，由 platform 層填入

**選擇**：在 `ProcessInfo` 型別加 `parentPid?: number`，`findLanguageServerProcesses()` 負責填入。

**理由**：`parentPid` 本身就是 process 的一個屬性，放在 `ProcessInfo` 比另建函式更符合原有設計，`discovery.ts` 上層不需要知道取得方式的細節。

**替代方案**：另加 `findParentPid(pid)` 函式 → 需多一次 process table 查詢，且調用方需管理額外的 async call。

### Decision 2：parentPid 匹配作為預設，fallback 到 global

**選擇**：`discoverServer()` 優先以 `parentPid === process.pid` 過濾 LS processes；若 `parentPid` 不可用（undefined）或過濾後無結果，退回 global mode（第一個可用的 LS）。

**理由**：parentPid 匹配快速、正確，不需要 `ayesman.sessionMatch` flag。Global fallback 保留向後相容性（如 unix 端 PPID 取不到的情況）。

**替代方案**：保留 `ayesman.sessionMatch` 但預設改 true → 仍需維護兩套邏輯，`sessionMatch` 舊有的 gRPC 路徑可直接廢棄。

### Decision 3：移除 `ayesman.sessionMatch` 設定

**選擇**：直接廢棄 `ayesman.sessionMatch`；parentPid 模式成為唯一 session 策略。

**理由**：兩套 session matching 邏輯同時存在增加維護成本，且 parentPid 涵蓋其功能且更快。

**替代方案**：保留 flag 但 doc 標為 deprecated → 造成混淆，MVP 階段不值得。

### Decision 4：auto-accept 狀態改 in-memory module variable

**選擇**：`let _autoAcceptEnabled = true` 存在 module scope，toggle command 直接修改此變數；移除 `vscode.workspace.getConfiguration()` 的讀寫。

**理由**：每個視窗的 Extension Host 有獨立的 JS heap，module variable 天然 per-window。不寫設定檔符合使用者「每次新視窗都預設 ON」的需求。

**替代方案**：改寫 `ConfigurationTarget.Workspace` → 需要 workspace folder 存在才能寫入，且會在 `.vscode/settings.json` 留下設定，不夠乾淨。

## Risks / Trade-offs

- **[Risk] Unix PPID 取得方式不同** → `ps -eo pid,ppid,args` 跨 macOS / Linux 通用，若特殊環境不支援則 `parentPid` 為 undefined，fallback 到 global mode
- **[Risk] Antigravity 未來版本改變 process 架構** → `parentPid` 取不到時 fallback 仍可正常運作，功能不中斷，只是回到 global mode
- **[Trade-off] auto-accept 狀態不持久化** → 重開視窗一律回到 ON；使用者若想保持 OFF 需每次手動關閉（可接受，因需求明確）

## Migration Plan

1. 部署新版本後，`ayesman.sessionMatch` 設定若已存在於 User Settings 中會被忽略（extension 不再讀取）
2. auto-accept 設定同樣被忽略，重開視窗自動恢復 ON
3. 無資料庫或檔案格式遷移需求

## Open Questions

- Unix 平台的 PPID 比對是否在所有 Linux distro 和 macOS 上如預期（需實際測試）
- 若使用者真的需要跨重啟的 per-window 設定，未來可考慮用 `ExtensionContext.workspaceState` 儲存（目前不在 scope）
