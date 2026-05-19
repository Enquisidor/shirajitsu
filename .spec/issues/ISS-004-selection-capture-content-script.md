# ISS-004: Extend content script to capture SelectionContext and build ExtractedSelection

**ID:** ISS-004
**Title:** Extend content script to capture SelectionContext and build ExtractedSelection
**Bounded context:** SelectionAnalysis — SelectionCapture sub-context
**Complexity estimate:** M (2–6 hours)
**Security flag:** No
**Performance flag:** No
**Depends on:** none
**API contract references:** None — this is a content-script-only change. No backend or API changes.

---

## Description

The content script (`ui/extension/src/content/index.ts`) currently responds to `GET_CONTEXT` by returning the page-level `DetectedContext` only. It responds to `RUN_ANALYSIS` by extracting the full page text via `extractText()` and submitting it to the background service worker.

This issue extends both handlers to support selection-based analysis:

**1. `GET_CONTEXT` response — add SelectionContext**

When the popup sends `GET_CONTEXT`, the content script must now also check `window.getSelection()` and include a `SelectionContext` (or `null`) in the response alongside the existing `DetectedContext`.

Rules for building the SelectionContext:
- Call `window.getSelection()`. If the result is null, or `selection.isCollapsed` is true, or `selection.toString().trim()` is empty (whitespace-only), return `selection: null`.
- Otherwise, capture `text: selection.toString()` and compute `wordCount` by splitting on `/\s+/` and filtering empty strings.
- Return `selection: { text, wordCount }` alongside the existing `context` field.

The `wordCount` computation is the canonical implementation of the SelectionLengthGuard input. The guard itself (wordCount ≥ 5 check) runs in the popup, not here.

**2. `RUN_ANALYSIS` handler — build SelectionCharacterMap when in selection mode**

The popup will be updated (in ISS-005) to send `RUN_ANALYSIS` with a new field: `{ selectionMode: 'selection' | 'whole-page' }`. This issue must handle both modes:

- When `selectionMode === 'selection'`: call `extractSelection()` (new function in `extractor.ts`) to build the ExtractedSelection from the current `window.getSelection()` range. Use `ExtractedSelection.text` as the analysis text and `ExtractedSelection.characterMap` as the SelectionCharacterMap. Include `selectionAnalysisMode: 'selection'` in the response returned to the popup.
- When `selectionMode === 'whole-page'` (or when the field is absent for backward compatibility): use the existing `extractText()` path. Include `selectionAnalysisMode: 'whole-page'` in the response.

The response from `RUN_ANALYSIS` must now include `selectionAnalysisMode` alongside the existing analysis result so the popup can forward it in the `SHOW_ANNOTATIONS` payload.

**3. New function `extractSelection()` in `extractor.ts`**

Add `extractSelection(): ExtractedSelection` to `ui/extension/src/context/extractor.ts`.

- Get the current `window.getSelection()`.
- If null or collapsed, return `{ text: '', characterMap: [] }`.
- Get `selection.getRangeAt(0)`.
- Use a `TreeWalker` scoped to the range's `commonAncestorContainer` to enumerate text nodes within the range, applying the same noise-filtering logic as `extractFromElement()` (skip nav, footer, aside, script, style parents).
- For each text node, determine the start and end character offsets within the range (for the first and last node in the range, trim to `startOffset`/`endOffset` from the Range object; for middle nodes, include the full text content).
- Build `CharacterMapEntry[]` where `textOffset` is relative to the start of the selected text (offset 0 = first character of selection).
- Return `{ text, characterMap }` as `ExtractedSelection`.

The `ExtractedSelection` interface must be exported from `extractor.ts`:
```typescript
export interface ExtractedSelection {
  text: string
  characterMap: CharacterMapEntry[]
}
```

**Gherkin scenarios satisfied:**
- `selection-popup.feature`: "Popup shows 'Analyze selection' CTA when text is selected" (GET_CONTEXT returns selection)
- `selection-popup.feature`: "Whitespace-only selection is treated as no selection" (GET_CONTEXT returns selection: null for whitespace)
- `selection-popup.feature`: "Empty selection is treated as no selection" (GET_CONTEXT returns selection: null for empty)
- `selection-popup.feature`: "'Analyze selection' submits only the selected text as its content" (RUN_ANALYSIS uses extractSelection text)
- `selection-inline-highlights.feature`: "Highlight positions are resolved relative to the selected text" (extractSelection builds selection-relative offsets)
- `selection-inline-highlights.feature`: "Highlights are applied within the selected region after selection-based analysis" (selection character map used)

---

## Files to modify

- `ui/extension/src/content/index.ts` — extend `GET_CONTEXT` and `RUN_ANALYSIS` handlers
- `ui/extension/src/context/extractor.ts` — add `extractSelection()` function and `ExtractedSelection` interface

---

## Acceptance criteria

- [ ] `GET_CONTEXT` response includes `selection: SelectionContext | null` alongside the existing `context: DetectedContext` field
- [ ] When `window.getSelection()` is null, collapsed, or whitespace-only, `selection` is `null` in the response
- [ ] When a non-empty, non-whitespace selection exists, `selection.text` contains the selected string and `selection.wordCount` is the count of whitespace-separated non-empty tokens in that string
- [ ] `extractSelection()` is exported from `extractor.ts` and returns an `ExtractedSelection` with `text` and `characterMap` fields
- [ ] `ExtractedSelection.characterMap[0].textOffset` is `0` (selection-relative, not page-relative)
- [ ] When `RUN_ANALYSIS` is received with `selectionMode: 'selection'`, the response uses `extractSelection()` text and characterMap
- [ ] When `RUN_ANALYSIS` is received with `selectionMode: 'whole-page'` (or field absent), the existing `extractText()` path is used unchanged
- [ ] The `RUN_ANALYSIS` response includes `selectionAnalysisMode: 'selection' | 'whole-page'`
- [ ] Unit tests in `ui/extension/src/content/index.test.ts` (new or extended) cover: selection present, selection absent, whitespace-only selection, selection with wordCount < 5 (returned but guard not applied here), RUN_ANALYSIS in both modes
- [ ] Unit tests in `ui/extension/src/context/extractor.test.ts` cover `extractSelection()` for: non-empty range, empty/collapsed selection
- [ ] `pnpm typecheck` passes in `ui/extension`

---

## Notes on implementation approach

- The `wordCount` computation (`text.trim().split(/\s+/).filter(Boolean).length`) is the canonical implementation. It must match the predicate used by `selectionMeetsLengthRequirement()` in the popup (ISS-005).
- `window.getSelection()` is only available in content script context (not background). Do not call it from background or popup.
- The noise-filtering logic in `extractFromElement()` (skip nav/footer/aside/script/style) should be extracted into a shared predicate function if it needs to be reused in `extractSelection()`, to avoid duplication.
- The Range API (`getRangeAt(0)`, `startOffset`, `endOffset`, `commonAncestorContainer`) must be used to determine which portion of the first and last text nodes falls within the selection.
