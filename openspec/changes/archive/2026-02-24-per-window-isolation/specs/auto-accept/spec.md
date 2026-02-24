## MODIFIED Requirements

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
