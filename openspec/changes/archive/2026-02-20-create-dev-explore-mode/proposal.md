# Proposal: create-dev-explore-mode

## Summary

The Google Antigravity extension has undergone updates that render many existing tools and commands obsolete. To adapt to these changes and build a robust foundation for a new extension (which will eventually handle auto-approvals and model usage tracking), we first need to understand the current capabilities of the Google Antigravity extension.

This change introduces a "Dev Explorer Mode". The goal of this mode is to discover and dump all available commands (especially those prefixed with `antigravity`, `cursor`, or `ai`) and settings (configurations related to models, tokens, etc.) from the VS Code environment. This provides developers with immediate visibility into hidden or undocumented APIs exposed by the latest version of Google Antigravity.

## Impact

- **New VS Code Extension**: A foundational VS Code extension scaffold will be created.
- **Commands**: Registration of a new VS Code command (e.g., `Antigravity Explorer: Dump Commands & Settings`).
- **File System / Workspace**: The command will output JSON logs (either in an Output Channel or a new untitled text document) detailing the discovered commands and configurations.
- **Dependencies**: Requires `vscode` extension API.

## Out of Scope

- **Auto-Approve Mechanism**: Implementing the actual interception and auto-approval of commands is deferred to a later change.
- **Model Usage Dashboard**: A full UI/dashboard for tracking and displaying model token usage is not included here.
- **Reverse Engineering**: Advanced reverse engineering of binary components or obfuscated code within Google Antigravity is out of scope; we rely strictly on the official VS Code Extension API.
