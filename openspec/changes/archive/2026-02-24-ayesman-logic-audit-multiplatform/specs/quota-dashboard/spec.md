## MODIFIED Requirements

### Requirement: Language Server Discovery

The extension MUST automatically discover the running Antigravity language server at startup.

#### Scenario: Extension activates

- **WHEN** the extension activates
- **THEN** the system MUST extract the CSRF token and PID from `language_server` process command-line args (process name pattern varies by platform: `language_server_windows_x64.exe` on Windows, `language_server` on Unix)
- **THEN** on Windows, the system MUST enumerate the process's listening TCP ports via `netstat -ano` (NOT `Get-NetTCPConnection`, which requires elevated privileges)
- **THEN** on Unix (macOS/Linux), the system MUST enumerate the process's listening TCP ports via `lsof -i -n -P -p <pid>`
- **THEN** the system MUST probe each port (HTTPS then HTTP) with a `Heartbeat` gRPC call to find the working endpoint

### Requirement: Quota Data Retrieval

The extension MUST fetch model quota data from the language server's gRPC API.

- The system MUST call `GetUserStatus` to retrieve cascade model quotas
- The system MUST call `GetCommandModelConfigs` to retrieve autocomplete model quotas
- The system MUST poll every 2 minutes, with an initial fetch after 5 seconds
- Manual refresh is available via the `ayesman.refreshQuota` command palette command
- Clicking the status bar item SHALL NOT trigger a quota refresh (click toggles auto-accept instead)
- Each fetch cycle MUST rebuild the quota list from scratch (replace strategy), not append to existing entries, to ensure stale model data is not retained

#### Scenario: Periodic polling

- **WHEN** the extension has discovered the language server
- **THEN** the system MUST poll quota data every 2 minutes with an initial fetch after 5 seconds

#### Scenario: Manual refresh via command palette

- **WHEN** user executes `ayesman.refreshQuota` from the command palette
- **THEN** the system fetches quota data immediately and shows a notification with result

#### Scenario: Quota data refreshes completely on each fetch
- **WHEN** the extension polls quota data and a previously seen model is no longer returned
- **THEN** the model is removed from the displayed quota list (not retained from a previous cycle)
