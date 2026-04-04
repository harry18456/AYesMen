# Spec: Quota Dashboard Capability

## Purpose

Display real-time Antigravity model quota and credit information in the VS Code status bar by querying the Language Server's gRPC endpoints (`GetUserStatus`, `GetCommandModelConfigs`).

## Requirements

### Requirement: Language Server Discovery

The extension MUST automatically discover the running Antigravity language server at startup.

#### Scenario: Extension activates

- **WHEN** the extension activates
- **THEN** the system MUST extract the CSRF token and PID from `language_server` process command-line args (process name pattern varies by platform: `language_server_windows_x64.exe` on Windows, `language_server` on Unix)
- **THEN** on Windows, the system MUST enumerate the process's listening TCP ports via `netstat -ano` (NOT `Get-NetTCPConnection`, which requires elevated privileges)
- **THEN** on Unix (macOS/Linux), the system MUST enumerate the process's listening TCP ports via `lsof -i -n -P -p <pid>`
- **THEN** the system MUST probe each port with an HTTP/2 `Heartbeat` gRPC call over HTTPS to find the working endpoint

---
### Requirement: Quota Data Retrieval

The extension MUST fetch model quota data from the language server's gRPC API.

All gRPC calls (`GetUserStatus`, `GetCommandModelConfigs`) SHALL be sent over HTTP/2 using the `callGrpc()` transport. Request bodies SHALL be encoded as JSON (`Content-Type: application/json`). The Connect protocol version header (`Connect-Protocol-Version: 1`) and CSRF token header (`x-codeium-csrf-token`) MUST be included in every request.

- The system MUST call `GetUserStatus` to retrieve cascade model quotas
- The system MUST call `GetCommandModelConfigs` to retrieve autocomplete model quotas
- The system MUST poll every 2 minutes, with an initial fetch after 5 seconds
- Manual refresh is available via the `ayesman.refreshQuota` command palette command
- Clicking the status bar item SHALL NOT trigger a quota refresh (click toggles auto-accept instead)
- Each fetch cycle MUST rebuild the quota list from scratch (replace strategy), not append to existing entries, to ensure stale model data is not retained

#### Scenario: Periodic polling
- **WHEN** the extension has discovered the language server
- **THEN** the system MUST poll quota data every 2 minutes with an initial fetch after 5 seconds
- **THEN** gRPC calls MUST be sent over the HTTP/2 session with JSON encoding

#### Scenario: Manual refresh via command palette
- **WHEN** user executes `ayesman.refreshQuota` from the command palette
- **THEN** the system fetches quota data immediately over HTTP/2 and shows a notification with result

#### Scenario: Quota data refreshes completely on each fetch
- **WHEN** the extension polls quota data and a previously seen model is no longer returned
- **THEN** the model is removed from the displayed quota list (not retained from a previous cycle)

---
### Requirement: Status Bar Display

The extension MUST display quota state via background color on the unified YesMan status bar item. The item text is controlled by the auto-accept capability and is NOT modified by quota data.

- When auto-accept is ON, the background color SHALL reflect quota severity: yellow (<40%), red (<20%), none otherwise
- When auto-accept is OFF, `statusBarItem.warningBackground` takes priority regardless of quota level

#### Scenario: Quota data is available and auto-accept ON

- **WHEN** quota data has been fetched and auto-accept is ON
- **THEN** the unified item background turns yellow when lowest model quota <40%, red when <20%, none otherwise
- **THEN** the item text remains `$(debug-start) YesMan` (not modified by quota)

#### Scenario: Auto-accept OFF takes priority

- **WHEN** auto-accept is disabled
- **THEN** the unified item shows `$(debug-pause) YesMan` with `statusBarItem.warningBackground` regardless of quota level

---
### Requirement: Hover Tooltip

The extension MUST display quota information in a rich hover tooltip on the unified YesMan status bar item.

- The tooltip SHALL list all models sorted alphabetically with 🟢/🟡/🔴 indicator, percentage, and reset countdown
- The tooltip SHALL NOT include Prompt credits or Flow credits information
- The tooltip SHALL indicate current auto-accept state at the top

#### Scenario: Hover tooltip content

- **WHEN** the user hovers over the unified YesMan status bar item
- **THEN** a Markdown tooltip displays auto-accept state followed by all models sorted alphabetically
- **THEN** each model shows 🟢/🟡/🔴 indicator, name, percentage, and reset countdown
- **THEN** Prompt/Flow credits are NOT shown
