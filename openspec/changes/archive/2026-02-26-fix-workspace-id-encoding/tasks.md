## 1. Fix workspace ID encoding in discovery.ts

- [x] 1.1 In `ayesman/src/server/discovery.ts`, update the workspace ID comparison line: add `.replace(/:/g, "_3A")` before `.replace(/\//g, "_")` in the `expected` string construction
- [x] 1.2 Verify the generated expected value now matches `file_d_3A_side_project_<name>` format for Windows paths

## 2. Build & package

- [x] 2.1 Run `npm run package` in `ayesman/` to rebuild `dist/extension.js`
- [x] 2.2 Run `npx vsce package` to produce a new `.vsix` (bump version in `package.json` to `1.4.8` first)

## 3. Deploy & verify

- [x] 3.1 Deploy the new VSIX to Antigravity extensions folder and reload the window
- [x] 3.2 Open AYesMan output channel and confirm log shows `Workspace/parentPid mode: X candidate(s)` (not "no match, falling back to global mode") for the current workspace
- [x] 3.3 Run an Antigravity agent task with a terminal command and confirm it is auto-accepted without manual intervention
