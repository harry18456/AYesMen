## ADDED Requirements

### Requirement: Cross-Platform Session Isolation
AYesMan MUST ensure per-window session isolation works consistently across all supported platforms (Windows, macOS, Linux).

#### Scenario: Discovering Language Server on macOS/Linux
- **WHEN** AYesMan uses `lsof` to find listening ports for the Extension Host process on macOS or Linux
- **THEN** it MUST use the `-a` flag (AND) to ensure it only returns network ports that actually belong to that specific Extension Host process, preventing cross-window contamination.
