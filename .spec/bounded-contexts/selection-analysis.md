# Bounded Context: SelectionAnalysis

**Purpose:** Responsible for detecting when the user has text selected on a page, adapting the popup's call-to-action and model picker accordingly, validating the selection before submission, routing analysis requests against either selected text or full page text, anchoring inline highlights within the selected DOM range, persisting and applying the user's chosen HighlightColor, and supporting an ephemeral PerSelectionModelOverride that never outlives the popup session.

**Owner:** Architect owns all contexts.

---

### Responsibility Boundary

**This context owns:**
- Capturing a SelectionContext from the active page via the content script's `GET_CONTEXT` response
- Enforcing the SelectionLengthGuard (wordCount ≥ 5) in the popup before submission
- Rendering the SelectionTooShortWarning when the guard fails
- Rendering the SelectionPreview (first 80 characters, ellipsis if truncated) when a SelectionContext is present
- Adapting the popup CTA label to "Analyze selection" (SelectionContext present) or "Analyze whole page" (absent)
- Visual de-emphasis of the whole-page CTA when a SelectionContext is present
- Reactive CTA updates when the selection changes while the popup is open
- Treating whitespace-only and empty selections as absent (no SelectionContext)
- Building the ExtractedSelection (SelectionCharacterMap) for inline highlight anchoring when the analysis runs on a selection
- Passing `selectionAnalysisMode` alongside annotations so the content script uses the correct character map
- Persisting and reading HighlightColor from `chrome.storage.sync` under key `highlightColor`
- Applying HighlightColor as the `backgroundColor` CSS property on every inline highlight span
- Applying the risk-level color as the CSS `outline` property on every inline highlight span (layered over HighlightColor)
- Displaying per-selection model controls in the popup when a SelectionContext is present
- Maintaining PerSelectionModelOverride in React state only (never written to `chrome.storage.sync`)

**This context explicitly does not own:**
- The analysis pipeline (claim extraction, source evaluation, annotation) — belongs to the pipeline bounded contexts
- Gateway authentication — belongs to ExtensionAuth
- The content of inline highlights (tooltip text, state labels) — belongs to AnnotationHighlight
- Sidebar display of annotations — belongs to AnnotationHighlight
- Whole-page character map extraction (already exists in `extractText()`) — SelectionAnalysis only extends it with `extractSelection()`
- Page-level context detection (`DetectedContext.mode`) — belongs to ContextDetection

---

### Core Model

**Aggregate root:**
- `SelectionContext`: the snapshot of the user's current text selection. Absent when no text is selected, when the selection is whitespace-only, or when the selection is empty. When present, carries `text: string`, `wordCount: number`, and the DOM Range needed to build the SelectionCharacterMap.

**Value objects:**
- `SelectionCharacterMap`: a `CharacterMapEntry[]` built from the selected DOM Range. Offset 0 corresponds to the first character of the selected text. Same type as the full-page character map.
- `ExtractedSelection`: the return value of `extractSelection()`. Fields: `{ text: string, characterMap: CharacterMapEntry[] }`.
- `SelectionPreview`: a pure function result — first 80 characters of `SelectionContext.text`, with an appended `…` if the source text exceeds 80 characters. Display-only; full text is always submitted.
- `HighlightColor`: a CSS color string stored in `chrome.storage.sync['highlightColor']`. Default `'#FFFF00'`. Applied as `backgroundColor` on every highlight span.
- `PerSelectionModelOverride`: a React state field `perSelectionModel: AIModel | null`. `null` means use the global `settings.selectedModel`. Never written to `chrome.storage.sync`.
- `SelectionAnalysisMode`: a discriminated string `'selection' | 'whole-page'`. Stored in `chrome.storage.session` alongside annotations and passed in the `SHOW_ANNOTATIONS` message payload.

**Domain events:**
- `SelectionDetected` — emitted by the content script when a `GET_CONTEXT` response includes a non-empty, non-whitespace-only selection.
  - Trigger: popup calls `GET_CONTEXT` and receives a response where `selection` is non-null and `selection.wordCount ≥ 1`.
  - Payload: `{ text: string, wordCount: number }`
- `SelectionCleared` — emitted when the selection transitions from present to absent while the popup is open.
  - Trigger: popup's polling or push mechanism detects that the previously-present SelectionContext is now absent.
  - Payload: `{}`
- `SelectionAnalysisSubmitted` — emitted when the user clicks "Analyze selection" and the SelectionLengthGuard passes.
  - Trigger: `selectionMeetsLengthRequirement(selection)` returns true and user clicks the CTA.
  - Payload: `{ text: string, wordCount: number, model: AIModel }`
- `SelectionTooShortRejected` — emitted when the user clicks "Analyze selection" and the SelectionLengthGuard fails.
  - Trigger: `selectionMeetsLengthRequirement(selection)` returns false.
  - Payload: `{ wordCount: number }`
- `HighlightColorChanged` — emitted when the user updates the HighlightColor in settings.
  - Trigger: user selects a new color in the settings UI and the new value is written to `chrome.storage.sync['highlightColor']`.
  - Payload: `{ highlightColor: string }`

**Invariants:**
- A SelectionContext with `wordCount < 5` MUST NOT be submitted as an analysis request. The SelectionLengthGuard blocks the submission and shows the SelectionTooShortWarning.
- A SelectionContext with `wordCount ≥ 5` MUST NOT show a SelectionTooShortWarning.
- A whitespace-only or empty selection MUST NOT produce a SelectionContext. The popup MUST behave as if no selection is present.
- The SelectionPreview MUST NOT be shown when no SelectionContext is present.
- HighlightColor MUST be applied as `backgroundColor` on every inline highlight span, regardless of SelectionAnalysisMode.
- The risk-level color MUST be applied as CSS `outline` on every inline highlight span, regardless of SelectionAnalysisMode.
- PerSelectionModelOverride MUST NOT be written to `chrome.storage.sync`. It MUST be reset to `null` when the popup closes.
- When `selectionAnalysisMode === 'selection'`, the content script MUST use the SelectionCharacterMap (from `extractSelection()`) when calling `applyHighlights()`.
- When `selectionAnalysisMode === 'whole-page'`, the content script MUST use the full-page character map (from `extractText()`) when calling `applyHighlights()`.

---

### Sub-contexts

#### SelectionCapture (content script)

Owned by `ui/extension/src/content/index.ts`. Responsible for:
- Capturing `window.getSelection()` when a `GET_CONTEXT` message arrives
- Building a `SelectionContext` (or returning `null`) from the current browser selection
- Computing `wordCount` by splitting `selection.text` on whitespace and filtering empty strings
- Building the `ExtractedSelection` (SelectionCharacterMap) via `extractSelection()` in `extractor.ts` when a `RUN_ANALYSIS` message arrives with `selectionAnalysisMode === 'selection'`
- Returning `selectionAnalysisMode` in the `RUN_ANALYSIS` response so the popup can include it in the `SHOW_ANNOTATIONS` payload

#### SelectionAnalysis popup flow

Owned by `ui/extension/src/popup/Popup.tsx` and popup helper module (`ui/extension/src/popup/selectionHelpers.ts`). Responsible for:
- Calling `GET_CONTEXT` on mount and on selection-change events
- Determining which CTA to display based on SelectionContext presence
- Running `selectionMeetsLengthRequirement()` on submit click
- Displaying SelectionTooShortWarning when the guard fails
- Displaying SelectionPreview when SelectionContext is present
- Sending `RUN_ANALYSIS` with `{ selectionMode: 'selection' | 'whole-page' }` as appropriate
- Including `perSelectionModel` (or `settings.selectedModel` if null) in the analysis request
- Displaying the per-selection model picker when SelectionContext is present

#### SelectionHighlight (inline-highlighter extension)

Owned by `ui/extension/src/highlight/inline-highlighter.ts`. Responsible for:
- Accepting a `HighlightColor` parameter in `applyHighlights()` (or reading it from a passed `settings` object)
- Applying `HighlightColor` as `backgroundColor` on every wrapped `<span>`
- Applying the risk-level color as CSS `outline` (e.g., `2px solid <riskColor>`) on every wrapped `<span>`
- Switching between the SelectionCharacterMap and the full-page character map based on the `selectionAnalysisMode` field in the `SHOW_ANNOTATIONS` message

#### SelectionSettings (settings UI)

Owned by `ui/extension/src/popup/Popup.tsx` (inline for PerSelectionModelOverride) and a future `ui/extension/src/settings/` page (for HighlightColor). Responsible for:
- Reading `highlightColor` from `chrome.storage.sync` on mount
- Writing `highlightColor` to `chrome.storage.sync` when the user picks a new color
- Defaulting HighlightColor to `'#FFFF00'` when not set
- Maintaining `perSelectionModel` in React state; never persisting it

---

### Context Map

| Adjacent Context | Relationship Type | Integration Mechanism | Notes |
|---|---|---|---|
| AnnotationHighlight | Shared Kernel | Shared type `CharacterMapEntry[]` and `applyHighlights()` function | SelectionAnalysis extends AnnotationHighlight's `applyHighlights()` with HighlightColor + `outline` risk color, and adds the ability to pass a SelectionCharacterMap instead of the full-page map. The shared kernel is the `CharacterMapEntry` type and the `applyHighlights()` function signature. |
| ContextDetection | Conformist | `DetectedContext` returned by `GET_CONTEXT` — SelectionAnalysis reads `context.mode` but does not modify it | SelectionAnalysis conforms to the output of ContextDetection. The `context` field in the analysis request is always derived from `DetectedContext.mode`, regardless of whether a SelectionContext is present. |
| ExtensionAuth | Open Host Service (Conformist) | ClerkJwt supplied by background; SelectionAnalysis does not touch auth | SelectionAnalysis does not change the auth flow. Analysis requests still require a valid ClerkJwt. |
| Gateway (external service) | Open Host Service (Conformist) | HTTP `POST /v1/analyze` — `text` field set to selected text or full page text | No new endpoints. SelectionAnalysis changes only the `text` field value and the `model` field (PerSelectionModelOverride), not the endpoint contract. |

---

### Ubiquitous Language (context-specific terms)

All terms are defined in `.spec/glossary.md` under the `SelectionAnalysis` section. The authoritative definitions are there; this table is a cross-reference.

| Term | Canonical identifier | Do not use |
|---|---|---|
| SelectionContext | `SelectionContext` | "selected text", "user selection", "highlight selection" |
| SelectionLengthGuard | `selectionMeetsLengthRequirement()` | "character limit", "minimum length", "short selection check" |
| SelectionTooShortWarning | `selectionTooShort` (boolean state) | "error", "alert", "validation error" |
| SelectionPreview | `selectionPreview()` | "preview text", "selection snippet", "truncated selection" |
| SelectionCharacterMap | `CharacterMapEntry[]` produced by `extractSelection()` | "selection map", "offset map", "highlight map" |
| ExtractedSelection | `ExtractedSelection` | "selection result", "extracted text" (for a selection) |
| HighlightColor | `highlightColor` | "user color", "custom color", "highlight background" |
| PerSelectionModelOverride | `perSelectionModel: AIModel | null` | "temporary model", "session model", "one-off model" |
| SelectionAnalysisMode | `selectionAnalysisMode: 'selection' | 'whole-page'` | "analysis type", "mode", "highlight mode" |

---

### Open Questions

1. **Selection reactivity mechanism** (from PO Gate 1 OQ-4): the Gherkin scenarios assert that the popup CTA updates when selection changes while the popup is open. The mechanism — polling vs. content-script push via a `SELECTION_CHANGED` message — is an implementation decision. Recommendation: use a `SELECTION_CHANGED` message pushed from the content script via `chrome.runtime.sendMessage` when `selectionchange` DOM event fires on the page, because this avoids polling overhead and is consistent with the MV3 message-passing pattern. Tech Lead should confirm before ISS-004 begins.

2. **HighlightColor storage scope** (from PO Gate 1 OQ-6): `chrome.storage.sync` is used for all other `UserSettings` fields. Using `sync` for `highlightColor` means it syncs across Chrome profiles on the same Google account. This is the expected behavior for a persistent user preference. Decision DEC-018 formalizes this choice.

3. **Settings page vs. popup inline for HighlightColor UI**: the Gherkin says "the user has set a custom highlight color in the extension settings." This implies a dedicated settings surface, not the popup. A separate settings page (`ui/extension/src/settings/`) is the cleanest approach. ISS-007 covers this.
