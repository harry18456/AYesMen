## Purpose

Automatically accept pending Antigravity agent terminal steps by polling the Language Server every 500ms, allowing unattended execution of proposed commands.
## Requirements
### Requirement: Auto-accept polling loop
Extension SHALL poll for pending agent steps every 500ms and automatically confirm them via gRPC.

Implementation uses direct gRPC calls to the Antigravity language server:
1. `GetAllCascadeTrajectories` → find cascades belonging to current VS Code workspace
2. Sort by `lastModifiedTime` descending, prefer non-IDLE status, take top 3
3. `GetCascadeTrajectorySteps` (last 10 steps) → find pending `runCommand` step
4. Validate that the step's `proposedCommandLine` or `commandLine` is non-empty; skip if both are empty
5. `HandleCascadeUserInteraction { confirm: true }` → accept the step

Each poll is wrapped in try/catch; errors are deduplicated by error type (not full message string) to avoid log spam.

#### Scenario: Auto-accept triggers terminal command
- **WHEN** Antigravity agent proposes a terminal command and polling loop runs
- **THEN** `HandleCascadeUserInteraction` is called with `confirm: true` and the command runs automatically

#### Scenario: No pending step
- **WHEN** polling loop runs but there are no pending agent steps
- **THEN** gRPC calls complete with no-op result and no error is surfaced

#### Scenario: Multiple projects open
- **WHEN** two Antigravity instances are open for different projects
- **THEN** each extension instance only accepts steps belonging to its own VS Code workspace

#### Scenario: Empty command step skipped
- **WHEN** a pending step has empty `proposedCommandLine` and empty `commandLine`
- **THEN** the step is skipped without calling HandleCascadeUserInteraction

### Requirement: Toggle ON/OFF
Extension SHALL provide `ayesman.toggleAutoAccept` command to enable or disable auto-accept.

#### Scenario: Toggle off
- **WHEN** user executes `ayesman.toggleAutoAccept` while auto-accept is ON
- **THEN** auto-accept polling stops, status bar shows "🛑 Auto-Accept: OFF"

#### Scenario: Toggle on
- **WHEN** user executes `ayesman.toggleAutoAccept` while auto-accept is OFF
- **THEN** auto-accept polling resumes, status bar shows "✅ Auto-Accept: ON"

### Requirement: Status bar indicator
Extension SHALL display auto-accept state via the unified YesMan status bar item (shared with quota-dashboard capability). There is no separate auto-accept status bar item.

- When auto-accept is ON, the unified item text SHALL be `$(debug-start) YesMan`
- When auto-accept is OFF, the unified item text SHALL be `$(debug-pause) YesMan` with `statusBarItem.warningBackground`
- Clicking the unified item SHALL toggle auto-accept state (same as `ayesman.toggleAutoAccept`)

#### Scenario: Active state display
- **WHEN** auto-accept is enabled
- **THEN** the unified YesMan status bar item shows `$(debug-start) YesMan` with no warning background

#### Scenario: Inactive state display
- **WHEN** auto-accept is disabled
- **THEN** the unified YesMan status bar item shows `$(debug-pause) YesMan` with `statusBarItem.warningBackground`

#### Scenario: Click to toggle
- **WHEN** user clicks the unified YesMan status bar item
- **THEN** auto-accept state toggles (same as executing `ayesman.toggleAutoAccept`)

### Requirement: Default ON at startup
Extension SHALL start with auto-accept enabled by default.

#### Scenario: Extension activation
- **WHEN** AYesMan extension activates (`onStartupFinished`)
- **THEN** auto-accept is immediately enabled and polling loop starts

