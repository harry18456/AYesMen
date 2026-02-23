## ADDED Requirements

### Requirement: Auto-accept polling loop
Extension SHALL poll for pending agent steps every 500ms and automatically confirm them via gRPC.

Implementation uses direct gRPC calls to the Antigravity language server:
1. `GetAllCascadeTrajectories` → find cascades belonging to current VS Code workspace
2. Sort by `lastModifiedTime` descending, prefer non-IDLE status, take top 3
3. `GetCascadeTrajectorySteps` (last 10 steps) → find pending `runCommand` step
4. `HandleCascadeUserInteraction { confirm: true }` → accept the step

Each poll is wrapped in try/catch; errors are deduplicated to avoid log spam.

#### Scenario: Auto-accept triggers terminal command
- **WHEN** Antigravity agent proposes a terminal command and polling loop runs
- **THEN** `HandleCascadeUserInteraction` is called with `confirm: true` and the command runs automatically

#### Scenario: No pending step
- **WHEN** polling loop runs but there are no pending agent steps
- **THEN** gRPC calls complete with no-op result and no error is surfaced

#### Scenario: Multiple projects open
- **WHEN** two Antigravity instances are open for different projects
- **THEN** each extension instance only accepts steps belonging to its own VS Code workspace

### Requirement: Toggle ON/OFF
Extension SHALL provide `ayesman.toggleAutoAccept` command to enable or disable auto-accept.

#### Scenario: Toggle off
- **WHEN** user executes `ayesman.toggleAutoAccept` while auto-accept is ON
- **THEN** auto-accept polling stops, status bar shows "🛑 Auto-Accept: OFF"

#### Scenario: Toggle on
- **WHEN** user executes `ayesman.toggleAutoAccept` while auto-accept is OFF
- **THEN** auto-accept polling resumes, status bar shows "✅ Auto-Accept: ON"

### Requirement: Status bar indicator
Extension SHALL display a status bar item showing current auto-accept state.

#### Scenario: Active state display
- **WHEN** auto-accept is enabled
- **THEN** status bar shows "✅ Auto-Accept: ON" with normal background

#### Scenario: Inactive state display
- **WHEN** auto-accept is disabled
- **THEN** status bar shows "🛑 Auto-Accept: OFF" with warning background color

#### Scenario: Click to toggle
- **WHEN** user clicks the auto-accept status bar item
- **THEN** auto-accept state toggles (same as executing `ayesman.toggleAutoAccept`)

### Requirement: Default ON at startup
Extension SHALL start with auto-accept enabled by default.

#### Scenario: Extension activation
- **WHEN** AYesMan extension activates (`onStartupFinished`)
- **THEN** auto-accept is immediately enabled and polling loop starts
