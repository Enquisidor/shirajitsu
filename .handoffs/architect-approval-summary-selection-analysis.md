# Gate 2 Handoff — Selection-Based Analysis Architect Review

**Session:** selection-analysis-2026-05-15
**Phase:** 2 (Architect)
**Gate:** 2 (Tech Lead / PM approval of spec artifacts)
**Date:** 2026-05-19
**Prepared by:** Orchestrator (on behalf of Architect)

---

## Summary

The Architect has produced all spec artifacts for the SelectionAnalysis feature area. Five implementation issues (ISS-004 through ISS-008), a bounded context document, and six decision log entries (DEC-017 through DEC-022) are ready for Gate 2 review.

---

## Artifacts produced

| Artifact | Path | Status |
|---|---|---|
| SelectionAnalysis bounded context | `.spec/bounded-contexts/selection-analysis.md` | Complete |
| ISS-004: Content script SelectionContext capture | `.spec/issues/ISS-004-selection-capture-content-script.md` | Complete |
| ISS-005: Popup CTA adaptation + SelectionLengthGuard | `.spec/issues/ISS-005-popup-selection-cta-adaptation.md` | Complete |
| ISS-006: Inline highlighter SelectionCharacterMap + HighlightColor | `.spec/issues/ISS-006-inline-highlighter-selection-mode.md` | Complete |
| ISS-007: HighlightColor UserSettings extension + settings UI | `.spec/issues/ISS-007-highlight-color-settings-ui.md` | Complete |
| ISS-008: PerSelectionModelOverride model picker | `.spec/issues/ISS-008-per-selection-model-picker.md` | Complete |
| Decision log entries DEC-018 through DEC-022 | `.logs/decisions.md` | Complete |

---

## Issue overview

### ISS-004 — Content script SelectionContext capture
**Complexity:** M | **Depends on:** none
- Extends `GET_CONTEXT` to return `selection: SelectionContext | null` alongside `DetectedContext`
- Adds `extractSelection()` to `extractor.ts` — builds selection-relative `CharacterMapEntry[]` from the active DOM range
- Extends `RUN_ANALYSIS` to route between `extractSelection()` (selection mode) and existing `extractText()` (whole-page mode)
- Files: `content/index.ts`, `context/extractor.ts`

### ISS-005 — Popup CTA adaptation + SelectionLengthGuard
**Complexity:** L | **Depends on:** ISS-004
- Selection-aware CTA: "Analyze selection" (primary) / "Analyze whole page" (secondary de-emphasized) when selection present
- SelectionPreview: 80-char truncation shown beneath primary CTA
- SelectionLengthGuard: 5-word minimum enforced on submit; inline warning if not met
- Reactive updates via `SELECTION_CHANGED` message (150ms debounce on `selectionchange` — DEC-019)
- New helper module: `popup/selectionHelpers.ts` (`selectionMeetsLengthRequirement`, `selectionPreview`)
- Files: `popup/Popup.tsx`, `popup/selectionHelpers.ts`, `content/index.ts` (selectionchange listener)

### ISS-006 — Inline highlighter HighlightColor layering + selection routing
**Complexity:** M | **Depends on:** ISS-004, ISS-005
- `applyHighlights()` gains a `highlightColor: string` parameter
- Each span: `backgroundColor = highlightColor`, `outline = risk-level color` (DEC-021)
- Content script `SHOW_ANNOTATIONS` handler routes to `extractSelection()` or `extractText()` based on `selectionAnalysisMode`
- Files: `highlight/inline-highlighter.ts`, `content/index.ts`

### ISS-007 — HighlightColor UserSettings + settings UI
**Complexity:** M | **Depends on:** none
- Adds `highlightColor: string` to `UserSettings` interface and `DEFAULT_USER_SETTINGS` (`'#FFFF00'`)
- Adds `<input type="color">` in a collapsible settings section in the popup (DEC-020)
- Files: `shared/types/src/settings.ts`, `popup/Popup.tsx`

### ISS-008 — PerSelectionModelOverride model picker
**Complexity:** S | **Depends on:** ISS-005
- Adds ephemeral `perSelectionModel: AIModel | null` state to popup
- Per-selection model picker visible only when `selection !== null`; uses `perSelectionModel ?? settings.selectedModel` on submit
- Never written to `chrome.storage.sync` — invariant commented in code
- Shows all `SUPPORTED_MODELS` (MVP limitation documented as DEC-022)
- Files: `popup/Popup.tsx`

---

## Dependency graph and suggested implementation order

```
ISS-004 (no deps, M)
  └── ISS-005 (depends ISS-004, L)
        ├── ISS-006 (depends ISS-004+005, M) ─┐
        └── ISS-008 (depends ISS-005, S)      │
                                               │
ISS-007 (no deps, M) ─────────────────────────┘
                                               │
                             ISS-006 should start after ISS-007 is merged
                             (ISS-006 reads settings.highlightColor; ISS-007 adds it)
```

**Recommended sequence:**
1. ISS-004 and ISS-007 in parallel (no deps)
2. ISS-005 after ISS-004 completes
3. ISS-008 after ISS-005 completes
4. ISS-006 after ISS-004 + ISS-005 + ISS-007 complete

---

## Decisions requiring PM/Tech Lead confirmation

| DEC | Topic | Status |
|---|---|---|
| DEC-018 | 5-word SelectionLengthGuard threshold | **PM confirmation needed** — is 5 words the right minimum? |
| DEC-022 | Show all SUPPORTED_MODELS in per-selection picker | Accepted by PM (MVP limitation) |

---

## No new backend endpoints

All five issues are frontend-only. No API contract changes, no backend issues.

---

## Gate 2 checklist

- [x] Bounded context document written
- [x] All issues have acceptance criteria
- [x] All issues have complexity estimates
- [x] Dependency graph defined and acyclic
- [x] Decisions logged (DEC-018 through DEC-022)
- [x] No backend scope introduced
- [x] `pnpm typecheck` gate called out in all issues
- [ ] PM/Tech Lead confirms 5-word SelectionLengthGuard threshold (DEC-018)
- [ ] PM/Tech Lead approves Gate 2

---

## Recommended Gate 2 verdict

**APPROVE with one open question:** Confirm DEC-018 (5-word threshold). QA Strategist can proceed; Test Engineer Phase 1 can proceed in parallel. If PM changes the threshold, only the `selectionMeetsLengthRequirement()` predicate changes — no cascading spec impact.
