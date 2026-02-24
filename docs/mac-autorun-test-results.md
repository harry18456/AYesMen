# Antigravity Auto Run 過濾機制測試報告 — macOS

> **測試日期**: 2026-02-25  
> **測試環境**: macOS (zsh)  
> **AYesMan 狀態**: 停用（測試 Antigravity 原生行為）  
> **所有指令皆設定為** `SafeToAutoRun: true`

---

## 測試結果總覽

| # | 指令 | 類別 | 結果 | 備註 |
|---|------|------|------|------|
| 1 | `ls \| grep .md` | 管線 (`\|`) | ✅ 直接通過 | |
| 2 | `echo "1" && echo "2"` | 複合 (`&&`) | ✅ 直接通過 | |
| 3 | `rm ... ; echo "done"` | 分號 (`;`) | ✅ 直接通過 | 含 `rm` + `;` 的複合指令 |
| 4 | `echo "x" > /tmp/file` | 重導向 (`>`) | ✅ 直接通過 | 寫入工作區外路徑 |
| 5 | `mkdir test_ag_dir` | 建立目錄 | ✅ 直接通過 | |
| 6 | `rm -rf test_ag_dir` | 刪除檔案/目錄 | ✅ 直接通過 | 含 `-rf` 強制遞迴刪除 |
| 7 | `chmod 777 README.md` | 權限修改 | ✅ 直接通過 | |
| 8 | `curl -I https://google.com` | 網路請求 | ✅ 直接通過 | 對外連線 |
| 9 | `git status` | Git (唯讀) | ✅ 直接通過 | |
| 10 | `git add .` | Git (寫入) | ✅ 直接通過 | |
| 11 | `npm -v` | 套件管理工具 | ✅ 直接通過 | |
| 12 | `sudo echo "test"` | 提權指令 | ✅ 直接通過 | 進入密碼提示，未被 Auto Run 攔截 |
| 13 | `mv README.md README.md` | 移動/重命名 | ✅ 直接通過 | |
| 14 | `kill -0 $$` | 終止程序 | ✅ 直接通過 | |
| 15 | `touch /tmp/ag_test.txt` | 建立檔案 (工作區外) | ✅ 直接通過 | |
| 16 | **`rmdir some_fake_test_dir`** | **刪除目錄** | **❌ 被攔截** | **唯一被攔截的指令** |

---

## 關鍵發現

### macOS 過濾規則極度寬鬆

macOS 上 Antigravity 的 Auto Run 過濾機制幾乎不攔截任何指令：

- **特殊字元** (`|`, `;`, `&&`, `>`) — 全部放行
- **危險指令** (`rm -rf`, `chmod`, `sudo`, `kill`) — 全部放行
- **網路請求** (`curl`) — 放行
- **Git 寫入操作** (`git add .`) — 放行
- **套件管理** (`npm`) — 放行

### 唯一被攔截的指令

在所有 16 項測試中，**只有 `rmdir` 被 Antigravity 的內建過濾機制攔截**。

這非常耐人尋味，因為更危險的 `rm -rf`（遞迴強制刪除目錄和所有內容）反而沒有被攔截。

---

## 與 Windows 的對比方向（待填入）

> 以下為預留欄位，待 Windows 測試完成後填入比對結果。

| 類別 | macOS 結果 | Windows 結果 |
|------|-----------|-------------|
| 管線 `\|` | ✅ 放行 | |
| 分號 `;` | ✅ 放行 | |
| `&&` | ✅ 放行 | |
| 重導向 `>` | ✅ 放行 | |
| `rm` / `del` | ✅ 放行 | |
| `rmdir` | ❌ 攔截 | |
| `chmod` | ✅ 放行 | |
| `curl` | ✅ 放行 | |
| `sudo` | ✅ 放行 | |
| `kill` | ✅ 放行 | |
| `git add` | ✅ 放行 | |
| `npm` | ✅ 放行 | |
| `mkdir` | ✅ 放行 | |
| `mv` | ✅ 放行 | |

---

## 結論

macOS 版 Antigravity 的 Auto Run 內建過濾機制**遠比 Windows 寬鬆**。AYesMan 在 macOS 上的主要價值在於：

1. **處理少數被攔截的邊界案例**（如 `rmdir`）
2. **自動確認 agent 主動標記為 `SafeToAutoRun: false` 的指令**（當 agent 自身判斷指令不安全時）
3. **確保完全無人值守的自動化工作流程**不會因任何意外攔截而中斷
