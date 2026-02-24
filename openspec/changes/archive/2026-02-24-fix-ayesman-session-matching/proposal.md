# Proposal: 修復 AYesMan Session 配對與快取失效問題

## 概述

目前的 AYesMan Extension 在抓取底層 Language Server 的 Session 時存在兩個致命缺陷：

1. **多專案視窗互相干擾**：在尋找 Process 時使用了 `Select-Object -First 1`，這導致當使用者開啟多個 VS Code 視窗時，Extension 永遠只會抓取系統中的第一台 Language Server，進而導致非第一台的專案因 Workspace 檢查不符而徹底失效。
2. **斷線後快取卡死不更新**：當連線錯誤發生時，程式不會清空 `cachedServerInfo` 快取，導致自動同意迴圈（autoAcceptLoop）陷入無限向失效的 Port 發送請求的死胡同。

本變更旨在修正上述問題，確保無論開啟多少個專案視窗，或 Language Server 重啟/崩潰，AYesMan 皆能正確辨識並自動恢復運作。

## 為什麼需要這個變更 (Why)

- 確保了擴充套件的高可用性與穩定性，特別是給常駐多個 VS Code/Cursor 視窗的進階開發者。
- 避免不必要的網路請求錯誤持續噴發，浪費使用者開發資源與心情。

## 範圍 (Scope)

- 修改 `ayesman/src/extension.ts` 中的 `findLanguageServerProcess` 函數，移除 `-First 1`，改為回傳所有的 Process ID 與 Command Line 列表。
- 修改 `ayesman/src/extension.ts` 中的 `discoverServer` 函數，實作走訪並探測所有 Language Server 的 Port 機制，並確保 `userStatus` 過濾正確的 currentWorkspacePaths。
- 修改 `ayesman/src/extension.ts` 中的 `fetchQuota`，在捕捉到網路錯誤（`catch (err: any)`）時，設定 `cachedServerInfo = undefined`，以便下次能觸發重新掃描。

## 影響 (Impact)

- 此變更僅影響 `extension.ts` 等直接有關 Session 與快取的獲取邏輯。
- 使用者體驗將會顯著提升，不再會有套件偶爾「無反應」的不可預期行為。
