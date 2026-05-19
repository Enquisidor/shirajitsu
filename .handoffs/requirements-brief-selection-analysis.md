# Requirements Brief: Selection-Based Analysis

**Date:** 2026-05-11
**Requested by:** PM
**Feature:** Text Selection as Primary Analysis Trigger

---

## Background

The current extension has a single CTA — "Analyze this page" / "Analyze this article" — that always submits the full page text. The PM has clarified that this should not be the primary interaction model.

The intended primary flow is: **user highlights text on the page → the extension analyzes that selection**. Whole-page analysis is always optional and secondary, never the default.

---

## What needs to be built

### Popup: selection-aware CTA

- When the popup opens, the content script reports whether the user currently has text selected on the page (alongside the existing `DetectedContext`).
- If a selection exists:
  - CTA reads **"Analyze selection"**
  - A preview of the selected text (first ~80 characters, truncated with ellipsis) is shown below the CTA so the user knows what will be submitted
- If no selection exists:
  - CTA reads **"Analyze whole page"** (secondary treatment — visually de-emphasized relative to the selection CTA)

The mode label ("Reader" / "Writer") remains visible in both cases.

### Content script: capture and report selection

- `GET_CONTEXT` response must include the current text selection (if any): the selected text string and its approximate character offset within the page text.
- If the selection changes while the popup is open, the popup updates reactively (i.e. `GET_CONTEXT` is polled or the content script pushes an update on `selectionchange`).
- If the user clears the selection while the popup is open, the CTA reverts to "Analyze whole page."

### Analysis request: use selection when present

- When the user clicks "Analyze selection": the `text` field in the `POST /v1/analyze` request body is the selected text only (not the full page).
- When the user clicks "Analyze whole page": the `text` field is the full extracted page text, exactly as it works today.
- The `context` field (reader / writer) is still derived from `DetectedContext.mode` in both cases.

### Inline highlights: anchored to selection context

- When display mode is `inline` and the analysis was run on a selection:
  - Highlights are applied within the selected region only, using the `charOffset` values returned by the API (which are relative to the submitted text, not the full page).
  - The character map used for highlight anchoring must be derived from the selected DOM range, not the full page text extraction.
- When display mode is `inline` and the analysis was run on the whole page:
  - Existing behavior is unchanged.

### Out of scope for this feature

- Changes to the sidebar display (it already shows annotations from whatever was submitted)
- Changes to the API or backend services (the same `POST /v1/analyze` endpoint handles both cases — only the `text` payload differs)
- Writer mode detection within a selection (use the existing page-level `context` detection)

---

## Acceptance criteria (summary)

1. When text is selected on the page, the popup CTA reads "Analyze selection" and shows a text preview.
2. Clicking "Analyze selection" submits only the selected text to the gateway.
3. When no text is selected, the popup CTA reads "Analyze whole page."
4. Clicking "Analyze whole page" submits the full page text (existing behavior).
5. If the selection changes while the popup is open, the CTA updates accordingly.
6. Inline highlights for a selection-based analysis are correctly anchored within the selected region.
7. The sidebar display works correctly for both selection and whole-page analyses.

---

## Tech notes for the Architect

- The content script already builds a `characterMap` via `extractText()`. For selection-based analysis, it needs a parallel `extractSelection()` function that returns the selected text and a character map anchored to the selected DOM range.
- `chrome.tabs.sendMessage` with `GET_CONTEXT` is called once on popup open. Selection reactivity may require either (a) periodic polling from the popup, or (b) the content script pushing `SELECTION_CHANGED` messages. The Architect should decide.
- `charOffset` values in the API response are always relative to the submitted `text`. When submitting a selection, `charOffset: 0` refers to the start of the selection, not the start of the page. The highlight anchoring logic must account for this.
- The existing `inline-highlighter.ts` `applyHighlights(annotations, characterMap)` signature is unchanged — the caller just passes the selection-derived character map instead of the full-page one.
