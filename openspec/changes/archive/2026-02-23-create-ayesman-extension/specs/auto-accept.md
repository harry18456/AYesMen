# Spec: Auto-Accept Capability

## Context

The Antigravity Agent frequently asks the user for permission before executing terminal commands or applying code changes. This capability aims to automate the acceptance of those steps.

## Status: ⛔ Blocked

After extensive research, all viable approaches have been exhausted:

- **`executeCommand('antigravity.agent.acceptAgentStep')`**: The VS Code command is registered but internally delegates to a gRPC call (`HandleCascadeUserInteraction`) that requires a CSRF token AND a `cascade_id`, which is only available within the workbench's internal state.
- **Webview DOM injection**: The Antigravity chat panel is a native workbench component, NOT a standard VS Code Webview. Injecting into `chat.js` has no effect.
- **gRPC direct call**: CSRF token and API port can be extracted from the `language_server_windows_x64.exe` process, but the `cascade_id` (identifying the active conversation) cannot be obtained externally.
- **Keyboard simulation (Alt+Enter)**: Technically possible but would severely interfere with normal development workflow.

## Requirements

### Requirement: Agent Step Auto-Accept

The extension SHOULD automatically accept pending agent steps without manual user interaction.

#### Scenario: Agent proposes a command

- **WHEN** the Antigravity Agent finishes generating a terminal command and displays the "Accept" / "Run" button
- **THEN** the system SHOULD programmatically trigger the accept action

> **NOTE**: This requirement is currently unimplemented due to the technical blockers described above. Future approaches may include patching `workbench.desktop.main.js` or investigating Antigravity's built-in auto-run settings.
