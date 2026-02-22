# Tasks: create-ayesman-extension

## 1. Extension Scaffolding

- [x] 1.1 Use `yo code` or a similar generator to create the core VS Code extension named `AYesMan` (or `ayesman-agent`).
- [x] 1.2 Update `package.json` with the correct publisher, description, and activation events (e.g. `onStartupFinished` or listening to the specific webview view type).

## 2. Webview Content Script Development

- [x] 2.1 Create a generic JavaScript file (`ayesman-inject.js`) to serve as the Content Script.
- [x] 2.2 Implement a `MutationObserver` within the script to find and automatically `.click()` terminal confirmation ("Accept" / "Run") buttons.
- [x] 2.3 Implement robust logic to monkey-patch `window.fetch` or `XMLHttpRequest` to intercept the `GetCommandModelConfigs` API request.
- [x] 2.4 Parse the intercepted JSON to extract the active model's name and `quotaInfo.remainingFraction`.
- [x] 2.5 Hook up `window.postMessage` or specific VS Code messaging to broadcast the extracted quota.

## 3. Extension Host Implementation (Backend)

- [x] 3.1 Investigate methods to inject the `ayesman-inject.js` script into the Antigravity `iframe` / Webview. (Options include evaluating VS Code UI APIs, CDP Debugging, or locating persistent script files on disk).
- [x] 3.2 Create a `vscode.StatusBarItem` in `extension.ts` aligned to the right.
- [x] 3.3 Setup a message listener to receive the quota updates from the Content Script.
- [x] 3.4 Update the Status Bar text and color dynamically based on the received quota (e.g., green for >50%, red for <10%).

## 4. Verification & Testing

- [ ] 4.1 Build and run the extension via F5.
- [ ] 4.2 Start an Antigravity Agent task that requires terminal execution.
- [ ] 4.3 Verify that the Agent command is accepted automatically without manual clicking.
- [ ] 4.4 Verify that the VS Code Status bar correctly displays the model quota (e.g., `⚡ Gemini: 100%`).
