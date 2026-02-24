# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AYesMan is an unofficial VS Code extension for **Google Antigravity** that adds:
1. **Quota Dashboard** — surfaces model quota percentages in the status bar tooltip (every 2 min)
2. **Auto-Accept** — automatically confirms terminal commands proposed by the Antigravity agent (every 500ms)

Both features work by reverse-engineering Antigravity's internal gRPC language server API at `127.0.0.1`.

## Build & Deploy

All commands run from `ayesman/`:

```bash
# Type-check only (no output)
npm run compile

# Build for production (bundles to dist/extension.js via esbuild)
npm run package

# Package as installable VSIX
npx vsce package
```

**Deploy to Antigravity (developer mode, PowerShell):**
```powershell
$dest = "$env:USERPROFILE\.antigravity\extensions\ayesmen.ayesman-1.0.0"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
Copy-Item -Recurse ".\ayesman" $dest
# Then: Ctrl+Shift+P → "Developer: Reload Window" in Antigravity
```

There are no tests. There is no lint script.

## Architecture

```
src/
  extension.ts          — activate() entry point; owns module-level _autoAcceptEnabled state
  types/index.ts        — shared types: ServerInfo, ProcessInfo, QuotaEntry, CreditsInfo
  logger.ts             — output channel wrapper

  server/
    discovery.ts        — discoverServer(): parentPid matching → global fallback; 5-min cache
    grpc.ts             — callGrpc(): raw HTTP/HTTPS POST to language server API
    probe.ts            — probePort(): Heartbeat check to validate a port
    platform/
      windows.ts        — findLanguageServerProcesses (PowerShell), findListeningPorts (netstat)
      unix.ts           — findLanguageServerProcesses (ps), findListeningPorts (lsof)

  autoAccept/
    loop.ts             — setInterval 500ms; reads cached server, calls tryAutoAcceptStep
    acceptStep.ts       — GetAllCascadeTrajectories → GetCascadeTrajectorySteps → HandleCascadeUserInteraction

  quota/
    fetch.ts            — fetchQuota(): GetUserStatus + GetCommandModelConfigs
    state.ts            — module-level quota/credits state (getLatestQuota, setLatestQuota, etc.)

  ui/
    statusBar.ts        — unified status bar item; text, background color, tooltip markdown
```

### Key Design Decisions

**Server discovery uses parentPid matching.** Each Antigravity window has one `node.mojom.NodeService` process (the Extension Host). The language server is its direct child, so `language_server.parentPid === process.pid` precisely identifies the server for this window. Falls back to global mode (first responding server) when parentPid is unavailable.

**Auto-accept state is in-memory (`_autoAcceptEnabled` in `extension.ts`).** Each VS Code window has an independent Extension Host with its own JS heap, so this is naturally per-window. State is never persisted — every window starts with auto-accept ON.

**Platform-specific code is fully isolated.** `discovery.ts` imports the correct platform module at runtime (`process.platform === "win32"`). New platform methods must be added to both `windows.ts` and `unix.ts`.

**The auto-accept loop never calls `discoverServer()` directly** — it only reads from cache (`getCachedServerInfo()`). Discovery is triggered by the quota polling cycle, which prevents race conditions.

**gRPC is faked as HTTP/JSON.** Antigravity uses the Connect protocol, which accepts JSON over HTTP POST. No protobuf library is needed. All calls go to `/exa.language_server_pb.LanguageServerService/<Method>` with `x-codeium-csrf-token` header.

## OpenSpec Workflow

Feature changes use the OpenSpec spec-driven workflow:

```bash
openspec new change "<name>"       # scaffold a new change
openspec status --change "<name>"  # check artifact progress
openspec instructions <artifact> --change "<name>"  # get writing instructions
openspec list                      # list all active changes
```

Artifacts in order: `proposal.md` → `design.md` + `specs/**/*.md` → `tasks.md`

Active changes: `openspec/changes/<name>/`
Main specs: `openspec/specs/<capability>/spec.md`
Archived changes: `openspec/changes/archive/`

Slash commands available: `/opsx:ff`, `/opsx:apply`, `/opsx:sync`, `/opsx:archive`, `/opsx:explore`
