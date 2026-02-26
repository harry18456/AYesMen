## MODIFIED Requirements

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
