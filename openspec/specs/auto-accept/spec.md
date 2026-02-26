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

The correct language server for the current workspace MUST be identified using workspace-matching before polling. If workspace-matching fails, global mode (first responding server) SHALL be used as fallback.

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

#### Scenario: Workspace ID with encoded colon
- **WHEN** the Antigravity language server emits `--workspace_id` with `:` encoded as `_3A` (e.g., `file_d_3A_side_project_Foo`)
- **THEN** AYesMen SHALL still match it to the correct workspace folder and connect to that server (not fall back to global mode)

### Requirement: Toggle ON/OFF
Extension SHALL provide `ayesman.toggleAutoAccept` command to enable or disable auto-accept per-window via in-memory state.

Toggle state SHALL be stored as a module-level variable (not VS Code settings). Extension SHALL NOT read or write `vscode.workspace.getConfiguration()` for auto-accept state. Each VS Code window has its own Extension Host with independent memory, so toggling in one window SHALL NOT affect other windows.

#### Scenario: Toggle off
- **WHEN** user executes `ayesman.toggleAutoAccept` while auto-accept is ON in this window
- **THEN** auto-accept polling stops in this window, status bar shows "🛑 Auto-Accept: OFF"
- **THEN** other open windows are unaffected

#### Scenario: Toggle on
- **WHEN** user executes `ayesman.toggleAutoAccept` while auto-accept is OFF in this window
- **THEN** auto-accept polling resumes in this window, status bar shows "✅ Auto-Accept: ON"

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
Extension SHALL start with auto-accept enabled by default (in-memory `true`) every time the extension activates. State is NOT persisted across window restarts.

#### Scenario: Extension activation
- **WHEN** AYesMan extension activates (`onStartupFinished`) in any window
- **THEN** auto-accept is immediately enabled (in-memory state = true) and polling loop starts
- **THEN** previous session's toggle state is NOT restored

#### Scenario: Multiple windows independent defaults
- **WHEN** user opens two Antigravity windows
- **THEN** both windows start with auto-accept ON independently
- **WHEN** user toggles OFF in window A
- **THEN** window B remains ON

