# Tasks: create-ayesman-extension

## 1. Extension Scaffolding

- [x] 1.1 Create the core VS Code extension named `AYesMan`.
- [x] 1.2 Update `package.json` with correct publisher, description, and activation events (`onStartupFinished`).

## 2. Auto-Accept (FAILED)

- [x] 2.1 Research Antigravity internal commands (`acceptAgentStep`, `terminalCommand.accept`, etc.)
- [x] 2.2 Attempt `executeCommand('antigravity.agent.acceptAgentStep')` → **FAILED** (gRPC CSRF + cascade_id required)
- [x] 2.3 Attempt Webview DOM injection (`chat.js` patching) → **FAILED** (chat panel is native workbench component, not a Webview)
- [x] 2.4 Extract CSRF token & API port from `language_server_windows_x64.exe` process → **SUCCESS** but missing `cascade_id`
- [x] 2.5 Evaluate keyboard simulation (Alt+Enter) → **REJECTED** (interferes with normal development)

> **Conclusion**: All auto-accept approaches exhausted. Feature deferred.

## 3. Quota Dashboard (COMPLETED)

- [x] 3.1 Discover language server gRPC endpoint (process inspection + port probing)
- [x] 3.2 Call `GetUserStatus` and `GetCommandModelConfigs` gRPC methods for quota data
- [x] 3.3 Display lowest-quota model in `StatusBarItem` with severity icon
- [x] 3.4 Rich hover tooltip: all models sorted alphabetically with 🟢/🟡/🔴, reset times, and credits
- [x] 3.5 Periodic polling (2 min) + click-to-refresh

## 4. Verification

- [x] 4.1 Compile extension with 0 TypeScript errors
- [x] 4.2 Deploy to `~/.antigravity/extensions/` and verify status bar displays quota
- [x] 4.3 Verify hover tooltip shows all models with correct data
- [ ] ~~4.4 Verify auto-accept~~ → **SKIPPED** (feature not implemented)
