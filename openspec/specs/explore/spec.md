# Spec: Dev Explorer Mode

## Purpose

TBD

## Requirements

### Requirement: Command Discovery

The extension MUST provide a mechanism to discover and list all available VS Code commands that match specific keywords related to the target extension (e.g., `antigravity`).

- **Scenario**: User triggers the explore command
  - **WHEN** the user executes the `Antigravity Explorer: Dump Commands & Settings` command
  - **THEN** the system MUST retrieve all registered VS Code commands
  - **THEN** the system MUST filter these commands for the `antigravity` prefix
  - **THEN** the system MUST include the filtered list in the output JSON

### Requirement: Setting Discovery

The extension MUST provide a mechanism to discover and list all available VS Code configurations/settings related to the target extension.

- **Scenario**: User triggers the explore command
  - **WHEN** the user executes the `Antigravity Explorer: Dump Commands & Settings` command
  - **THEN** the system MUST execute a shell command to read from the internal SQLite database (`state.vscdb`) of the extension
  - **THEN** the system MUST extract sections relevant to the target extension (e.g. `antigravityUnifiedStateSync`)
  - **THEN** the system MUST include the extracted configurations in the output JSON

### Requirement: Output Display

The extension MUST present the discovered information to the user in a readable format.

- **Scenario**: Displaying exploration results
  - **WHEN** the discovery process completes
  - **THEN** the system MUST format the results as a formatted JSON string
  - **THEN** the system MUST open a new, unsaved text document in the editor containing the formatted JSON string
