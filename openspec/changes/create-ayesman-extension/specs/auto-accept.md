# Spec: Auto-Accept Capability

## Context

The Antigravity Agent frequently asks the user for permission before executing terminal commands by displaying a button in the Webview UI. This capability automates the clicking of that button.

## Requirements

### Requirement: DOM Observation

The injected script MUST continuously monitor the Webview DOM for new elements that represent the command confirmation prompt.

#### Scenario: Agent proposes a command

- **WHEN** the Antigravity Agent finishes generating a terminal command and displays the "Accept" / "Run" button
- **THEN** the `MutationObserver` MUST detect the new button element based on its selector or text content
- **THEN** the system MUST programmatically trigger a user click event on the button immediately

### Requirement: Robustness

The script MUST ONLY click the confirmation button when appropriate and avoid infinite clicking loops.

#### Scenario: Button is clicked

- **WHEN** the button is clicked
- **THEN** the script MUST wait until the Agent finishes the next execution cycle before attempting to observe a new button (or track clicked buttons to avoid duplicate clicks).
