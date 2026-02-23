## MODIFIED Requirements

### Requirement: Quota Data Retrieval
The extension MUST fetch model quota data from the language server's gRPC API.

- The system MUST call `GetUserStatus` to retrieve cascade model quotas
- The system MUST call `GetCommandModelConfigs` to retrieve autocomplete model quotas
- The system MUST poll every 2 minutes, with an initial fetch after 5 seconds
- Manual refresh is available via the `ayesman.refreshQuota` command palette command
- Clicking the status bar item SHALL NOT trigger a quota refresh (click toggles auto-accept instead)

#### Scenario: Periodic polling
- **WHEN** the extension has discovered the language server
- **THEN** the system MUST poll quota data every 2 minutes with an initial fetch after 5 seconds

#### Scenario: Manual refresh via command palette
- **WHEN** user executes `ayesman.refreshQuota` from the command palette
- **THEN** the system fetches quota data immediately and shows a notification with result

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

## REMOVED Requirements

### Requirement: Click to refresh quota
**Reason**: Clicking the status bar item now toggles auto-accept. Manual refresh is still available via command palette (`ayesman.refreshQuota`).
**Migration**: Use `ayesman.refreshQuota` from command palette for manual refresh.
