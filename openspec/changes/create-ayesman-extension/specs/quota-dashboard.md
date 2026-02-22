# Spec: Quota Dashboard Capability

## Context

The Antigravity Webview periodially fetches the current model availability and quota by making an HTTP POST request to a local gRPC server endpoint: `/GetCommandModelConfigs`. The UI hides the detailed percentage from the user. This capability extracts that data.

## Requirements

### Requirement: Network Interception

The injected script MUST intercept the relevant network calls made by the Webview.

#### Scenario: Webview polls for model configs

- **WHEN** the Webview Javascript calls `fetch` or `XMLHttpRequest` directed at the `/GetCommandModelConfigs` endpoint
- **THEN** the intercepted function MUST allow the request to proceed normally
- **THEN** the intercepted function MUST clone the JSON response before returning it to the original caller

### Requirement: Data Extraction and Forwarding

The script MUST extract the required quota metrics from the intercepted JSON payload.

#### Scenario: Response payload is received

- **WHEN** the `/GetCommandModelConfigs` response is successfully intercepted
- **THEN** the system MUST parse the JSON to find the active model's `quotaInfo.remainingFraction`
- **THEN** the system MUST transmit this value (e.g., `1` for `100%`) back to the VS Code Extension Host

### Requirement: Status Bar Display

The AYesMan VS Code extension MUST prominently display the extracted quota in the UI.

#### Scenario: Extension receives quota data

- **WHEN** the VS Code Extension Host receives the model name and quota percentage from the Webview script
- **THEN** the system MUST instantiate or update a `vscode.StatusBarItem`
- **THEN** the system MUST render the text in the format `⚡ [ModelName]: [Percentage]%` (e.g., `⚡ Gemini: 100%`)
- **THEN** the system MUST make the item visible on the right or left aligned status bar
