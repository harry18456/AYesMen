## Context

AYesMan relies on `discoverServer()` to find the correct local Antigravity Language Server port for the current VS Code Extension Host. 
To achieve per-window session isolation, it filters the discovered language servers by checking if their `parentPid` matches the current `process.pid` (the VS Code Extension Host).

On Unix platforms (specifically macOS), finding the listening ports for a process is done using `lsof -i -n -P -p <PID>`.

**Current Issue:**
By default, the `lsof` command ORs multiple selection options. The command `lsof -i -p <PID>` instructs `lsof` to list ALL network files across the entire system OR all files opened by the specific `<PID>`. 
Consequently, `ayesman`'s probe receives the ports of ALL language servers currently running on the Mac. It then connects to the first port that responds to a heartbeat, regardless of which window that port belongs to. This destroys per-window session isolation and causes commands to be routed to the wrong project.

## Goals / Non-Goals

**Goals:**
- Fix the `lsof` command on macOS/Linux to ONLY return network listening ports that belong to the specified PID.
- Ensure `findExtHostConnectedPorts` also correctly filters by PID.

**Non-Goals:**
- Changing the session matching logic (`parentPid`) which itself is correct.
- Changing Windows platform logic (which uses `netstat` and explicitly filters the parsed output by PID).

## Decisions

### Decision 1: Use the `-a` (AND) flag in `lsof`

**Choice:** We will append the `-a` flag to the `lsof` commands executed in `ayesman/src/server/platform/unix.ts`.

**Rationale:** The `-a` flag in `lsof` forces the selection options to be ANDed together. Therefore, `lsof -a -i -p <PID>` will only return files that are BOTH network files AND opened by the specific PID. This is the canonical and most performant way to restrict `lsof` output to a specific process's network activity.

**Alternatives Considered:**
- **Filtering the output manually in JavaScript**: We could parse the `stdout` of the current `lsof` command and manually filter for the PID column. However, parsing the massive output of all system network connections is extremely inefficient, and `lsof` already provides a native flag specifically for this purpose.

## Risks / Trade-offs

- **[Risk]** The `-a` flag behavior might differ on some obscure Linux distributions.
  - **Mitigation**: `lsof` behavior with `-a` is POSIX standard and highly consistent across macOS and mainstream Linux distributions (Ubuntu, Debian, Fedora).
- **[Risk]** Changing `lsof` might cause it to miss ports if the language server binds them in a subprocess.
  - **Mitigation**: The language server process itself creates the socket binder. `lsof -p` correctly tracks threads of that PID. The previous behavior of catching *everything* was simply a bug, not a feature.
