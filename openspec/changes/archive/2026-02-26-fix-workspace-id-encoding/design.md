## Context

AYesMen discovers the correct Antigravity language server by matching the `--workspace_id` flag in the language server's command line against the current VS Code workspace folders. After a Google Antigravity IDE update (v1.107.0), the workspace ID encoding format changed: Windows drive-letter colons are now hex-encoded (`:` → `_3A`) rather than kept as literal characters.

Current broken example:
- Server emits: `--workspace_id file_d_3A_side_project_AYesMen`
- Code generates: `file_d:_side_project_ayesmen`
- Result: no match → falls to global mode → connects to the first responding server (may be wrong window)

## Goals / Non-Goals

**Goals:**
- Fix workspace ID comparison to match the new `_3A` encoding of `:`
- Keep global-mode fallback for edge cases (no matching server found)
- Change is isolated to one function in `discovery.ts`

**Non-Goals:**
- Changing any other encoding characters beyond `:` (none observed)
- Persisting or caching workspace IDs
- Fixing the parentPid matching path (still works as before)

## Decisions

### Decision: Encode `:` as `_3A` in generated workspace ID

**Chosen**: Update the path transformation in `discovery.ts` to replace `:` with `_3A` before comparing against the server's `--workspace_id`.

```typescript
// Before
const expected = `${f.uri.scheme}_${path.replace(/\//g, "_")}`.toLowerCase();

// After
const expected = `${f.uri.scheme}_${path.replace(/:/g, "_3A").replace(/\//g, "_")}`.toLowerCase();
```

**Alternatives considered**:
- *Try both formats*: Match if either literal-colon format OR `_3A` format matches the server ID. This would provide forward/backward compatibility but adds complexity for a single-file hotfix.
- *URL-encode all non-alphanumeric chars*: General solution but over-engineered; only `:` is observed to differ.

**Rationale**: The minimal one-line change is safest for a targeted hotfix. If Antigravity reverts, we update this one line again.

### Decision: Apply fix only to the `replace` chain in workspace matching

The fix only touches the string construction in the workspace ID match inside `discoverServer()`. No other code paths are affected.

## Risks / Trade-offs

- [Risk] Antigravity reverts or changes encoding again → Mitigation: The fix is a single `replace` call; easy to update when observed.
- [Risk] Other non-alphanumeric chars in workspace paths (spaces, brackets) → Mitigation: Out of scope; not observed in practice. Can be addressed if reported.
- [Risk] Case sensitivity on different platforms → Mitigation: both sides are lowercased before comparison (already true in existing code).

## Migration Plan

1. Change one line in `discovery.ts`
2. Rebuild with `npm run package`
3. Repackage VSIX with `npx vsce package`
4. Redeploy to Antigravity extensions folder
5. Reload window in Antigravity

No rollback needed; the old code path (global fallback) still exists if matching fails.
