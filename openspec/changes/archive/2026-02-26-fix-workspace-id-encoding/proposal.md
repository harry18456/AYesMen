## Why

After a Google Antigravity IDE update, the language server's `--workspace_id` flag changed its encoding format: the colon `:` in Windows drive paths is now percent-hex-encoded as `_3A` (e.g., `file_d_3A_side_project_AYesMen`) instead of being kept as a literal character. AYesMen's workspace matching code generates the old format, so it never matches any server, silently falls back to global mode, and connects to whichever language server responds first — which may belong to a different workspace window. This breaks auto-accept entirely in multi-window setups.

## What Changes

- Update the workspace ID comparison logic in `discovery.ts` to percent-hex-encode non-alphanumeric, non-slash characters (specifically `:` → `_3A`) before comparison
- Add a second candidate match format so the fix is forward-compatible if the format changes again

## Capabilities

### New Capabilities

*(none — this is a bug fix with no new user-visible capability)*

### Modified Capabilities

- `auto-accept`: The server discovery step that selects which language server to connect to now correctly matches the current workspace, fixing silent connection to the wrong server in multi-window environments.

## Impact

- **Code**: `ayesman/src/server/discovery.ts` (workspace ID generation logic)
- **Behavior**: workspace/parentPid mode now correctly matches in environments with multiple open Antigravity windows after the IDE update
- **No API changes**, no new dependencies
