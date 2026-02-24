## Why

When AYesMan runs on macOS with multiple VS Code windows open (multi-project setup), it often connects to the wrong Antigravity language server. This causes the auto-accept loop and quota fetching to interact with a different project's session.

The root cause is a macOS-specific behavior in the `lsof` command. The command currently used is `lsof -i -n -P -p <PID>`. On macOS, `lsof` defaults to a logical OR for its selection options. This means it returns ALL network ports on the system OR all files opened by the PID. As a result, AYesMan receives the listening ports for every language server currently running, and connects to the first one it finds (usually from the oldest window), completely breaking per-window session isolation.

## What Changes

1. **Fix `findListeningPorts` on Unix:** Add the `-a` (AND) flag to the `lsof` command in `ayesman/src/server/platform/unix.ts`.
2. **Fix `findExtHostConnectedPorts` on Unix:** Add the `-a` (AND) flag to similar `lsof` commands.

This forces `lsof` to only return network ports that actually belong to the specified Extension Host PID.

## Capabilities

### New Capabilities

*(None)*

### Modified Capabilities

- `ayesman-session`: Fixes the MacOS session matching bug where the per-window isolation was fundamentally broken due to system-level command behavior.

## Impact

- `ayesman/src/server/platform/unix.ts`: The `lsof` commands will be modified to include the `-a` flag.
- **Testing needed**: Verify on macOS that multiple Antigravity windows now correctly isolate their AYesMan sessions without cross-talk.
