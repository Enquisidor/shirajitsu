# ISS-005: Adapt Popup.tsx for selection-aware CTA, SelectionPreview, and SelectionLengthGuard

**ID:** ISS-005
**Title:** Adapt Popup.tsx for selection-aware CTA, SelectionPreview, and SelectionLengthGuard
**Bounded context:** SelectionAnalysis — SelectionAnalysis popup flow sub-context
**Complexity estimate:** L (6+ hours)
**Security flag:** No
**Performance flag:** No
**Depends on:** ISS-004
**API contract references:** None — frontend-only change. No new backend endpoints.

---

## Description

The current `Popup.tsx` renders a single CTA button whose label (`ctaLabel`) is derived from `effectiveMode` (reader vs. writer). It does not know whether the user has text selected on the page.

This issue adapts `Popup.tsx` to:

1. **Read SelectionContext from `GET_CONTEXT` response**
   The existing `GET_CONTEXT` call already populates `context` state. After ISS-004, the response also includes `selection: SelectionContext | null`. The popup must read and store this as React state: `const [selection, setSelection] = useState<SelectionContext | null>(null)`.

2. **Adapt the primary CTA**
   - When `selection !== null` (a SelectionContext is present): render "Analyze selection" as the primary CTA button.
   - When `selection === null`: render "Analyze whole page" as the primary CTA button.
   - When `selection !== null`: render "Analyze whole page" as a visually de-emphasized secondary action (e.g., a text link or ghost button, not a primary button).
   - When `selection === null`: no secondary CTA is needed.
   - The existing "Analyze this article" / "Analyze my draft" labels are replaced entirely by the new labels.

3. **Display SelectionPreview**
   When `selection !== null`, display `selectionPreview(selection.text)` beneath the "Analyze selection" CTA as a `<p>` element. The `selectionPreview` function truncates to 80 characters and appends `…` if the source text exceeds 80 characters.

4. **Enforce SelectionLengthGuard on submit**
   When the user clicks "Analyze selection":
   - Call `selectionMeetsLengthRequirement(selection)` — returns true if `selection.wordCount >= 5`.
   - If false: set `selectionTooShort: true` in state and do NOT submit the analysis request. Show a SelectionTooShortWarning inline (e.g., `<p className="popup__warning">Please select at least 5 words to analyze.</p>`).
   - If true: proceed with the analysis submission (clear `selectionTooShort` state, proceed to `handleAnalyze`).
   - The SelectionTooShortWarning must be cleared when the selection changes to one that passes the guard (or becomes absent).

5. **Send `selectionMode` in `RUN_ANALYSIS`**
   When submitting, send `{ type: 'RUN_ANALYSIS', selectionMode: 'selection' | 'whole-page' }` — the field value derived from whether a SelectionContext is present and the guard passes.

6. **Include `selectionAnalysisMode` in `SHOW_ANNOTATIONS` payload**
   The `RUN_ANALYSIS` response (after ISS-004) includes `selectionAnalysisMode`. The popup must include this in both `safeTabMessage(SHOW_ANNOTATIONS)` and `safeBroadcast(SHOW_ANNOTATIONS)` payloads.

7. **Reactive CTA updates while popup is open**
   When the user selects or deselects text while the popup remains open, the CTA must update reactively. Implementation approach (DEC-019): listen for a `SELECTION_CHANGED` message sent by the content script via `chrome.runtime.sendMessage` when the page's `selectionchange` DOM event fires. On receiving `SELECTION_CHANGED`, update the `selection` state in the popup.

   The content script must be updated to send `SELECTION_CHANGED` — this is a small addition to ISS-004's content script work, but the message listener that reads it lives in the popup and is part of this issue's scope. If ISS-004 does not include the `selectionchange` listener, the implementation agent for ISS-005 must add it to the content script as part of this issue (coordinate with ISS-004 scope — these issues are sequenced, not parallel).

8. **Helper module**
   Extract pure functions into `ui/extension/src/popup/selectionHelpers.ts`:
   - `selectionMeetsLengthRequirement(selection: SelectionContext): boolean` — returns `selection.wordCount >= 5`
   - `selectionPreview(text: string): string` — returns first 80 chars + `…` if `text.length > 80`

**Gherkin scenarios satisfied:**
- `selection-popup.feature`: "Popup shows 'Analyze selection' CTA when text is selected"
- `selection-popup.feature`: "Popup shows 'Analyze whole page' CTA when no text is selected"
- `selection-popup.feature`: "'Analyze whole page' is visually de-emphasized relative to 'Analyze selection'"
- `selection-popup.feature`: "Mode label remains visible when a selection is present"
- `selection-popup.feature`: "Mode label remains visible when no selection is present"
- `selection-popup.feature`: "Selection preview is truncated with ellipsis when text exceeds preview length"
- `selection-popup.feature`: "'Analyze selection' submits only the selected text as its content"
- `selection-popup.feature`: "'Analyze whole page' submits the full page text"
- `selection-popup.feature`: "Context field is derived from page-level detection regardless of selection"
- `selection-popup.feature`: "CTA updates to 'Analyze selection' when user selects text while popup is open"
- `selection-popup.feature`: "CTA reverts to 'Analyze whole page' when user clears selection while popup is open"
- `selection-popup.feature`: "Inline warning shown and submission blocked when selected text is too short" (single word)
- `selection-popup.feature`: "Inline warning shown and submission blocked when selected text is a very short phrase"
- `selection-settings.feature`: "Model selection controls are shown in the popup when text is selected" (model picker visibility — see also ISS-008)

---

## Files to modify

- `ui/extension/src/popup/Popup.tsx` — selection-aware CTA, SelectionPreview, SelectionLengthGuard, reactive updates
- `ui/extension/src/popup/selectionHelpers.ts` — new file: `selectionMeetsLengthRequirement`, `selectionPreview`
- `ui/extension/src/content/index.ts` — add `selectionchange` listener that sends `SELECTION_CHANGED` (if not included in ISS-004)

---

## Acceptance criteria

- [ ] When `GET_CONTEXT` returns `selection !== null`, the popup renders "Analyze selection" as the primary CTA
- [ ] When `GET_CONTEXT` returns `selection === null`, the popup renders "Analyze whole page" as the primary CTA
- [ ] When a SelectionContext is present, "Analyze whole page" is rendered as a visually de-emphasized secondary action (not a primary button)
- [ ] When a SelectionContext is present, `selectionPreview(selection.text)` is rendered in a `<p>` element beneath the "Analyze selection" CTA
- [ ] When no SelectionContext is present, no SelectionPreview is rendered
- [ ] `selectionPreview('a'.repeat(80))` returns `'a'.repeat(80)` (no ellipsis — exactly 80 chars)
- [ ] `selectionPreview('a'.repeat(81))` returns `'a'.repeat(80) + '…'`
- [ ] Clicking "Analyze selection" with `selection.wordCount < 5` renders the SelectionTooShortWarning and does NOT submit the analysis request
- [ ] Clicking "Analyze selection" with `selection.wordCount >= 5` clears any SelectionTooShortWarning and submits the analysis request
- [ ] The SelectionTooShortWarning is cleared when the selection changes to one with wordCount ≥ 5
- [ ] `RUN_ANALYSIS` is sent with `selectionMode: 'selection'` when the primary CTA is "Analyze selection"
- [ ] `RUN_ANALYSIS` is sent with `selectionMode: 'whole-page'` when the primary CTA is "Analyze whole page"
- [ ] `SHOW_ANNOTATIONS` payloads (both `safeTabMessage` and `safeBroadcast`) include `selectionAnalysisMode` from the `RUN_ANALYSIS` response
- [ ] When the content script sends `SELECTION_CHANGED` while the popup is open, the popup updates its CTA and SelectionPreview reactively
- [ ] `selectionMeetsLengthRequirement` and `selectionPreview` are exported from `selectionHelpers.ts` and unit-tested in isolation
- [ ] All existing popup tests continue to pass
- [ ] `pnpm typecheck` passes in `ui/extension`

---

## Notes on implementation approach

- The `SelectionContext` type must be defined or imported. If it is not already in `@shirajitsu/types`, define it locally in `ui/extension/src/content/index.ts` (as an exported interface) and import it in the popup. Do not add extension-specific types to `shared/types` — that package is shared with backend consumers.
- The existing `ctaLabel` derivation (`effectiveMode === 'writer' ? 'Analyze my draft' : 'Analyze this article'`) is replaced entirely by the selection-aware logic. The mode label (Reader/Writer toggle) remains visible in both states.
- The `selectionchange` DOM event in the content script fires frequently during drag-select. Debounce or throttle the `SELECTION_CHANGED` broadcast to avoid flooding the popup's message listener. A 150ms debounce is recommended.
- The `handleAnalyze` function should not be split — the selection mode is determined before calling it, and passed as a parameter or closure variable.
- `selectionTooShort` state should be cleared on every `GET_CONTEXT` response refresh (selection change). Do not accumulate stale warning state.
