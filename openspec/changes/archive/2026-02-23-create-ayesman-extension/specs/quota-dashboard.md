# Spec: Quota Dashboard Capability

## Context

Antigravity's language server exposes gRPC endpoints (`GetUserStatus`, `GetCommandModelConfigs`) that return real-time model quota and credit information. This capability queries those endpoints and displays the data in the VS Code status bar.

## Requirements

### Requirement: Language Server Discovery

The extension MUST automatically discover the running Antigravity language server at startup.

#### Scenario: Extension activates

- **WHEN** the extension activates
- **THEN** the system MUST extract the CSRF token and PID from `language_server_windows_x64.exe` process command-line args
- **THEN** the system MUST enumerate the process's listening TCP ports via `Get-NetTCPConnection`
- **THEN** the system MUST probe each port (HTTPS then HTTP) with a `Heartbeat` gRPC call to find the working endpoint

### Requirement: Quota Data Retrieval

The extension MUST fetch model quota and credit data from the language server's gRPC API.

#### Scenario: Periodic polling

- **WHEN** the extension has discovered the language server
- **THEN** the system MUST call `GetUserStatus` to retrieve cascade model quotas and plan credits
- **THEN** the system MUST call `GetCommandModelConfigs` to retrieve autocomplete model quotas
- **THEN** the system MUST poll every 2 minutes, with an initial fetch after 5 seconds
- **THEN** clicking the status bar item MUST trigger an immediate refresh

### Requirement: Status Bar Display

The extension MUST display quota information in the VS Code status bar with a rich hover tooltip.

#### Scenario: Quota data is available

- **WHEN** quota data has been fetched
- **THEN** the system MUST display the lowest-quota model name and percentage in a status bar item (e.g., `⚠ Claude Opus 4.6: 60%`)
- **THEN** the status bar icon MUST reflect quota severity: `$(check)` ≥80%, `$(warning)` 40-79%, `$(error)` <20%
- **THEN** the status bar background MUST turn yellow (<40%) or red (<20%)

#### Scenario: Hover tooltip

- **WHEN** the user hovers over the status bar item
- **THEN** a Markdown tooltip MUST display all models sorted alphabetically, each with 🟢/🟡/🔴 indicator, percentage, and reset countdown
- **THEN** plan credits (Prompt and Flow) with remaining/total MUST be shown below the model list
