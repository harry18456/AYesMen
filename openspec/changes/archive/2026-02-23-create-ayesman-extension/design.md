# Design: AYesMan Extension

## Context

The Antigravity VS Code Extension utilizes a Webview for user interaction and issues commands via a local HTTP gRPC server rather than native VS Code commands. The official settings for auto-running commands are unreliable, and the UI has hidden the remaining model quota. To resolve this, we will build a companion extension (`AYesMan`) that injects a Content Script into the Antigravity Webview to manipulate the DOM (for auto-clicking) and monkey-patch network requests (to extract quota information).

## Goals / Non-Goals

**Goals:**

- Inject custom JavaScript into the Antigravity Webview `iframe`.
- Automatically click the "Accept" or "Run" buttons when terminal confirmation is required.
- Intercept the `GetCommandModelConfigs` HTTP response to read the quota `remainingFraction`.
- Display the quota in the VS Code Status Bar.

**Non-Goals:**

- Bypassing the local gRPC server's CSRF authentication manually from the Extension Host.
- Replacing the Antigravity extension entirely.
- Handling interactions outside the Antigravity Webview.

## Architecture

The system consists of two main components:

1. **The Extension Host (Backend)**:
   - Registers a VS Code Status Bar item to display quota.
   - Listens for messages from the injected Webview content script.
2. **The Content Script (Webview Injector)**:
   - Injected into the Antigravity Webview DOM.
   - Sets up a `MutationObserver` to watch for the appearance of confirmation buttons and triggers `.click()`.
   - Monkey-patches `window.fetch` or `XMLHttpRequest` to intercept responses ending with `/GetCommandModelConfigs`.
   - Uses `window.parent.postMessage` or specific VS Code Webview messaging APIs to send extracted quota data back to the Extension Host.

## Solutions / Key Decisions

- **Injection Method**: Since VS Code strongly isolates Webviews for security, we may need to explore scanning the DOM via the Extension Host's debugger API or utilizing a periodic interval script injection. If direct injection fails, we will utilize the Chrome DevTools Protocol (CDP) via the `vscode.debug.activeDebugSession` (or similar node inspectors) to target the Webview target.
- **Quota Parsing**: The payload from `GetCommandModelConfigs` is a JSON string. The script will parse this, retrieve the quota for the active model (e.g., `remainingFraction: 1`), and compute a percentage.

## Risks / Trade-offs

- **VS Code Updates**: VS Code frequently changes its internal Webview iframe structure and security policies, which may break the injection script.
- **Antigravity Updates**: If Antigravity changes its DOM structure (button class names/IDs) or changes its API endpoint (`GetCommandModelConfigs`), the automation will break and require maintenance.
