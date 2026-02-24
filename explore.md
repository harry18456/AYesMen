# macOS PID Session Matching Issue Analysis

## The Problem

When running on macOS, AYesMan occasionally connects to the wrong Antigravity language server in multi-window environments. This causes the auto-accept loop and quota fetching to interact with a different project's session.

## Root Cause

The issue lies in how `unix.ts` discovers listening ports for a given PID on macOS:

```typescript
// Current implementation in ayesman/src/server/platform/unix.ts
const { stdout } = await execAsync(
  `lsof -i -n -P -p ${pid} 2>/dev/null | grep LISTEN`,
  { timeout: 10000 },
);
```

By default, the `lsof` command **ORs** its selection options. This means `lsof -i -p <PID>` instructs `lsof` to list:
1. ALL network files (`-i`) across the ENTIRE system
**OR**
2. ALL files opened by `<PID>` (`-p <PID>`)

Because of this, the command returns the listening ports for **every** language server currently running on the Mac, not just the one belonging to the specific `pid`.

When `discovery.ts` iterates through the found processes, it takes the first one that successfully responds to the port probe. Since all PIDs return the exact same massive list of system-wide ports, it simply connects to the first valid port it probes (which is usually the one from the oldest VS Code window).

## The Fix

We need to add the `-a` (AND) flag to `lsof` so it restricts the network files (`-i`) to ONLY those opened by the specified process (`-p`):

```typescript
// Fixed implementation
const { stdout } = await execAsync(
  // Added -a flag here 
  `lsof -a -i -n -P -p ${pid} 2>/dev/null | grep LISTEN`,
  { timeout: 10000 },
);
```

The same fix needs to be applied to `findExtHostConnectedPorts`:

```typescript
const { stdout } = await execAsync(
  // Added -a flag here
  `lsof -a -iTCP -sTCP:ESTABLISHED -n -P -p ${pid} 2>/dev/null`,
  { timeout: 10000 },
);
```

This ensures AYesMan only discovers ports genuinely belonging to the correct process tree, successfully isolating sessions per window on macOS exactly as it does on Windows.
