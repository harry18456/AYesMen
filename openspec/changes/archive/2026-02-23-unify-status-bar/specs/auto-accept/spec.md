## MODIFIED Requirements

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
