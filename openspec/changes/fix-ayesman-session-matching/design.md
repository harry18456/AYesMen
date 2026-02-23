# Design: AYesMan Session 獲取機制修復

## Context

AYesMan 套件透過輪詢 (Polling) 來向底層 Antigravity Language Server 取得 quota 以及嘗試同意目前的 cascade 步驟。然而目前的實作在取得 Server Process 時加上了 `Select-Object -First 1`，並且如果發生 Error 並沒有作廢快取的 `cachedServerInfo`，這導致了在多專案視窗下找錯 Server，或在 Server 崩潰換 Port 後一直對死去的 Port 發送請求。

## Goals / Non-Goals

- **Goals**:
  1. 移除 `-First 1` 限制，取得所有運作中的 `language_server` procedures。
  2. 依序探測取得的 ports，並利用 `GetAllCascadeTrajectories` 返回的資料中 `workspaces` 與當前 VS Code 的 `currentWorkspacePaths` 進行比對，確認該 Server 是否負責當前專案。
  3. 當 `callGrpc` 拋出錯誤 (如連線拒絕) 時，將 `cachedServerInfo` 重置為 `undefined`，確保下一個 polling 週期會重新觸發 `discoverServer()`。
- **Non-Goals**:
  - 不改變原有的 gRPC 呼叫機制。
  - 不深入改變 Auto-Accept 的底層邏輯，純粹只解決「對到正確 Server」的問題。

## Proposed Solution

1. **修改 `findLanguageServerProcess`**:
   - 回傳型別從 `ProcessInfo | undefined` 改為 `ProcessInfo[]`。
   - PowerShell 指令移除 `| Select-Object -First 1`。在處理輸出的時候，用 foreach 解析所有行。
   - MacOS / Linux 的 `ps aux` 也移除 `| head -1`，並回傳多筆。

2. **修改 `discoverServer`**:
   - 走訪所有取得的 PIDs。對每一個 PID 找其 listening ports。
   - 對每個 port 進行 `probePort` 測試。這部份我們可以加強：不只回傳 heartbeat HTTP 200，在 probe 成功後，進一步執行一次 `callGrpc(..., "GetAllCascadeTrajectories")` 來比對裡面是否有屬於 `currentWorkspacePaths` 的資料（或若沒有開啟的資料夾，則直接採納）。若符合，則存入 `cachedServerInfo` 並回傳。

3. **修改 `fetchQuota` (Cache Invalidation)**:
   - 將原本 `try-catch` 裡面的 catch 區塊加入:
     ```typescript
     console.error("[AYesMan] Quota fetch error:", err.message);
     cachedServerInfo = undefined; // ★ Invalidate cache
     ```
   - Auto accept loop 中也應該做類似的處理，如果出現 `fetch` 錯誤，將 `cachedServerInfo` 設為 `undefined`，並暫停 Auto-Accept 直到下一次 polling 恢復。

## Risks / Trade-offs

- **效能問題**：如果同時開了 10 個專案，`discoverServer` 可能要探測數十個 ports 才能找到對的。但因為 `discoverServer` 只會在剛開機或者 server 崩潰導致 cache 失效時才發生，加上 polling 週期很長，所以成本可以接受。
