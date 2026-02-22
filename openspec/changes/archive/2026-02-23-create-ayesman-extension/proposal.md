# Proposal: create-ayesman-extension

## Why

The official Antigravity (Codeium) extension provides an AI Agent feature in VS Code, but it has two significant pain points for power users:

1. **Flaky Auto-Run**: The official auto-run feature for terminal commands is unreliable, frequently requiring manual intervention to click "Accept" or "Run" before proceeding.
2. **Hidden Model Usage**: Recent versions of the extension obscure or remove the real-time display of model quota and token usage from the UI.

This project, AYesMan, aims to solve these issues by creating a companion VS Code extension that injects a Content Script into the Antigravity Webview. By doing so at the DOM level, we can reliably automate the clicking of "Accept" buttons and intercept the internal network requests (`GetCommandModelConfigs`) to extract and display the user's remaining model quota.

## What Changes

We are creating a brand new VS Code extension named `AYesMan`.
This extension will operate silently in the background when an Antigravity Agent UI is active. It will introduce two main features:

- A DOM observer that automatically clicks any button prompting the user to run a terminal command.
- A status bar item in VS Code that displays the real-time quota remaining for the currently selected AI model (e.g., `⚡ Gemini: 100%`).

## Capabilities

- `[NEW] auto-accept`: A mechanism to inject a script into the Antigravity Webview to observe the DOM and automatically dispatch click events on terminal command confirmation buttons.
- `[NEW] quota-dashboard`: A mechanism to intercept the `GetCommandModelConfigs` HTTP/RPC response within the Webview, parse the `remainingFraction` value, and post it to the VS Code Extension Host for display in the standard Status Bar.

## Impact

- **New Extension**: A new VS Code Extension project will be scaffolded.
- **Webview Injection**: Advanced use of VS Code APIs or DevTools Protocol to pierce the Webview boundary of a third-party extension.
- **User Interface**: Adds a new item to the VS Code Status Bar.
