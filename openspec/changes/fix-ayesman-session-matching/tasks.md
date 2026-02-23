# Tasks: AYesMan Session 獲取機制修復任務清單

## 1. 支援取得所有 Language Server 程序

- [x] 1.1 修改 `ayesman/src/extension.ts` 中的 `findLanguageServerProcess` 函數，回傳 `ProcessInfo[]`。
- [x] 1.2 在 Windows 平台的 PowerShell 查詢指令中，移除 `| Select-Object -First 1`，並針對所有結果進行解析成 Array。
- [x] 1.3 在 MacOS / Linux 平台的 `ps aux` 指令中，移除 `| head -1`，並支援多行解析成 Array。

## 2. 實作所有 Server Ports 的探測與過濾機制

- [x] 2.1 修改 `ayesman/src/extension.ts` 中的 `discoverServer` 函數，能夠接受多個 `ProcessInfo`。
- [x] 2.2 對每個 Process 提取 Port 和 CSRF Token，並跑迴圈呼叫 `probePort`。
- [x] 2.3 **[核心]** 當 `probePort` 回傳 HTTP 200 成功後，進階呼叫 `callGrpc(server, "GetAllCascadeTrajectories")`。
- [x] 2.4 分析回傳的 Trajectories，檢查 `workspaces` 中是否有符合當前 `currentWorkspacePaths` 的絕對路徑。如果有，或是當前沒有工作區（`wsPaths.size === 0`），才判定為正確的 Server。

## 3. 實作 Cache Invalidation (斷線重連)

- [x] 3.1 修改 `ayesman/src/extension.ts` 中的 `fetchQuota`，在 `catch (err: any)` 捕獲連線錯誤時，加入 `cachedServerInfo = undefined` 強制重設快取。
- [x] 3.2 檢查 `startAutoAcceptLoop` 中的 `tryAutoAcceptStep` 呼叫機制。如果 `callGrpc` 連線錯誤（例如 HTTP 500、連線拒絕），同樣加入清空快取的保護。
- [x] 3.3 **[新增]** 在 `extension.ts` 中加入 `extVersion` 變數並在 Status Bar Tooltip 顯示版本號以供驗證。

## 4. 迴歸測試與確認

- [ ] 4.1 開啟兩個以上的 VS Code 或 Cursor 專案，測試擴充套件是否能夠在這兩個專案各自獨立、正確抓到對應的 Server。
- [ ] 4.2 從工作管理員或終端機強制終止目前的 `language_server` 執行緒，觀察 AYesMan Status Bar 是否能從 `Fetch Error` 自動在下個循環重新找到新的 Port，並恢復運作。
