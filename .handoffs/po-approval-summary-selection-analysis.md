# PO Agent Approval Summary — Selection-Based Analysis (Revised)

**Phase completed:** Phase 1 — Gherkin authoring (Gate 1 revision)
**Timestamp:** 2026-05-15
**Session:** selection-analysis-2026-05-15

**Revision reason:** PM requested three additional areas: highlight color selection, selection preprocessing, and per-selection model settings.

---

## Feature files produced

| File | Path | Scenarios |
|---|---|---|
| Selection-aware popup CTA and analysis submission | `.features/selection-popup.feature` | 15 |
| Inline highlight anchoring for selection-based analysis | `.features/selection-inline-highlights.feature` | 5 |
| Extension analysis settings — highlight color and per-selection model | `.features/selection-settings.feature` | 8 |
| **Total** | | **28** |

---

## What changed in this revision

| Area | Change |
|---|---|
| Selection preprocessing | Added 4 scenarios to `selection-popup.feature`: too-short single word (warning shown, submit blocked), too-short phrase (warning shown, submit blocked), whitespace-only selection (treated as no selection), empty selection (treated as no selection) |
| Highlight color selection | Added 4 scenarios to new `selection-settings.feature`: chosen color applied to selection-based highlights, chosen color applied to whole-page highlights, color persists across browser sessions, color is layered on risk-level coding |
| Per-selection model settings | Added 4 scenarios to new `selection-settings.feature`: model controls shown in popup when text is selected, per-selection override used for that submission, per-selection override does not affect global default, popup reverts to global default on next open |

---

## Open questions encountered during authoring

| # | Question | Assumption made |
|---|---|---|
| 1 | The brief says the selection preview shows "first ~80 characters" — the tilde (~) is ambiguous. Is 80 a hard character limit or an approximation? | Assumed: approximate. The Gherkin says "approximately 80 characters." The Architect should decide the precise truncation rule and where it is enforced. |
| 2 | The brief does not specify a minimum selection length — only qualitative descriptions ("single word," "very short phrase"). What is the precise character threshold? | Assumed: a single word or phrase of approximately fewer than 10–15 non-whitespace characters fails the check. The Architect must define the exact threshold. PM confirmation required — see DEC-015. |
| 3 | The existing CTA label in the code is "Analyze this page" / "Analyze this article." The brief introduces new labels: "Analyze selection" and "Analyze whole page." | Assumed: the new labels replace the existing ones entirely. The Gherkin uses the new labels as specified. PM should confirm this label replacement is intentional and covers all display surfaces (popup button, any tooltip or accessibility label). |
| 4 | The brief says "If the selection changes while the popup is open, the popup updates reactively" and leaves the reactivity mechanism (polling vs. push via `SELECTION_CHANGED`) to the Architect. | The Gherkin describes the observable outcome only ("popup updates") without prescribing the mechanism. This is intentional — the Architect decides the implementation approach. |
| 5 | The PM stated the highlight color "is separate from / layered on top of the existing risk-level color coding." The precise visual layering mechanism is unspecified. | The scenario asserts both are "visually distinguishable" without prescribing how. The Architect and designer should specify the layering mechanism (e.g., base color vs. border, opacity, blend mode). |
| 6 | The storage mechanism for the persistent highlight color is unspecified (chrome.storage.sync vs. chrome.storage.local). | This is an Architect decision. The Gherkin asserts the behavior (color persists across browser sessions) without referencing the storage API. |
| 7 | The per-selection model control in the popup: should it show only models already configured in the global settings, or all models available in the system? | Assumed: the popup shows the same model options as the global model setting. The Architect should clarify the source of the model list. |

---

## Implied scenarios (not explicitly stated in the brief)

The following scenarios were added based on logical behaviors implied by the stated requirements. The PM should confirm each or request removal.

| Scenario | File | Rationale |
|---|---|---|
| "Analyze whole page is visually de-emphasized relative to Analyze selection" | `selection-popup.feature` | The brief explicitly states "secondary treatment — visually de-emphasized." A scenario asserting this is needed to make the visual hierarchy verifiable. |
| "Mode label remains visible when a selection is present" | `selection-popup.feature` | The brief says "the mode label remains visible in both cases." Two scenarios (selection present / selection absent) make this verifiable in both states. |
| "Mode label remains visible when no selection is present" | `selection-popup.feature` | Same rationale as above. |
| "Context field is derived from page-level detection regardless of selection" | `selection-popup.feature` | The brief states "the context field is still derived from DetectedContext.mode in both cases." This is a submission behavior that must be verifiable. |
| "Selection preview is truncated with ellipsis when text exceeds preview length" | `selection-popup.feature` | The brief specifies "first ~80 characters, truncated with ellipsis." The truncation behavior requires a distinct scenario to be testable. |
| "Sidebar display shows Annotations correctly after selection-based analysis" | `selection-inline-highlights.feature` | AC 7 states "the sidebar display works correctly for both selection and whole-page analyses." Two explicit scenarios make this verifiable for each path. |
| "Sidebar display shows Annotations correctly after whole-page analysis" | `selection-inline-highlights.feature` | Same rationale as above. |
| "Chosen highlight color is applied to highlights from whole-page analysis" | `selection-settings.feature` | The PM stated the chosen color applies to highlights from "any analysis" — this scenario verifies the whole-page path explicitly, not just the selection path. |
| "Per-selection model override does not affect the global default setting" | `selection-settings.feature` | The PM stated the override is "not persisted." Two scenarios are needed to make this verifiable: one for the current submission (override used) and one for the global default (unchanged). |

---

**Awaiting PO/PM approval before proceeding.**
