# ISS-006: Extend inline-highlighter to support SelectionCharacterMap and HighlightColor layering

**ID:** ISS-006
**Title:** Extend inline-highlighter to support SelectionCharacterMap, HighlightColor, and risk-level outline layering
**Bounded context:** SelectionAnalysis — SelectionHighlight sub-context
**Complexity estimate:** M (2–6 hours)
**Security flag:** No
**Performance flag:** No
**Depends on:** ISS-004, ISS-005
**API contract references:** None — frontend-only change. No new backend endpoints.

---

## Description

The current `inline-highlighter.ts` hardcodes `RISK_COLORS` as semi-transparent `rgba` fills applied as `backgroundColor` on highlight spans. It does not accept a `HighlightColor` parameter and does not distinguish between selection-relative and full-page character maps.

This issue extends `applyHighlights()` and the supporting functions to:

**1. Accept `HighlightColor` and apply layered styles**

The `applyHighlights()` function signature changes to accept a `highlightColor: string` parameter (in addition to `annotations` and `characterMap`). The `wrapRange()` function must apply two CSS properties on each highlight span:
- `backgroundColor`: the `HighlightColor` value (e.g., `'#FFFF00'`)
- `outline`: a risk-level CSS `outline` property using the risk-level color (e.g., `'2px solid rgba(230, 57, 70, 0.8)'` for high risk)

The existing `RISK_COLORS` map is repurposed from `backgroundColor` values to `outline` color values. The semi-transparent fills are replaced by the user's HighlightColor as the background. The outline must remain visually distinguishable at the default yellow `#FFFF00` background — use solid or high-opacity colors for the outline.

**2. Consume `selectionAnalysisMode` to select the correct character map**

The `SHOW_ANNOTATIONS` message payload (after ISS-005) includes `selectionAnalysisMode: 'selection' | 'whole-page'`. The content script's `SHOW_ANNOTATIONS` handler must:
- When `selectionAnalysisMode === 'selection'`: call `extractSelection()` to rebuild the SelectionCharacterMap at display time, and pass it to `applyHighlights()`.
- When `selectionAnalysisMode === 'whole-page'`: use the existing `extractText()` path.

The character map is rebuilt at `SHOW_ANNOTATIONS` time (not stored from `RUN_ANALYSIS` time) because the DOM may have changed between when the analysis was submitted and when the results are displayed. For the selection case, the user's selection should still be active when annotations arrive (analysis is fast relative to human interaction time), but if the selection has been cleared, `extractSelection()` will return an empty result and no highlights will be applied — this is acceptable behavior.

**3. Persist `selectionAnalysisMode` in `chrome.storage.session`**

The popup currently persists annotations in `chrome.storage.session` for sidebar recovery on mount. The popup must also persist `selectionAnalysisMode` alongside annotations so that the content script can recover the correct mode if the service worker restarts between the analysis completing and the content script receiving `SHOW_ANNOTATIONS`. This is a small addition to ISS-005's `chrome.storage.session.set()` call, but the content script's recovery path (reading from session storage) is part of this issue's scope.

**4. Read HighlightColor from `settings` in the `SHOW_ANNOTATIONS` handler**

The `SHOW_ANNOTATIONS` message payload already includes `settings: UserSettings`. After ISS-007 adds `highlightColor` to `UserSettings`, the content script must read `settings.highlightColor` and pass it to `applyHighlights()`. For this issue, use `settings.highlightColor ?? '#FFFF00'` as the fallback until ISS-007 adds the field to `UserSettings`.

**Gherkin scenarios satisfied:**
- `selection-inline-highlights.feature`: "Highlights are applied within the selected region after selection-based analysis"
- `selection-inline-highlights.feature`: "Highlight positions are resolved relative to the selected text"
- `selection-inline-highlights.feature`: "Existing whole-page highlight anchoring is unchanged after whole-page analysis"
- `selection-settings.feature`: "Chosen highlight color is applied to highlights from selection-based analysis"
- `selection-settings.feature`: "Chosen highlight color is applied to highlights from whole-page analysis"
- `selection-settings.feature`: "Highlight color is layered on top of risk-level color coding"

---

## Files to modify

- `ui/extension/src/highlight/inline-highlighter.ts` — add `highlightColor` parameter; change `backgroundColor` to user color; change `RISK_COLORS` to outline colors
- `ui/extension/src/content/index.ts` — read `selectionAnalysisMode` from `SHOW_ANNOTATIONS` payload; call `extractSelection()` or `extractText()` accordingly; pass `highlightColor` to `applyHighlights()`

---

## Acceptance criteria

- [ ] `applyHighlights(annotations, characterMap, highlightColor)` accepts a third `highlightColor: string` parameter
- [ ] Each highlight span has `backgroundColor` set to `highlightColor`
- [ ] Each highlight span has `outline` set to a risk-level-specific color (e.g., `'2px solid rgba(230, 57, 70, 0.9)'` for high, `'2px solid rgba(244, 162, 97, 0.9)'` for medium, `'2px solid rgba(82, 183, 136, 0.9)'` for low)
- [ ] Both `backgroundColor` and `outline` are applied simultaneously on each span — the risk-level color is still visually distinguishable when the background is yellow (#FFFF00)
- [ ] When `SHOW_ANNOTATIONS` arrives with `selectionAnalysisMode === 'selection'`, the content script calls `extractSelection()` and passes the resulting `characterMap` to `applyHighlights()`
- [ ] When `SHOW_ANNOTATIONS` arrives with `selectionAnalysisMode === 'whole-page'` (or field absent), the content script calls `extractText()` and uses the existing character map path
- [ ] `settings.highlightColor ?? '#FFFF00'` is the value passed to `applyHighlights()` as `highlightColor`
- [ ] All existing highlight unit tests pass (update mock calls to include the new `highlightColor` argument)
- [ ] New unit tests cover: highlight span has correct `backgroundColor` (user color); highlight span has correct `outline` (risk-level color); selection mode routes to `extractSelection()`; whole-page mode routes to `extractText()`
- [ ] `pnpm typecheck` passes in `ui/extension`

---

## Notes on implementation approach

- `RISK_COLORS` values should be changed from semi-transparent fill (e.g., `rgba(230, 57, 70, 0.25)`) to solid/high-opacity outline colors (e.g., `rgba(230, 57, 70, 0.9)` or `#e63946`). The key change is that the background color is now driven by `HighlightColor`, not by risk level.
- `outline` is preferred over `border` because `outline` does not affect layout (does not push surrounding text). Use `outline-offset: 1px` for a small visual gap between the text and the outline.
- The `selectionAnalysisMode` field must be read from the `SHOW_ANNOTATIONS` message payload. If absent (backward compatibility with pre-ISS-004 messages), default to `'whole-page'`.
- `extractSelection()` rebuilds the character map from the current `window.getSelection()` state. If the selection has been cleared by the time `SHOW_ANNOTATIONS` arrives, `extractSelection()` returns `{ text: '', characterMap: [] }` and `applyHighlights()` will produce no highlights. This is documented and acceptable — the user can scroll the sidebar to review annotations without inline highlights.
- This issue depends on ISS-004 (for `extractSelection()`) and ISS-005 (for `selectionAnalysisMode` in the payload). Both must be complete before this issue begins.
