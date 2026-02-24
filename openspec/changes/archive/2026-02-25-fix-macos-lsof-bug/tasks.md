## 1. Fix macOS lsof Bug

- [x] 1.1 In `ayesman/src/server/platform/unix.ts`, modify `findListeningPorts` to add the `-a` flag to the `lsof` command.
- [x] 1.2 In the same file, modify `findExtHostConnectedPorts` to also add the `-a` flag to the `lsof` command.

## 2. Verification

- [x] 2.1 Build the extension to ensure there are no syntax errors.
- [x] 2.2 Re-run the tests or verify manually that `unix.ts` still fetches ports correctly on macOS, and no longer fetches ports from other language server instances.
