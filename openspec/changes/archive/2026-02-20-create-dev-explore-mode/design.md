# Design: create-dev-explore-mode

## Context

The Google Antigravity extension has been updated, breaking existing tools. To build a new extension that interacts with it, we first need a way to explore the current VS Code environment to find available commands and configurations. This change sets up a basic VS Code extension with a "Dev Explorer Mode" command to dump this information.

## Goals / Non-Goals

**Goals:**

- Create a basic VS Code extension scaffold.
- Implement a command to discover and list VS Code commands matching specific keywords (e.g., `antigravity`, `ai`).
- Implement a command/mechanism to read and list VS Code workspace configurations related to these keywords.
- Output the gathered information in a readable format (e.g., formatting it as JSON in an unsaved text document).

**Non-Goals:**

- Implementing the auto-approve logic.
- Implementing a UI/Dashboard for model usage.
- Publishing the extension to the marketplace.

## Proposed Solution

1. **Extension Scaffold**: Use standard VS Code extension skeleton (TypeScript).
2. **Command Registration**: Register `antigravity-dev.explore` command.
3. **Execution Logic**:
   - Call `vscode.commands.getCommands(true)`.
   - Filter results for relevant prefixes.
   - Call `vscode.workspace.getConfiguration()` for relevant prefixes.
   - Format the results into a JSON string.
   - Use `vscode.workspace.openTextDocument` and `vscode.window.showTextDocument` to display the result to the user.

## Data Model

No persistent data model. The data is a transient JSON payload containing:

```json
{
  "commands": ["..."],
  "configurations": { "...": "..." }
}
```

## API / Interfaces

- Action: `antigravity-dev.explore` command exposed via Command Palette.

## Key Decisions

- **Output Format**: Using an untitled text document allows the user to easily search, copy, and save the output without cluttering the output panel or requiring a complex WebView UI for this initial exploration phase.

## Risks / Trade-offs

- **VS Code API Limitations**: We can only see what is officially registered through the VS Code API. If Antigravity uses heavily obfuscated or non-standard ways to store state (e.g., custom binary files not exposed to the workspace settings), we won't be able to see it using this method. Trade-off is accepted as this is the standard and safest first step.
