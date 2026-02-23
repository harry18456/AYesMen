## ADDED Requirements

### Requirement: Auto-accept polling loop
Extension SHALL poll Antigravity accept commands every 500ms to automatically accept any pending agent steps.

Polled commands (in order):
1. `antigravity.agent.acceptAgentStep`
2. `antigravity.terminalCommand.accept`
3. `antigravity.command.accept`
4. `antigravity.interactiveCascade.acceptSuggestedAction`

Each command call SHALL be wrapped in try/catch; failures are silently ignored.

#### Scenario: Auto-accept triggers file edit step
- **WHEN** Antigravity agent proposes a file edit and polling loop runs
- **THEN** `antigravity.agent.acceptAgentStep` executes and the step is accepted without user interaction

#### Scenario: Auto-accept triggers terminal command
- **WHEN** Antigravity agent proposes a terminal command and polling loop runs
- **THEN** `antigravity.terminalCommand.accept` executes and the command runs automatically

#### Scenario: No pending step
- **WHEN** polling loop runs but there are no pending agent steps
- **THEN** all command calls fail silently (caught by try/catch) and no error is surfaced

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
