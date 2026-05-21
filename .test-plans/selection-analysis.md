# Test Plan: selection-analysis

**Feature area:** SelectionAnalysis — selection capture, popup CTA adaptation, inline highlight anchoring, highlight color settings, and per-selection model override

**Session:** selection-analysis-2026-05-15
**Produced by:** QA Strategist
**Date:** 2026-05-19

---

## Source references

| Source | Path |
|---|---|
| Gherkin (popup CTA) | `.features/selection-popup.feature` |
| Gherkin (inline highlights) | `.features/selection-inline-highlights.feature` |
| Gherkin (settings) | `.features/selection-settings.feature` |
| Bounded context | `.spec/bounded-contexts/selection-analysis.md` |
| Issue ISS-004 | `.spec/issues/ISS-004-selection-capture-content-script.md` |
| Issue ISS-005 | `.spec/issues/ISS-005-popup-selection-cta-adaptation.md` |
| Issue ISS-006 | `.spec/issues/ISS-006-inline-highlighter-selection-mode.md` |
| Issue ISS-007 | `.spec/issues/ISS-007-highlight-color-settings-ui.md` |
| Issue ISS-008 | `.spec/issues/ISS-008-per-selection-model-picker.md` |

**API contract note:** SelectionAnalysis introduces no new server endpoints. The relevant contract is `POST /v1/analyze` — the `text` field is set to the selected text (when in selection mode) or full page text (whole-page mode), and the `model` field reflects `perSelectionModel ?? settings.selectedModel`. No new contract clauses are introduced; coverage here is confined to the extension's client-side responsibility.

**Infrastructure notes for the Test Engineer:**
- `window.getSelection()` is only available in content script context (not background or popup). All tests for `extractSelection()` and `GET_CONTEXT` selection capture must mock `window.getSelection()` using `vi.spyOn(window, 'getSelection')` or equivalent.
- `selectionchange` event debounce (DEC-019, 150ms) — tests that exercise reactive CTA updates must use fake timers (`vi.useFakeTimers()` / `vi.advanceTimersByTime(150)`).
- `chrome.storage.sync` must be mocked in all popup tests (via `vi.mock()` or a test helper); `chrome.storage.session` must also be mocked.
- `@clerk/chrome-extension` must be mocked in all popup and background tests (per CLAUDE.md: "Mock Clerk providers in Vitest tests — never call real Clerk APIs in tests").
- `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage` must be mocked; responses controlled by the mock to simulate content script replies.

---

## Test cases

---

### TC-021

**Title:** `GET_CONTEXT` returns `selection: null` when `window.getSelection()` is null
**Gherkin scenario:** "Empty selection is treated as no selection" (`selection-popup.feature`)
**Issue:** ISS-004
**Category:** Happy path — null selection
**Priority:** P0

**Preconditions:**
- Content script (`content/index.ts`) ISS-004 changes are applied
- `window.getSelection()` is mocked to return `null`

**Inputs:**
- Content script receives message `{ type: 'GET_CONTEXT' }`

**Expected output (pass criteria — all must be true):**
1. `sendResponse` is called with an object where `selection` is `null`
2. `sendResponse` is called with an object where `context` is the `DetectedContext` object (existing field, unchanged)
3. `sendResponse` is NOT called with an object where `selection` has a `text` field

**Infrastructure:** Mock `window.getSelection` to return `null`. Test in content script unit test context.

---

### TC-022

**Title:** `GET_CONTEXT` returns `selection: null` when selection is collapsed (empty selection state)
**Gherkin scenario:** "Empty selection is treated as no selection" (`selection-popup.feature`)
**Issue:** ISS-004
**Category:** Boundary condition — collapsed selection
**Priority:** P0

**Preconditions:**
- Content script ISS-004 changes are applied
- `window.getSelection()` is mocked to return an object where `isCollapsed` is `true`

**Inputs:**
- Content script receives message `{ type: 'GET_CONTEXT' }`
- Mock `getSelection()` returns `{ isCollapsed: true, toString: () => '' }`

**Expected output (pass criteria — all must be true):**
1. `sendResponse` is called with `{ context: <DetectedContext>, selection: null }`
2. No `text` or `wordCount` field is present in `selection`

---

### TC-023

**Title:** `GET_CONTEXT` returns `selection: null` when selection text is whitespace-only
**Gherkin scenario:** "Whitespace-only selection is treated as no selection" (`selection-popup.feature`)
**Issue:** ISS-004
**Category:** Boundary condition — whitespace-only
**Priority:** P0

**Preconditions:**
- Content script ISS-004 changes are applied
- `window.getSelection()` returns an object with `isCollapsed: false` and `toString()` returning `'   \t\n   '` (only whitespace)

**Inputs:**
- Content script receives message `{ type: 'GET_CONTEXT' }`
- Mock: `getSelection()` returns `{ isCollapsed: false, toString: () => '   \t\n   ' }`

**Expected output (pass criteria — all must be true):**
1. `sendResponse` is called with `{ context: <DetectedContext>, selection: null }`
2. No `text` or `wordCount` field is present in `selection`

---

### TC-024

**Title:** `GET_CONTEXT` returns a `SelectionContext` with correct `text` and `wordCount` when a valid selection exists
**Gherkin scenario:** "Popup shows 'Analyze selection' CTA when text is selected" (`selection-popup.feature`)
**Issue:** ISS-004
**Category:** Happy path
**Priority:** P0

**Preconditions:**
- Content script ISS-004 changes are applied
- `window.getSelection()` is mocked to return a selection with `isCollapsed: false` and `toString()` returning `'The quick brown fox jumps'`

**Inputs:**
- Content script receives message `{ type: 'GET_CONTEXT' }`
- Mock: `getSelection()` returns `{ isCollapsed: false, toString: () => 'The quick brown fox jumps' }`

**Expected output (pass criteria — all must be true):**
1. `sendResponse` is called with `{ context: <DetectedContext>, selection: { text: 'The quick brown fox jumps', wordCount: 5 } }`
2. `selection.text` is exactly `'The quick brown fox jumps'` (the string from `toString()`)
3. `selection.wordCount` is `5` (five whitespace-delimited non-empty tokens)
4. `selection` is not `null`

---

### TC-025

**Title:** `wordCount` computed by splitting on `/\s+/` and filtering empty strings — multi-space and mixed whitespace
**Gherkin scenario:** "Inline warning shown and submission blocked when selected text is too short" (`selection-popup.feature`) — boundary edge for word counting
**Issue:** ISS-004
**Category:** Boundary condition — wordCount computation
**Priority:** P1

**Preconditions:**
- Content script ISS-004 changes applied
- `window.getSelection()` mocked with `toString()` returning `'  hello   world  '` (leading/trailing/multi spaces)

**Inputs:**
- Content script receives message `{ type: 'GET_CONTEXT' }`
- Mock: `getSelection()` returns `{ isCollapsed: false, toString: () => '  hello   world  ' }`

**Expected output (pass criteria — all must be true):**
1. `selection.wordCount` is `2` (not `4` or `5` — extra whitespace is not counted)
2. `selection.text` is `'  hello   world  '` (raw string, not trimmed — submission uses `ExtractedSelection.text` not this)

---

### TC-026

**Title:** `GET_CONTEXT` returns `selection` with `wordCount` of exactly 4 for a four-word phrase
**Gherkin scenario:** "Inline warning shown and submission blocked when selected text is a very short phrase" (`selection-popup.feature`)
**Issue:** ISS-004
**Category:** Boundary condition — wordCount at threshold - 1
**Priority:** P0

**Preconditions:**
- Content script ISS-004 changes applied
- `window.getSelection()` mocked with `toString()` returning `'just four words here'`

**Inputs:**
- Content script receives message `{ type: 'GET_CONTEXT' }`
- Mock: `getSelection()` returns `{ isCollapsed: false, toString: () => 'just four words here' }`

**Expected output (pass criteria — all must be true):**
1. `selection.wordCount` is `4`
2. `selection` is not `null` — the content script returns the selection; the guard (wordCount < 5) is applied in the popup, not here

**Note for Test Engineer:** This test confirms the content script returns `selection` even when `wordCount < 5`. The SelectionLengthGuard runs in the popup (ISS-005), not in the content script.

---

### TC-027

**Title:** `RUN_ANALYSIS` with `selectionMode: 'selection'` returns `selectionAnalysisMode: 'selection'` and uses `extractSelection()` text
**Gherkin scenario:** "'Analyze selection' submits only the selected text as its content" (`selection-popup.feature`)
**Issue:** ISS-004
**Category:** Happy path — selection analysis mode
**Priority:** P0

**Preconditions:**
- Content script ISS-004 changes applied; `extractSelection()` is implemented in `extractor.ts`
- `window.getSelection()` is mocked with a valid non-collapsed range returning `'Five words minimum here now'`
- `extractSelection()` is mocked/spied to return `{ text: 'Five words minimum here now', characterMap: [<entries>] }`
- `chrome.runtime.sendMessage` (to background) is mocked to return a successful `AnalyzeResponse`

**Inputs:**
- Content script receives message `{ type: 'RUN_ANALYSIS', selectionMode: 'selection' }`

**Expected output (pass criteria — all must be true):**
1. `extractSelection()` is called (spy shows at least one invocation)
2. The text sent to the background is `'Five words minimum here now'` (the selection text, not full-page text)
3. `sendResponse` (back to popup) includes `selectionAnalysisMode: 'selection'`
4. `extractText()` is NOT called during this path (spy shows zero invocations on `extractText`)

---

### TC-028

**Title:** `RUN_ANALYSIS` with `selectionMode: 'whole-page'` uses `extractText()` and returns `selectionAnalysisMode: 'whole-page'`
**Gherkin scenario:** "'Analyze whole page' submits the full page text" (`selection-popup.feature`)
**Issue:** ISS-004
**Category:** Happy path — whole-page mode
**Priority:** P0

**Preconditions:**
- Content script ISS-004 changes applied
- `extractText()` is spied to return `{ text: 'full page content here', characterMap: [], source: 'article' }`
- `chrome.runtime.sendMessage` is mocked for a successful response

**Inputs:**
- Content script receives message `{ type: 'RUN_ANALYSIS', selectionMode: 'whole-page' }`

**Expected output (pass criteria — all must be true):**
1. `extractText()` is called (spy shows at least one invocation)
2. `extractSelection()` is NOT called
3. `sendResponse` includes `selectionAnalysisMode: 'whole-page'`
4. The text forwarded to the background is `'full page content here'`

---

### TC-029

**Title:** `RUN_ANALYSIS` with `selectionMode` field absent (backward compatibility) defaults to `'whole-page'` behavior
**Gherkin scenario:** Derived from ISS-004 acceptance criterion — backward compatibility when `selectionMode` is absent
**Issue:** ISS-004
**Category:** Boundary condition — backward compatibility
**Priority:** P1

**Preconditions:**
- Content script ISS-004 changes applied
- `extractText()` spied

**Inputs:**
- Content script receives message `{ type: 'RUN_ANALYSIS' }` (no `selectionMode` field)

**Expected output (pass criteria — all must be true):**
1. `extractText()` is called (falls back to whole-page path)
2. `extractSelection()` is NOT called
3. `sendResponse` includes `selectionAnalysisMode: 'whole-page'`

---

### TC-030

**Title:** `extractSelection()` returns `{ text: '', characterMap: [] }` when selection is null or collapsed
**Gherkin scenario:** Derived from ISS-004 acceptance criterion — `extractSelection()` for empty/collapsed selection
**Issue:** ISS-004
**Category:** Boundary condition — extractSelection with no selection
**Priority:** P1

**Preconditions:**
- `extractSelection()` is implemented in `extractor.ts`
- `window.getSelection()` is mocked to return `null`

**Inputs:**
- Call `extractSelection()` directly (unit test of the exported function)

**Expected output (pass criteria — all must be true):**
1. Return value is `{ text: '', characterMap: [] }`
2. No exception is thrown

---

### TC-031

**Title:** `extractSelection()` returns `characterMap` where `characterMap[0].textOffset` is `0` (selection-relative, not page-relative)
**Gherkin scenario:** "Highlight positions are resolved relative to the selected text" (`selection-inline-highlights.feature`)
**Issue:** ISS-004
**Category:** Happy path — selection-relative offsets
**Priority:** P0

**Preconditions:**
- `extractSelection()` implemented in `extractor.ts`
- `window.getSelection()` mocked with a non-collapsed range containing at least one text node
- The range starts mid-document (e.g., at character position 500 in the page's full text), but the selection contains `'claim text'`

**Inputs:**
- Call `extractSelection()` directly with the mocked selection active

**Expected output (pass criteria — all must be true):**
1. Return value has `text` equal to `'claim text'` (or whatever the mocked selection text is)
2. `characterMap[0].textOffset` is `0` (not `500` or any page-relative offset)
3. `characterMap` length equals the length of `text` (one entry per character)

---

### TC-032

**Title:** Popup renders "Analyze selection" as the primary CTA when `GET_CONTEXT` returns a `SelectionContext`
**Gherkin scenario:** "Popup shows 'Analyze selection' CTA when text is selected" (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** Happy path — CTA adaptation
**Priority:** P0

**Preconditions:**
- ISS-005 changes applied to `Popup.tsx`
- `useAuth()` mocked with `{ isSignedIn: true }`
- `chrome.tabs.sendMessage` mocked to reply to `GET_CONTEXT` with `{ context: <DetectedContext>, selection: { text: 'Five selected words minimum now', wordCount: 6 } }`
- `chrome.storage.sync.get` mocked to return `DEFAULT_USER_SETTINGS`

**Inputs:**
- Render `<Popup />` (triggers `GET_CONTEXT` on mount)

**Expected output (pass criteria — all must be true):**
1. The rendered output contains a button or element with accessible text "Analyze selection" as the primary CTA
2. The rendered output does NOT contain "Analyze this article" or "Analyze my draft" as the primary CTA (these labels are replaced)
3. The rendered output contains a visually de-emphasized "Analyze whole page" action (secondary — a link, ghost button, or otherwise not the primary button)

---

### TC-033

**Title:** Popup renders "Analyze whole page" as the only CTA when `GET_CONTEXT` returns `selection: null`
**Gherkin scenario:** "Popup shows 'Analyze whole page' CTA when no text is selected" (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** Happy path — no selection
**Priority:** P0

**Preconditions:**
- ISS-005 changes applied
- `GET_CONTEXT` mocked to return `{ context: <DetectedContext>, selection: null }`

**Inputs:**
- Render `<Popup />`

**Expected output (pass criteria — all must be true):**
1. The rendered output contains an element with accessible text "Analyze whole page" as the primary CTA
2. The rendered output does NOT contain "Analyze selection" as a CTA button
3. No secondary CTA link or ghost button for whole-page analysis is present (no secondary action when no selection)

---

### TC-034

**Title:** "Analyze whole page" is visually de-emphasized when a SelectionContext is present
**Gherkin scenario:** "'Analyze whole page' is visually de-emphasized relative to 'Analyze selection'" (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** Happy path — visual hierarchy
**Priority:** P1

**Preconditions:**
- ISS-005 changes applied
- `GET_CONTEXT` mocked to return a valid `SelectionContext` (wordCount: 6)

**Inputs:**
- Render `<Popup />`

**Expected output (pass criteria — all must be true):**
1. The "Analyze selection" element has the CSS class `popup__cta` (or equivalent primary button class)
2. The "Analyze whole page" element does NOT have the CSS class `popup__cta` — it has a secondary class (e.g., `popup__cta--secondary`, `popup__cta--ghost`, or is rendered as an `<a>` or text link)
3. Both elements are present in the rendered output

**Implementation note for Test Engineer:** Assert on distinct class names or element types that confirm the hierarchy. The exact class names are an implementation detail — the test should assert that the two elements have different CSS classes, where only the "Analyze selection" element has the primary button class.

---

### TC-035

**Title:** Mode label is visible alongside "Analyze selection" CTA when a selection is present
**Gherkin scenario:** "Mode label remains visible when a selection is present" (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** Happy path — label visibility
**Priority:** P1

**Preconditions:**
- ISS-005 changes applied
- `GET_CONTEXT` returns a valid `SelectionContext`

**Inputs:**
- Render `<Popup />`

**Expected output (pass criteria — all must be true):**
1. The rendered output contains an element with the text "Mode:" (the mode label, rendered as `<span className="popup__mode-label">Mode:</span>` or equivalent)
2. The mode label is rendered in the same view as the "Analyze selection" CTA

---

### TC-036

**Title:** Mode label is visible alongside "Analyze whole page" CTA when no selection is present
**Gherkin scenario:** "Mode label remains visible when no selection is present" (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** Happy path — label visibility
**Priority:** P1

**Preconditions:**
- ISS-005 changes applied
- `GET_CONTEXT` returns `{ context: <DetectedContext>, selection: null }`

**Inputs:**
- Render `<Popup />`

**Expected output (pass criteria — all must be true):**
1. The rendered output contains an element with the text "Mode:" (the mode label)
2. The mode label is rendered in the same view as the "Analyze whole page" CTA

---

### TC-037

**Title:** `selectionPreview()` returns the full text when text length is exactly 80 characters
**Gherkin scenario:** "Selection preview is truncated with ellipsis when text exceeds preview length" (`selection-popup.feature`) — boundary at exactly 80 chars (no ellipsis)
**Issue:** ISS-005
**Category:** Boundary condition — preview at 80 chars
**Priority:** P0

**Preconditions:**
- `selectionPreview()` function is implemented in `selectionHelpers.ts` and exported

**Inputs:**
- Call `selectionPreview('a'.repeat(80))` directly (unit test)

**Expected output (pass criteria — all must be true):**
1. Return value is `'a'.repeat(80)` exactly (80 lowercase 'a' characters, no ellipsis)
2. Return value does NOT end with `'…'`
3. Return value length is `80`

---

### TC-038

**Title:** `selectionPreview()` returns first 80 characters plus `'…'` when text length is 81 characters
**Gherkin scenario:** "Selection preview is truncated with ellipsis when text exceeds preview length" (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** Boundary condition — preview at 81 chars (truncation point)
**Priority:** P0

**Preconditions:**
- `selectionPreview()` implemented in `selectionHelpers.ts`

**Inputs:**
- Call `selectionPreview('a'.repeat(81))` directly

**Expected output (pass criteria — all must be true):**
1. Return value is `'a'.repeat(80) + '…'` exactly
2. Return value ends with `'…'` (Unicode ellipsis U+2026, not three dots `...`)
3. Return value length is `81` (80 chars + 1 for `'…'`)

---

### TC-039

**Title:** SelectionPreview element is rendered in the popup when a SelectionContext is present
**Gherkin scenario:** "Selection preview is truncated with ellipsis when text exceeds preview length" (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** Happy path — preview display
**Priority:** P0

**Preconditions:**
- ISS-005 changes applied to `Popup.tsx`
- `GET_CONTEXT` mocked to return `{ context: <DetectedContext>, selection: { text: 'This is a selection with more than eighty characters total in it for sure yes', wordCount: 15 } }`
- Note: the text above is 75 chars; for this test use a string of at least 81 chars for the selection text

**Inputs:**
- Render `<Popup />`; `GET_CONTEXT` returns `selection.text` as a string of 90 characters (e.g., `'x'.repeat(90)`)

**Expected output (pass criteria — all must be true):**
1. The rendered output contains a `<p>` element whose text content starts with the first 80 characters of the selection text
2. The `<p>` element's text content ends with `'…'`
3. The full 90-character string is NOT present in the rendered output (truncated)

---

### TC-040

**Title:** SelectionPreview element is NOT rendered when `selection` is `null`
**Gherkin scenario:** "Popup shows 'Analyze whole page' CTA when no text is selected" (no preview when no selection) (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** Happy path — no preview when no selection
**Priority:** P0

**Preconditions:**
- ISS-005 changes applied
- `GET_CONTEXT` returns `{ context: <DetectedContext>, selection: null }`

**Inputs:**
- Render `<Popup />`

**Expected output (pass criteria — all must be true):**
1. No `<p>` element containing a selection preview is present in the rendered output
2. The SelectionPreview component/element is absent

---

### TC-041

**Title:** Clicking "Analyze selection" with `wordCount < 5` shows SelectionTooShortWarning and does NOT submit
**Gherkin scenario:** "Inline warning shown and submission blocked when selected text is too short" (`selection-popup.feature`) — single word case
**Issue:** ISS-005
**Category:** Error condition — SelectionLengthGuard
**Priority:** P0

**Preconditions:**
- ISS-005 changes applied
- `GET_CONTEXT` mocked to return `{ context: <DetectedContext>, selection: { text: 'oneword', wordCount: 1 } }`
- `chrome.tabs.sendMessage` spy present to detect `RUN_ANALYSIS` calls

**Inputs:**
- Render `<Popup />`
- Click the "Analyze selection" CTA

**Expected output (pass criteria — all must be true):**
1. The rendered output contains an element with class `popup__warning` (or equivalent warning class) and text containing "at least 5 words" or equivalent phrasing indicating the minimum
2. `chrome.tabs.sendMessage` is NOT called with `{ type: 'RUN_ANALYSIS' }` (no analysis request submitted)
3. The status does NOT change to `'analyzing'`

---

### TC-042

**Title:** Clicking "Analyze selection" with `wordCount` of 4 (very short phrase) shows SelectionTooShortWarning and does NOT submit
**Gherkin scenario:** "Inline warning shown and submission blocked when selected text is a very short phrase" (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** Error condition — SelectionLengthGuard at threshold - 1
**Priority:** P0

**Preconditions:**
- ISS-005 changes applied
- `GET_CONTEXT` returns `{ context: <DetectedContext>, selection: { text: 'just four words', wordCount: 4 } }`

**Inputs:**
- Render `<Popup />`
- Click the "Analyze selection" CTA

**Expected output (pass criteria — all must be true):**
1. SelectionTooShortWarning element is rendered (element with class `popup__warning` or equivalent, containing warning text)
2. `RUN_ANALYSIS` message is NOT sent (no `chrome.tabs.sendMessage` call with `type: 'RUN_ANALYSIS'`)

---

### TC-043

**Title:** Clicking "Analyze selection" with `wordCount` of exactly 5 submits and clears any prior warning
**Gherkin scenario:** Derived from ISS-005 acceptance criterion — wordCount >= 5 passes the guard
**Issue:** ISS-005
**Category:** Boundary condition — SelectionLengthGuard at threshold
**Priority:** P0

**Preconditions:**
- ISS-005 changes applied
- `GET_CONTEXT` returns `{ context: <DetectedContext>, selection: { text: 'exactly five words now', wordCount: 5 } }`
- Prior state: assume SelectionTooShortWarning was previously shown (simulate by setting `selectionTooShort: true` in state, or by re-rendering with a valid selection after a prior failed attempt)
- `chrome.tabs.sendMessage` mocked to return a successful `RUN_ANALYSIS` response

**Inputs:**
- Render `<Popup />`
- Click the "Analyze selection" CTA

**Expected output (pass criteria — all must be true):**
1. `chrome.tabs.sendMessage` is called with a message containing `type: 'RUN_ANALYSIS'` and `selectionMode: 'selection'`
2. No SelectionTooShortWarning element is present in the rendered output
3. Status transitions to `'analyzing'`

---

### TC-044

**Title:** `selectionMeetsLengthRequirement()` returns `false` for `wordCount: 4` and `true` for `wordCount: 5`
**Gherkin scenario:** Derived from ISS-005 acceptance criterion for `selectionMeetsLengthRequirement()` (unit test of helper function)
**Issue:** ISS-005
**Category:** Boundary condition — helper function unit test
**Priority:** P0

**Preconditions:**
- `selectionMeetsLengthRequirement()` is exported from `selectionHelpers.ts`

**Inputs (two separate assertions):**
1. Call `selectionMeetsLengthRequirement({ text: 'just four words here', wordCount: 4 })`
2. Call `selectionMeetsLengthRequirement({ text: 'exactly five words now okay', wordCount: 5 })`

**Expected output (pass criteria — all must be true):**
1. Call 1 returns `false`
2. Call 2 returns `true`
3. No exception is thrown for either call

---

### TC-045

**Title:** SelectionTooShortWarning is cleared when the selection changes to one with `wordCount >= 5`
**Gherkin scenario:** Derived from ISS-005 acceptance criterion — warning cleared on valid selection change
**Issue:** ISS-005
**Category:** State transition — warning cleared
**Priority:** P1

**Preconditions:**
- ISS-005 changes applied, fake timers active (`vi.useFakeTimers()`)
- Initial state: popup rendered with `selection.wordCount = 1`, warning is visible after clicking "Analyze selection"
- Popup receives `SELECTION_CHANGED` message with new selection `{ text: 'five words or more now', wordCount: 5 }`

**Inputs:**
- Simulate receiving `chrome.runtime.onMessage` with `{ type: 'SELECTION_CHANGED', selection: { text: 'five words or more now', wordCount: 5 } }`
- Advance fake timers by 150ms to pass debounce threshold

**Expected output (pass criteria — all must be true):**
1. SelectionTooShortWarning element is no longer present in the rendered output
2. The CTA updates to "Analyze selection" (or remains "Analyze selection" if already shown)

---

### TC-046

**Title:** `RUN_ANALYSIS` sent with `selectionMode: 'selection'` when "Analyze selection" is clicked
**Gherkin scenario:** "'Analyze selection' submits only the selected text as its content" (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** Happy path — selectionMode in message
**Priority:** P0

**Preconditions:**
- ISS-005 changes applied
- `GET_CONTEXT` returns a valid `SelectionContext` with `wordCount: 6`
- `chrome.tabs.sendMessage` mocked to return a valid `RUN_ANALYSIS` response with `selectionAnalysisMode: 'selection'`

**Inputs:**
- Render `<Popup />`
- Click "Analyze selection"

**Expected output (pass criteria — all must be true):**
1. `chrome.tabs.sendMessage` is called with message `{ type: 'RUN_ANALYSIS', selectionMode: 'selection' }`
2. `SHOW_ANNOTATIONS` is broadcast (via `safeBroadcast`) with `payload.selectionAnalysisMode: 'selection'`
3. `SHOW_ANNOTATIONS` is sent to content script (via `safeTabMessage`) with `payload.selectionAnalysisMode: 'selection'`

---

### TC-047

**Title:** `RUN_ANALYSIS` sent with `selectionMode: 'whole-page'` when "Analyze whole page" is clicked
**Gherkin scenario:** "'Analyze whole page' submits the full page text" (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** Happy path — whole-page submission
**Priority:** P0

**Preconditions:**
- ISS-005 changes applied
- `GET_CONTEXT` returns `{ context: <DetectedContext>, selection: null }`
- `chrome.tabs.sendMessage` mocked to return a valid `RUN_ANALYSIS` response with `selectionAnalysisMode: 'whole-page'`

**Inputs:**
- Render `<Popup />`
- Click "Analyze whole page"

**Expected output (pass criteria — all must be true):**
1. `chrome.tabs.sendMessage` is called with `{ type: 'RUN_ANALYSIS', selectionMode: 'whole-page' }`
2. `SHOW_ANNOTATIONS` broadcast payload includes `selectionAnalysisMode: 'whole-page'`

---

### TC-048

**Title:** `SHOW_ANNOTATIONS` payload `context` field reflects page-level detection, not selection mode
**Gherkin scenario:** "Context field is derived from page-level detection regardless of selection" (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** Happy path — context field independence
**Priority:** P1

**Preconditions:**
- ISS-005 changes applied
- `GET_CONTEXT` returns `{ context: { mode: 'reader', editorType: 'none' }, selection: { text: 'five words are enough here', wordCount: 6 } }`
- `chrome.tabs.sendMessage` mocked to return a successful `RUN_ANALYSIS` response

**Inputs:**
- Render `<Popup />`
- Click "Analyze selection"

**Expected output (pass criteria — all must be true):**
1. The `RUN_ANALYSIS` message sent to the content script includes `context: 'reader'` (derived from `DetectedContext.mode`, not from the selection)
2. The analysis request does NOT substitute `'selection'` or `'whole-page'` for the `context` field — `context` remains `'reader'`

---

### TC-049

**Title:** Popup CTA updates to "Analyze selection" when user selects text while popup is open
**Gherkin scenario:** "CTA updates to 'Analyze selection' when user selects text while popup is open" (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** State transition — reactive CTA update
**Priority:** P0

**Preconditions:**
- ISS-005 changes applied, fake timers active (`vi.useFakeTimers()`)
- Initial state: popup rendered with `GET_CONTEXT` returning `selection: null` (CTA shows "Analyze whole page")
- Content script sends `SELECTION_CHANGED` with a new selection after the debounce interval

**Inputs:**
- Simulate `chrome.runtime.onMessage` firing with `{ type: 'SELECTION_CHANGED', selection: { text: 'newly selected text five words', wordCount: 5 } }`
- Advance fake timers by `150ms` (debounce interval, DEC-019)

**Expected output (pass criteria — all must be true):**
1. The rendered output now contains "Analyze selection" as the primary CTA (the CTA has updated reactively)
2. The rendered output contains a SelectionPreview `<p>` element displaying the first 80 characters of `'newly selected text five words'`
3. The rendered output no longer shows "Analyze whole page" as the primary CTA

---

### TC-050

**Title:** Popup CTA reverts to "Analyze whole page" when user clears selection while popup is open
**Gherkin scenario:** "CTA reverts to 'Analyze whole page' when user clears selection while popup is open" (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** State transition — reactive CTA revert
**Priority:** P0

**Preconditions:**
- ISS-005 changes applied, fake timers active
- Initial state: popup rendered with a valid `SelectionContext` (CTA shows "Analyze selection", preview is displayed)
- Content script sends `SELECTION_CHANGED` with `selection: null`

**Inputs:**
- Simulate `chrome.runtime.onMessage` with `{ type: 'SELECTION_CHANGED', selection: null }`
- Advance fake timers by `150ms`

**Expected output (pass criteria — all must be true):**
1. The rendered output now shows "Analyze whole page" as the primary CTA
2. The SelectionPreview `<p>` element is no longer present in the rendered output
3. "Analyze selection" is no longer the primary CTA

---

### TC-051

**Title:** `SELECTION_CHANGED` message fired by content script only after 150ms debounce — not on every `selectionchange` event
**Gherkin scenario:** "CTA updates to 'Analyze selection' when user selects text while popup is open" (`selection-popup.feature`) — debounce verification
**Issue:** ISS-005 (content script addition)
**Category:** Boundary condition — debounce timing
**Priority:** P1

**Preconditions:**
- Content script `selectionchange` listener with 150ms debounce is implemented
- Fake timers active (`vi.useFakeTimers()`)
- `chrome.runtime.sendMessage` is spied

**Inputs:**
- Simulate `selectionchange` DOM event firing 5 times in rapid succession (5 calls, each 10ms apart)
- Do NOT advance timer past 150ms yet

**Expected output at T=50ms (5 events fired, 50ms elapsed, no debounce fired):**
1. `chrome.runtime.sendMessage` call count is `0` (no `SELECTION_CHANGED` broadcast yet)

**Then advance timer to T=200ms (150ms after last event):**

**Expected output at T=200ms:**
1. `chrome.runtime.sendMessage` call count is `1` (exactly one `SELECTION_CHANGED` broadcast for all 5 events)

---

### TC-052

**Title:** Whitespace-only selection causes popup to show "Analyze whole page" and no preview
**Gherkin scenario:** "Whitespace-only selection is treated as no selection" (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** Boundary condition — whitespace selection display
**Priority:** P0

**Preconditions:**
- ISS-005 changes applied
- `GET_CONTEXT` mocked to return `{ context: <DetectedContext>, selection: null }` (content script returns `null` for whitespace-only; this is verified separately in TC-023)

**Inputs:**
- Render `<Popup />`

**Expected output (pass criteria — all must be true):**
1. "Analyze whole page" is the primary CTA
2. No SelectionPreview `<p>` element is present
3. "Analyze selection" is not present as any CTA

---

### TC-053

**Title:** Empty selection causes popup to show "Analyze whole page" and no preview
**Gherkin scenario:** "Empty selection is treated as no selection" (`selection-popup.feature`)
**Issue:** ISS-005
**Category:** Boundary condition — empty selection display
**Priority:** P0

**Preconditions:**
- ISS-005 changes applied
- `GET_CONTEXT` mocked to return `{ context: <DetectedContext>, selection: null }` (content script returns `null` for empty selection; verified in TC-021/TC-022)

**Inputs:**
- Render `<Popup />`

**Expected output (pass criteria — all must be true):**
1. "Analyze whole page" is the primary CTA
2. No SelectionPreview element is present

---

### TC-054

**Title:** `applyHighlights()` applies inline highlights within the selected DOM range after selection-based analysis
**Gherkin scenario:** "Highlights are applied within the selected region after selection-based analysis" (`selection-inline-highlights.feature`)
**Issue:** ISS-006
**Category:** Happy path — selection-mode highlighting
**Priority:** P0

**Preconditions:**
- ISS-006 changes applied to `inline-highlighter.ts` and `content/index.ts`
- `SHOW_ANNOTATIONS` message payload includes `selectionAnalysisMode: 'selection'`
- `settings.highlightColor` is `'#FFFF00'` (default)
- `window.getSelection()` is mocked to return a non-collapsed range covering a known DOM subtree
- `extractSelection()` spied to return a non-empty `characterMap` for the selected range

**Inputs:**
- Content script receives `SHOW_ANNOTATIONS` with `{ annotations: [<annotation with charOffset:0, charLength:5>], settings: { ...DEFAULT_USER_SETTINGS, highlightColor: '#FFFF00' }, selectionAnalysisMode: 'selection' }`

**Expected output (pass criteria — all must be true):**
1. `extractSelection()` is called (not `extractText()`)
2. `applyHighlights()` is called with the `characterMap` returned by `extractSelection()` (spy on `applyHighlights` arguments)
3. At least one `<span class="shirajitsu-highlight">` element exists in the mocked DOM after the call
4. The span is within the mocked selection's DOM range, not the full document body

---

### TC-055

**Title:** Each highlight span has `backgroundColor` set to `highlightColor` and `outline` set to the risk-level color
**Gherkin scenario:** "Highlight color is layered on top of risk-level color coding" (`selection-settings.feature`)
**Issue:** ISS-006
**Category:** Happy path — layered highlight styling
**Priority:** P0

**Preconditions:**
- ISS-006 changes applied to `inline-highlighter.ts`
- `applyHighlights()` accepts a third `highlightColor: string` parameter
- A minimal DOM is set up with a single text node `'hello world'`
- A `characterMap` covering all 11 characters is provided

**Inputs:**
- Call `applyHighlights([{ claim: { charOffset: 0, charLength: 5, riskLevel: 'high', claimText: 'hello', charOffset: 0, charLength: 5 }, state: 'sourced', tensionRating: null }], characterMap, '#FFFF00')`

**Expected output (pass criteria — all must be true):**
1. The created highlight `<span>` has `style.backgroundColor` equal to `'#FFFF00'` (or the normalized equivalent — check `span.style.backgroundColor`)
2. The created highlight `<span>` has `style.outline` containing the high-risk color value (e.g., contains `'230, 57, 70'` for the red component, or `'rgba(230, 57, 70'`) — the exact value must match the ISS-006 spec: `'2px solid rgba(230, 57, 70, 0.9)'` or equivalent
3. Both `backgroundColor` and `outline` are set simultaneously — neither is absent

---

### TC-056

**Title:** Medium-risk highlight span uses medium-risk outline color; low-risk uses low-risk outline color
**Gherkin scenario:** "Highlight color is layered on top of risk-level color coding" (`selection-settings.feature`) — all three risk levels
**Issue:** ISS-006
**Category:** Happy path — risk-level outline values
**Priority:** P1

**Preconditions:**
- ISS-006 changes applied
- Minimal DOM with three text nodes

**Inputs:**
- Call `applyHighlights()` with three annotations: one `riskLevel: 'medium'`, one `riskLevel: 'low'`, `highlightColor: '#FFFF00'`

**Expected output (pass criteria — all must be true):**
1. The medium-risk span has `outline` containing the medium-risk color (contains `'244, 162, 97'` for orange/amber component matching `rgba(244, 162, 97, 0.9)`)
2. The low-risk span has `outline` containing the low-risk color (contains `'82, 183, 136'` for green component matching `rgba(82, 183, 136, 0.9)`)
3. Both medium and low spans have `backgroundColor: '#FFFF00'`

---

### TC-057

**Title:** `SHOW_ANNOTATIONS` with `selectionAnalysisMode: 'whole-page'` uses `extractText()` — not `extractSelection()`
**Gherkin scenario:** "Existing whole-page highlight anchoring is unchanged after whole-page analysis" (`selection-inline-highlights.feature`)
**Issue:** ISS-006
**Category:** Happy path — whole-page highlight routing
**Priority:** P0

**Preconditions:**
- ISS-006 changes applied
- `extractText()` and `extractSelection()` are spied

**Inputs:**
- Content script receives `SHOW_ANNOTATIONS` with `{ annotations: [...], settings: { ...DEFAULT_USER_SETTINGS, highlightColor: '#FFFF00', displayMode: 'inline' }, selectionAnalysisMode: 'whole-page' }`

**Expected output (pass criteria — all must be true):**
1. `extractText()` is called
2. `extractSelection()` is NOT called
3. `applyHighlights()` is called with the character map returned by `extractText()`

---

### TC-058

**Title:** `SHOW_ANNOTATIONS` with absent `selectionAnalysisMode` defaults to `'whole-page'` behavior (backward compatibility)
**Gherkin scenario:** Derived from ISS-006 acceptance criterion — backward compatibility
**Issue:** ISS-006
**Category:** Boundary condition — backward compatibility
**Priority:** P1

**Preconditions:**
- ISS-006 changes applied
- `extractText()` and `extractSelection()` spied

**Inputs:**
- Content script receives `SHOW_ANNOTATIONS` with `{ annotations: [], settings: { ...DEFAULT_USER_SETTINGS, displayMode: 'inline' } }` (no `selectionAnalysisMode` field)

**Expected output (pass criteria — all must be true):**
1. `extractText()` is called (defaults to whole-page path)
2. `extractSelection()` is NOT called

---

### TC-059

**Title:** `applyHighlights()` uses `settings.highlightColor ?? '#FFFF00'` — reads from settings, not hardcoded
**Gherkin scenario:** "Chosen highlight color is applied to highlights from selection-based analysis" (`selection-settings.feature`)
**Issue:** ISS-006
**Category:** Happy path — highlight color from settings
**Priority:** P0

**Preconditions:**
- ISS-006 changes applied
- `settings.highlightColor` is set to `'#FF6600'` (a non-default orange color)
- Minimal DOM with text node; `characterMap` provided

**Inputs:**
- Content script receives `SHOW_ANNOTATIONS` with `{ annotations: [<annotation>], settings: { ...DEFAULT_USER_SETTINGS, highlightColor: '#FF6600', displayMode: 'inline' }, selectionAnalysisMode: 'whole-page' }`

**Expected output (pass criteria — all must be true):**
1. The created highlight span has `style.backgroundColor` equal to `'#FF6600'` (or its CSS normalized form — `rgb(255, 102, 0)` or `#ff6600`)
2. The highlight color `'#FFFF00'` is NOT used (the custom color overrides the default)

---

### TC-060

**Title:** When `settings.highlightColor` is absent/undefined, `applyHighlights()` falls back to `'#FFFF00'`
**Gherkin scenario:** Derived from ISS-006 acceptance criterion — fallback to default
**Issue:** ISS-006
**Category:** Boundary condition — missing highlightColor fallback
**Priority:** P1

**Preconditions:**
- ISS-006 changes applied
- `settings` object passed to `SHOW_ANNOTATIONS` does NOT include `highlightColor` field (simulates pre-ISS-007 settings)

**Inputs:**
- Content script receives `SHOW_ANNOTATIONS` with `{ annotations: [<annotation>], settings: { displayMode: 'inline', selectedModel: 'claude-3-5-sonnet', ... } }` (no `highlightColor`)

**Expected output (pass criteria — all must be true):**
1. `applyHighlights()` is called with `highlightColor: '#FFFF00'` (the default fallback)
2. The highlight span `style.backgroundColor` is `'#FFFF00'` (or CSS normalized form `rgb(255, 255, 0)`)

---

### TC-061

**Title:** If `extractSelection()` returns empty `characterMap` when selection is cleared, `applyHighlights()` applies no highlights
**Gherkin scenario:** Derived from ISS-006 notes — acceptable behavior when selection cleared before annotations arrive
**Issue:** ISS-006
**Category:** Boundary condition — selection cleared before display
**Priority:** P1

**Preconditions:**
- ISS-006 changes applied
- `window.getSelection()` mocked to return `null` (selection has been cleared since analysis ran)
- `extractSelection()` returns `{ text: '', characterMap: [] }` when selection is null

**Inputs:**
- Content script receives `SHOW_ANNOTATIONS` with `selectionAnalysisMode: 'selection'` and annotations

**Expected output (pass criteria — all must be true):**
1. `extractSelection()` is called
2. `applyHighlights()` is called with an empty `characterMap` (`[]`)
3. No `<span class="shirajitsu-highlight">` elements are created in the DOM
4. No exception is thrown

---

### TC-062

**Title:** Sidebar displays annotations correctly after selection-based analysis
**Gherkin scenario:** "Sidebar display shows Annotations correctly after selection-based analysis" (`selection-inline-highlights.feature`)
**Issue:** ISS-005 (SHOW_ANNOTATIONS broadcast covers sidebar path)
**Category:** Happy path — sidebar display after selection analysis
**Priority:** P1

**Preconditions:**
- ISS-005 changes applied; `SHOW_ANNOTATIONS` broadcast includes `selectionAnalysisMode: 'selection'` in payload
- Sidebar component (`Sidebar.tsx`) receives `SHOW_ANNOTATIONS` via `chrome.runtime.onMessage`
- Annotations: `[{ claim: { claimText: 'Test claim', riskLevel: 'high', charOffset: 0, charLength: 10 }, state: 'sourced', tensionRating: { label: '1 of 3 sources frame this differently', score: 0.33, sourceCount: 3 } }]`

**Inputs:**
- Simulate `chrome.runtime.onMessage` with `{ type: 'SHOW_ANNOTATIONS', payload: { annotations: [...], settings: DEFAULT_USER_SETTINGS, selectionAnalysisMode: 'selection' } }`

**Expected output (pass criteria — all must be true):**
1. The sidebar renders a list item (or card) containing the text "Test claim"
2. The sidebar renders the risk level "HIGH" or "high" (case may vary by implementation)
3. The sidebar renders the tension rating label `'1 of 3 sources frame this differently'`
4. No error state is displayed

---

### TC-063

**Title:** Sidebar displays annotations correctly after whole-page analysis
**Gherkin scenario:** "Sidebar display shows Annotations correctly after whole-page analysis" (`selection-inline-highlights.feature`)
**Issue:** ISS-005
**Category:** Happy path — sidebar display after whole-page analysis
**Priority:** P1

**Preconditions:**
- Same as TC-062 but `selectionAnalysisMode: 'whole-page'`

**Inputs:**
- Simulate `chrome.runtime.onMessage` with `{ type: 'SHOW_ANNOTATIONS', payload: { annotations: [<same annotation as TC-062>], settings: DEFAULT_USER_SETTINGS, selectionAnalysisMode: 'whole-page' } }`

**Expected output (pass criteria — all must be true):**
1. The sidebar renders the annotation claim text "Test claim"
2. The sidebar renders the risk level indicator
3. The sidebar renders the tension rating label
4. No error state is displayed

**Note for Test Engineer:** TC-062 and TC-063 verify that the sidebar is not broken by the new `selectionAnalysisMode` field in the payload — the sidebar's display behavior should be identical regardless of `selectionAnalysisMode` value.

---

### TC-064

**Title:** `UserSettings` interface includes `highlightColor: string` with default `'#FFFF00'`
**Gherkin scenario:** Derived from ISS-007 acceptance criterion — type field present
**Issue:** ISS-007
**Category:** Happy path — type system
**Priority:** P0

**Preconditions:**
- ISS-007 changes applied to `shared/types/src/settings.ts`

**Inputs (static / TypeScript assertion):**
- Import `UserSettings` and `DEFAULT_USER_SETTINGS` from `@shirajitsu/types`
- Assign `const settings: UserSettings = DEFAULT_USER_SETTINGS`

**Expected output (pass criteria — all must be true):**
1. `DEFAULT_USER_SETTINGS.highlightColor` is the string `'#FFFF00'` exactly
2. TypeScript type check passes: `settings.highlightColor` has type `string` — `pnpm typecheck` in `shared/types` exits with code `0`
3. `Object.keys(DEFAULT_USER_SETTINGS)` includes `'highlightColor'` (so the existing `chrome.storage.sync.get(Object.keys(DEFAULT_USER_SETTINGS), ...)` call in `Popup.tsx` will automatically include it)

---

### TC-065

**Title:** Color picker `<input type="color">` is rendered in the popup
**Gherkin scenario:** "Highlight color persists across browser sessions" (`selection-settings.feature`) — precondition verification
**Issue:** ISS-007
**Category:** Happy path — color picker rendering
**Priority:** P0

**Preconditions:**
- ISS-007 changes applied to `Popup.tsx`
- `useAuth()` mocked with `isSignedIn: true`
- `chrome.storage.sync.get` mocked to return `{ ...DEFAULT_USER_SETTINGS, highlightColor: '#FFFF00' }`

**Inputs:**
- Render `<Popup />`

**Expected output (pass criteria — all must be true):**
1. The rendered output contains an `<input type="color">` element
2. The color input's `value` attribute is `'#ffff00'` (browsers normalize hex to lowercase — accept either `'#FFFF00'` or `'#ffff00'`)

---

### TC-066

**Title:** Color picker shows the previously saved `highlightColor` on popup open
**Gherkin scenario:** "Highlight color persists across browser sessions" (`selection-settings.feature`)
**Issue:** ISS-007
**Category:** Happy path — color persistence read
**Priority:** P0

**Preconditions:**
- ISS-007 changes applied
- `chrome.storage.sync.get` mocked to return `{ ...DEFAULT_USER_SETTINGS, highlightColor: '#FF6600' }` (a non-default value previously saved)

**Inputs:**
- Render `<Popup />`

**Expected output (pass criteria — all must be true):**
1. The `<input type="color">` element value is `'#ff6600'` (or `'#FF6600'` — accept either case)
2. The color input does NOT show `'#ffff00'` (the default is overridden by the stored value)

---

### TC-067

**Title:** Selecting a new color writes it to `chrome.storage.sync['highlightColor']` and updates settings state
**Gherkin scenario:** "Chosen highlight color is applied to highlights from selection-based analysis" (`selection-settings.feature`) — write path
**Issue:** ISS-007
**Category:** Happy path — color write to storage
**Priority:** P0

**Preconditions:**
- ISS-007 changes applied
- `chrome.storage.sync.set` is spied
- Initial `highlightColor` is `'#FFFF00'`

**Inputs:**
- Render `<Popup />`
- Simulate `change` event on `<input type="color">` with value `'#3399FF'`

**Expected output (pass criteria — all must be true):**
1. `chrome.storage.sync.set` is called with an object containing `{ highlightColor: '#3399FF' }`
2. The `settings` state in the popup is updated to include `highlightColor: '#3399FF'` (verifiable by checking that the next `SHOW_ANNOTATIONS` payload would include `highlightColor: '#3399FF'`)
3. `saveModel()` (which writes `selectedModel` to storage) is NOT called as a side effect

---

### TC-068

**Title:** `SHOW_ANNOTATIONS` payload includes the current `highlightColor` from settings
**Gherkin scenario:** "Chosen highlight color is applied to highlights from selection-based analysis" and "Chosen highlight color is applied to highlights from whole-page analysis" (`selection-settings.feature`)
**Issue:** ISS-007
**Category:** Happy path — highlightColor forwarded in payload
**Priority:** P0

**Preconditions:**
- ISS-007 changes applied
- `chrome.storage.sync.get` returns `{ ...DEFAULT_USER_SETTINGS, highlightColor: '#3399FF' }`
- `GET_CONTEXT` returns a valid `SelectionContext` with `wordCount: 6`
- `chrome.tabs.sendMessage` mocked to return a `RUN_ANALYSIS` success response

**Inputs:**
- Render `<Popup />`; click "Analyze selection"

**Expected output (pass criteria — all must be true):**
1. The `SHOW_ANNOTATIONS` message sent via `safeTabMessage` has `payload.settings.highlightColor: '#3399FF'`
2. The `SHOW_ANNOTATIONS` message sent via `safeBroadcast` has `payload.settings.highlightColor: '#3399FF'`

---

### TC-069

**Title:** Highlight color persists — on next popup open, color picker shows the previously stored color
**Gherkin scenario:** "Highlight color persists across browser sessions" (`selection-settings.feature`)
**Issue:** ISS-007
**Category:** Happy path — persistence across popup open/close
**Priority:** P0

**Preconditions:**
- ISS-007 changes applied
- `chrome.storage.sync` is mocked with a persistent in-memory store (simulate close/reopen by unmounting and remounting `<Popup />`)
- First open: user selects `'#3399FF'`, which is written to the mock storage
- Second open: popup remounts; `chrome.storage.sync.get` returns the mock storage with `highlightColor: '#3399FF'`

**Inputs:**
- Mount `<Popup />`, simulate color change to `'#3399FF'`, unmount `<Popup />`
- Mount `<Popup />` again (new instance)

**Expected output on second mount (pass criteria — all must be true):**
1. `<input type="color">` value is `'#3399ff'` (the previously stored color, not the default `'#ffff00'`)

---

### TC-070

**Title:** `DEFAULT_USER_SETTINGS` is used as fallback in `chrome.storage.sync.get` — no explicit `'#FFFF00'` hardcoding in Popup.tsx handler
**Gherkin scenario:** Derived from ISS-007 acceptance criterion — no hardcoding
**Issue:** ISS-007
**Category:** Security-relevant / invariant
**Priority:** P1

**Preconditions:**
- ISS-007 changes applied

**Inputs (static analysis / code inspection):**
- Source file: `ui/extension/src/popup/Popup.tsx`

**Expected output (pass criteria — all must be true):**
1. The `chrome.storage.sync.get()` call uses `Object.keys(DEFAULT_USER_SETTINGS)` (or `DEFAULT_USER_SETTINGS` directly) as the key list — the string `'highlightColor'` does NOT appear as a literal string in the `get()` call
2. The string `'#FFFF00'` does NOT appear as a hardcoded literal in the `chrome.storage.sync.get()` callback handler (the default comes from `DEFAULT_USER_SETTINGS`)

**Implementation note for Test Engineer:** This test may be implemented as a static source search confirming the pattern `Object.keys(DEFAULT_USER_SETTINGS)` is present and `'#FFFF00'` is absent from the popup's sync.get callback.

---

### TC-071

**Title:** Per-selection model picker is rendered in the popup when a SelectionContext is present
**Gherkin scenario:** "Model selection controls are shown in the popup when text is selected" (`selection-settings.feature`)
**Issue:** ISS-008
**Category:** Happy path — model picker visibility
**Priority:** P0

**Preconditions:**
- ISS-008 changes applied to `Popup.tsx`
- `GET_CONTEXT` returns `{ context: <DetectedContext>, selection: { text: 'five words minimum here now', wordCount: 5 } }`

**Inputs:**
- Render `<Popup />`

**Expected output (pass criteria — all must be true):**
1. The rendered output contains a model picker labeled distinctly from the global model selector — e.g., an element with text "Model for this selection:" (or equivalent label distinct from the global "Model:")
2. The per-selection model picker is visible (not hidden, not `display: none`)
3. The rendered output also still contains the global model selector labeled "Model:"

---

### TC-072

**Title:** Per-selection model picker is NOT rendered when no SelectionContext is present
**Gherkin scenario:** "Model selection controls are shown in the popup when text is selected" (`selection-settings.feature`) — inverse case
**Issue:** ISS-008
**Category:** Boundary condition — picker hidden when no selection
**Priority:** P0

**Preconditions:**
- ISS-008 changes applied
- `GET_CONTEXT` returns `{ context: <DetectedContext>, selection: null }`

**Inputs:**
- Render `<Popup />`

**Expected output (pass criteria — all must be true):**
1. The per-selection model picker is NOT present in the rendered output (no element with "Model for this selection:" label or equivalent per-selection picker label)
2. The global model selector ("Model:") is still present

---

### TC-073

**Title:** Analysis request uses `perSelectionModel` when user selects a model in the per-selection picker
**Gherkin scenario:** "Per-selection model override is used for that submission" (`selection-settings.feature`)
**Issue:** ISS-008
**Category:** Happy path — perSelectionModel used in request
**Priority:** P0

**Preconditions:**
- ISS-008 changes applied
- `GET_CONTEXT` returns a valid `SelectionContext` with `wordCount: 6`
- Global `settings.selectedModel` is `'claude-3-5-sonnet'`
- User selects `'gpt-4o'` in the per-selection model picker (simulate `onChange` on the per-selection picker with value `'gpt-4o'`)
- `chrome.tabs.sendMessage` for `RUN_ANALYSIS` is mocked to capture the request

**Inputs:**
- Render `<Popup />`
- Simulate per-selection picker change to `'gpt-4o'`
- Click "Analyze selection"

**Expected output (pass criteria — all must be true):**
1. The analysis request (sent to background via `RUN_ANALYSIS`) uses `model: 'gpt-4o'` (the per-selection override)
2. The analysis request does NOT use `model: 'claude-3-5-sonnet'` (the global default)

---

### TC-074

**Title:** `chrome.storage.sync['selectedModel']` is NOT written when user interacts with the per-selection model picker
**Gherkin scenario:** "Per-selection model override does not affect the global default setting" (`selection-settings.feature`)
**Issue:** ISS-008
**Category:** Security-relevant / invariant — storage not written
**Priority:** P0

**Preconditions:**
- ISS-008 changes applied
- `chrome.storage.sync.set` is spied
- Valid `SelectionContext` is present (picker is visible)

**Inputs:**
- Render `<Popup />`
- Simulate per-selection picker `onChange` with value `'gpt-4o'`

**Expected output (pass criteria — all must be true):**
1. `chrome.storage.sync.set` is NOT called with any object containing `selectedModel` at any point during or after the per-selection picker change
2. `chrome.storage.sync.set` may still be called for other settings changes (e.g., `displayMode`, `highlightColor`), but NOT for `selectedModel` from the per-selection picker

---

### TC-075

**Title:** Global `settings.selectedModel` is unchanged after submitting with a per-selection model override
**Gherkin scenario:** "Per-selection model override does not affect the global default setting" (`selection-settings.feature`)
**Issue:** ISS-008
**Category:** Happy path — global default unchanged
**Priority:** P0

**Preconditions:**
- ISS-008 changes applied
- Global `settings.selectedModel` is `'claude-3-5-sonnet'`
- `chrome.storage.sync.get` returns `{ ...DEFAULT_USER_SETTINGS, selectedModel: 'claude-3-5-sonnet' }`
- User selects `'gpt-4o'` in per-selection picker and clicks "Analyze selection"

**Inputs:**
- Render `<Popup />`
- Set per-selection picker to `'gpt-4o'`
- Click "Analyze selection"

**Expected output after submission (pass criteria — all must be true):**
1. `settings.selectedModel` in popup state is still `'claude-3-5-sonnet'` (not `'gpt-4o'`)
2. If a subsequent `SHOW_ANNOTATIONS` payload is sent, `settings.selectedModel` in that payload is `'claude-3-5-sonnet'`
3. `chrome.storage.sync.set` was NOT called with `{ selectedModel: 'gpt-4o' }`

---

### TC-076

**Title:** Analysis uses `settings.selectedModel` (global default) when `perSelectionModel` is null
**Gherkin scenario:** Derived from ISS-008 acceptance criterion — fallback to global default
**Issue:** ISS-008
**Category:** Boundary condition — null perSelectionModel
**Priority:** P0

**Preconditions:**
- ISS-008 changes applied
- Valid `SelectionContext` is present; user has NOT changed the per-selection picker (it shows the global default)
- `perSelectionModel` React state is `null` (initial state)
- `settings.selectedModel` is `'claude-3-5-sonnet'`

**Inputs:**
- Render `<Popup />`
- Click "Analyze selection" without touching the per-selection picker

**Expected output (pass criteria — all must be true):**
1. The analysis request uses `model: 'claude-3-5-sonnet'` (the global default, since `perSelectionModel` is `null`)

---

### TC-077

**Title:** Per-selection picker shows the global default model on next popup open after a per-selection override
**Gherkin scenario:** "Popup reverts to global default model on next open after a per-selection override" (`selection-settings.feature`)
**Issue:** ISS-008
**Category:** State transition — ephemeral override reset
**Priority:** P0

**Preconditions:**
- ISS-008 changes applied
- `chrome.storage.sync` returns `{ ...DEFAULT_USER_SETTINGS, selectedModel: 'claude-3-5-sonnet' }`
- First popup open: user sets per-selection picker to `'gpt-4o'` and submits
- Second popup open: popup unmounts and remounts (simulated by unmount + remount)

**Inputs:**
- First mount: set per-selection picker to `'gpt-4o'`, click "Analyze selection", unmount `<Popup />`
- Second mount: render `<Popup />` fresh (new React state)

**Expected output on second mount (pass criteria — all must be true):**
1. The per-selection model picker shows `'claude-3-5-sonnet'` (the global default) — NOT `'gpt-4o'`
2. `perSelectionModel` React state is `null` (reset because React state is ephemeral — new mount, new state)

---

### TC-078

**Title:** Per-selection picker shows all `SUPPORTED_MODELS` from `@shirajitsu/types`
**Gherkin scenario:** Derived from ISS-008 acceptance criterion and DEC-022 — all models shown
**Issue:** ISS-008
**Category:** Happy path — model list completeness
**Priority:** P1

**Preconditions:**
- ISS-008 changes applied
- `SUPPORTED_MODELS` from `@shirajitsu/types` is known at test time (import and enumerate in the test)
- Valid `SelectionContext` is present (picker is visible)

**Inputs:**
- Render `<Popup />`

**Expected output (pass criteria — all must be true):**
1. The per-selection model picker contains an option for every model in `SUPPORTED_MODELS` from `@shirajitsu/types`
2. No extra models appear that are not in `SUPPORTED_MODELS`

**Note — DEC-022 limitation:** The picker shows ALL `SUPPORTED_MODELS` regardless of whether the user has configured an API key for that provider. If the user selects a model without a configured key, the gateway returns a `provider_key_missing` error. This is documented behavior, not a bug. The test should NOT assert that only configured-key models appear.

---

### TC-079

**Title:** `perSelectionModel` is NEVER written to `chrome.storage.sync` or `chrome.storage.session`
**Gherkin scenario:** Derived from SelectionAnalysis bounded context invariant — PerSelectionModelOverride never persisted
**Issue:** ISS-008
**Category:** Security-relevant / invariant
**Priority:** P0

**Preconditions:**
- ISS-008 changes applied
- `chrome.storage.sync.set` and `chrome.storage.session.set` are both spied
- Valid `SelectionContext` is present

**Inputs:**
- Render `<Popup />`
- Simulate per-selection picker `onChange` with value `'gpt-4o'`
- Click "Analyze selection"
- Unmount `<Popup />`

**Expected output (pass criteria — all must be true):**
1. At no point during any of these actions is `chrome.storage.sync.set` called with an object containing `perSelectionModel` key
2. At no point is `chrome.storage.session.set` called with an object containing `perSelectionModel` key
3. The only storage writes that occur are to `shirajitsu_state`, `shirajitsu_annotations`, `shirajitsu_error` (in session), and the usual settings keys in sync storage — none involving `perSelectionModel`

---

### TC-080

**Title:** Security — `selectionPreview()` does not execute script tags embedded in selection text
**Gherkin scenario:** Derived from security requirement — pathological input for display field
**Issue:** ISS-005
**Category:** Security-relevant input — script tag in selection text
**Priority:** P1

**Preconditions:**
- ISS-005 changes applied
- `selectionPreview()` implemented in `selectionHelpers.ts`

**Inputs:**
- Call `selectionPreview('<script>alert("xss")</script> five words here now yes')`

**Expected output (pass criteria — all must be true):**
1. The return value is a plain string — it does NOT contain executable markup
2. The returned string starts with `'<script>alert("xss")</script>'` truncated to the first 80 characters (the raw string is returned — it is the popup's rendering layer, not `selectionPreview()`, that is responsible for safe display)
3. No exception is thrown

**Note for Test Engineer:** `selectionPreview()` is a pure string function — it should return the truncated string as-is. The security concern is whether the popup renders the preview using `innerHTML` (dangerous) or `textContent`/React JSX text binding (safe). A second assertion should verify that the popup renders the SelectionPreview as text content, not as raw HTML. If the popup uses `<p>{preview}</p>` (JSX), React will escape the string safely. Assert that no `<script>` element exists in the rendered DOM after rendering the popup with this selection.

---

### TC-081

**Title:** Security — oversized selection text (100,000 characters) does not crash `selectionPreview()` or the popup
**Gherkin scenario:** Derived from security requirement — oversized input for string field
**Issue:** ISS-005
**Category:** Security-relevant input — oversized string
**Priority:** P1

**Preconditions:**
- `selectionPreview()` implemented

**Inputs:**
- Call `selectionPreview('x'.repeat(100000))`

**Expected output (pass criteria — all must be true):**
1. The function returns without throwing an exception
2. Return value is `'x'.repeat(80) + '…'` (81 characters total — truncated at 80 + ellipsis)
3. Execution completes in under 100ms (no pathological performance degradation for string slicing)

---

### TC-082

**Title:** Security — `highlightColor` value received from `chrome.storage.sync` is used only as a CSS property value, not injected as HTML
**Gherkin scenario:** Derived from security requirement — pathological input for CSS field
**Issue:** ISS-006 / ISS-007
**Category:** Security-relevant input — CSS injection via highlightColor
**Priority:** P1

**Preconditions:**
- ISS-006 and ISS-007 changes applied
- `settings.highlightColor` is set to `'; color: red; background-image: url(evil.com)'` (CSS injection attempt)

**Inputs:**
- Content script receives `SHOW_ANNOTATIONS` with `{ settings: { ...DEFAULT_USER_SETTINGS, highlightColor: '; color: red; background-image: url(evil.com)', displayMode: 'inline' }, annotations: [<annotation>], selectionAnalysisMode: 'whole-page' }`

**Expected output (pass criteria — all must be true):**
1. The implementation sets `span.style.backgroundColor = highlightColor` (direct property assignment) — this is safe because direct `style.backgroundColor` assignment ignores CSS injection attempts (the browser will reject the invalid value and leave `backgroundColor` unchanged or transparent)
2. The highlight span does NOT have `color: red` or `background-image: url(evil.com)` applied to it
3. The highlight span does NOT use `span.style.cssText = ...` or `span.setAttribute('style', ...)` with the raw color value (which would allow injection)

**Note for Test Engineer:** If the implementation uses `span.style.backgroundColor = highlightColor` (property assignment), this test will pass by virtue of the browser's CSS parser rejecting the invalid value. If the implementation uses `cssText` concatenation or `innerHTML`, this test will catch the vulnerability. Assert that the span's `style.color` is not set and `style.backgroundImage` is not set.

---

## Coverage summary table

Every one of the 28 Gherkin scenarios must appear in this table.

| Gherkin scenario | Feature file | Test case(s) |
|---|---|---|
| Popup shows "Analyze selection" CTA when text is selected | `selection-popup.feature` | TC-024, TC-032 |
| Popup shows "Analyze whole page" CTA when no text is selected | `selection-popup.feature` | TC-033, TC-040 |
| "Analyze whole page" is visually de-emphasized relative to "Analyze selection" | `selection-popup.feature` | TC-034 |
| Mode label remains visible when a selection is present | `selection-popup.feature` | TC-035 |
| Mode label remains visible when no selection is present | `selection-popup.feature` | TC-036 |
| Selection preview is truncated with ellipsis when text exceeds preview length | `selection-popup.feature` | TC-037, TC-038, TC-039 |
| "Analyze selection" submits only the selected text as its content | `selection-popup.feature` | TC-027, TC-046 |
| "Analyze whole page" submits the full page text | `selection-popup.feature` | TC-028, TC-047 |
| Context field is derived from page-level detection regardless of selection | `selection-popup.feature` | TC-048 |
| CTA updates to "Analyze selection" when user selects text while popup is open | `selection-popup.feature` | TC-049, TC-051 |
| CTA reverts to "Analyze whole page" when user clears selection while popup is open | `selection-popup.feature` | TC-050 |
| Inline warning shown and submission blocked when selected text is too short (single word) | `selection-popup.feature` | TC-041 |
| Inline warning shown and submission blocked when selected text is a very short phrase | `selection-popup.feature` | TC-042 |
| Whitespace-only selection is treated as no selection | `selection-popup.feature` | TC-023, TC-052 |
| Empty selection is treated as no selection | `selection-popup.feature` | TC-021, TC-022, TC-053 |
| Highlights are applied within the selected region after selection-based analysis | `selection-inline-highlights.feature` | TC-054 |
| Highlight positions are resolved relative to the selected text | `selection-inline-highlights.feature` | TC-031 |
| Existing whole-page highlight anchoring is unchanged after whole-page analysis | `selection-inline-highlights.feature` | TC-057 |
| Sidebar display shows Annotations correctly after selection-based analysis | `selection-inline-highlights.feature` | TC-062 |
| Sidebar display shows Annotations correctly after whole-page analysis | `selection-inline-highlights.feature` | TC-063 |
| Chosen highlight color is applied to highlights from selection-based analysis | `selection-settings.feature` | TC-059, TC-068 |
| Chosen highlight color is applied to highlights from whole-page analysis | `selection-settings.feature` | TC-059, TC-068 |
| Highlight color persists across browser sessions | `selection-settings.feature` | TC-066, TC-069 |
| Highlight color is layered on top of risk-level color coding | `selection-settings.feature` | TC-055, TC-056 |
| Model selection controls are shown in the popup when text is selected | `selection-settings.feature` | TC-071, TC-072 |
| Per-selection model override is used for that submission | `selection-settings.feature` | TC-073 |
| Per-selection model override does not affect the global default setting | `selection-settings.feature` | TC-074, TC-075 |
| Popup reverts to global default model on next open after a per-selection override | `selection-settings.feature` | TC-077 |

**Total Gherkin scenarios:** 28 of 28 covered
**Total test cases in this plan:** 62 (TC-021 through TC-082)

---

## Non-Gherkin test cases and their derivation basis

| Test case | Derivation |
|---|---|
| TC-022 | ISS-004 acceptance criterion — collapsed selection returns `selection: null` |
| TC-025 | ISS-004 acceptance criterion — `wordCount` computation with multi-space input |
| TC-026 | ISS-004 acceptance criterion — content script returns `selection` even when `wordCount < 5` (guard is popup-side) |
| TC-029 | ISS-004 acceptance criterion — backward compatibility when `selectionMode` absent |
| TC-030 | ISS-004 acceptance criterion — `extractSelection()` with null/collapsed returns empty result |
| TC-043 | ISS-005 acceptance criterion — `wordCount` exactly 5 passes the guard |
| TC-044 | ISS-005 acceptance criterion — `selectionMeetsLengthRequirement()` unit test at boundary values |
| TC-045 | ISS-005 acceptance criterion — SelectionTooShortWarning cleared on valid selection |
| TC-058 | ISS-006 acceptance criterion — backward compatibility with absent `selectionAnalysisMode` |
| TC-060 | ISS-006 acceptance criterion — `highlightColor ?? '#FFFF00'` fallback |
| TC-061 | ISS-006 notes — acceptable behavior when selection cleared before highlights applied |
| TC-064 | ISS-007 acceptance criterion — type field present in `UserSettings` |
| TC-065 | ISS-007 acceptance criterion — color picker rendered in popup |
| TC-067 | ISS-007 acceptance criterion — color write to `chrome.storage.sync` on change |
| TC-070 | ISS-007 acceptance criterion — no hardcoded `'#FFFF00'` in popup handler |
| TC-076 | ISS-008 acceptance criterion — fallback to `settings.selectedModel` when `perSelectionModel` is null |
| TC-078 | ISS-008 acceptance criterion + DEC-022 — all `SUPPORTED_MODELS` shown |
| TC-079 | SelectionAnalysis bounded context invariant — `PerSelectionModelOverride` never written to storage |
| TC-080 | Security requirement — script tag in selection text (display field) |
| TC-081 | Security requirement — oversized string for `selectionPreview()` |
| TC-082 | Security requirement — CSS injection via `highlightColor` field |

---

## Gaps and ambiguities flagged

**GAP-001 — `SELECTION_CHANGED` push mechanism content script scope boundary**
ISS-005 notes that if ISS-004 does not include the `selectionchange` listener in the content script, the ISS-005 implementation agent must add it. TC-051 tests the debounce behavior but assumes the listener is implemented. If neither ISS-004 nor ISS-005 implements it, TC-049, TC-050, and TC-051 will need to be updated to reflect the actual mechanism. The Test Engineer should confirm the listener is present in `content/index.ts` before implementing these test cases.

**GAP-002 — HighlightColor UI placement (DEC-020)**
DEC-020 places the color picker in a collapsible "Settings" section in the popup. TC-065 and TC-066 assert the picker is rendered but do not assert the collapsible section state (open or closed by default). If the section defaults to collapsed, the picker may not be visually visible until the user expands it. The test should assert the element exists in the DOM (even if collapsed via CSS), not that it is visible in the viewport. If the PM requires the section to be open by default, this must be specified before TC-065/TC-066 can assert `display: block` or equivalent.

**GAP-003 — Sidebar rendering scope for TC-062/TC-063**
The sidebar's annotation rendering behavior (`Sidebar.tsx`) is technically owned by the AnnotationHighlight bounded context, not SelectionAnalysis. TC-062 and TC-063 are included here because the `SHOW_ANNOTATIONS` payload change (`selectionAnalysisMode` field added) could break the sidebar if it has strict payload validation. The Test Engineer should confirm whether `Sidebar.tsx` tests are already covered by a separate AnnotationHighlight test plan, and if so, TC-062/TC-063 may be reduced to verifying that the new `selectionAnalysisMode` field in the payload does not cause a sidebar rendering error, rather than verifying full annotation display.

**GAP-004 — DEC-022 limitation: all SUPPORTED_MODELS shown regardless of configured API keys**
TC-078 asserts all `SUPPORTED_MODELS` are shown and documents the limitation. PM confirmation (DEC-022) was obtained — this is known and acceptable. The gateway `provider_key_missing` error path is the safety net. No action required before Test Engineer proceeds.

---

## Self-evaluation checklist

- [x] All 28 Gherkin scenarios (15 from `selection-popup.feature`, 5 from `selection-inline-highlights.feature`, 8 from `selection-settings.feature`) map to at least one test case — confirmed via coverage table (28/28)
- [x] Every API endpoint in scope (`POST /v1/analyze`) — no new endpoints; extension client-side coverage: `model` field (TC-073, TC-076), `text` field (TC-027, TC-028, TC-046, TC-047)
- [x] Boundary conditions present for every field with a defined min/max: `selectionPreview()` at exactly 80 chars (TC-037) and at 81 chars (TC-038); `selectionMeetsLengthRequirement()` at 4 words (TC-044) and at 5 words (TC-044); `wordCount` at threshold-1 (TC-026, TC-042) and at threshold (TC-043); debounce at 150ms (TC-051)
- [x] Security-relevant inputs covered: script tag in selection text display field (TC-080); oversized input for `selectionPreview()` string field (TC-081); CSS injection via `highlightColor` field (TC-082)
- [x] State transitions covered: `selection null → SelectionContext present` (TC-049); `SelectionContext present → null` (TC-050); `SelectionTooShortWarning → cleared` (TC-045); `perSelectionModel null → set → reset on popup close` (TC-077); `highlightColor default → custom → persisted` (TC-067, TC-069)
- [x] Storage invariant covered: `perSelectionModel` never written to `chrome.storage.sync` or `chrome.storage.session` (TC-074, TC-079)
- [x] All acceptance criteria are binary pass/fail assertions — no vague language used
- [x] No performance criteria were applicable to this feature (no performance requirements in ISS-004 through ISS-008)
- [x] Coverage summary table present and complete (28/28 scenarios)
- [x] All TC IDs are unique across the project (TC-021 through TC-082; TC-001 through TC-020 assigned to `extension-auth.md`)
- [x] No executable test code written — test plan and acceptance criteria only
- [x] 4 gaps documented (GAP-001 through GAP-004)
- [x] Infrastructure requirements documented (window.getSelection() mocking, fake timers, chrome.storage mocks)
- [x] `window.getSelection()` testing constraint documented (content script context only)
