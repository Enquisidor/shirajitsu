# Decision Log

## DEC-001

**Date:** 2026-05-06
**Agent:** Frontend Engineer
**Task:** frontend-types-fix

**Decision:** Updated test mock data in `AnnotationCard.test.tsx` and `client.test.ts` to match the new `@shirajitsu/types` type shapes, treating this as mock data alignment rather than test logic modification.

**Context:** The `@shirajitsu/types` package was updated with new field names for `TensionRating` (`score`/`sourceCount` replacing `numerator`/`denominator`) and new required fields on `AnalyzeResponse` (`failedClaims`, `sessionStats`) and `SourceResult` (`relevanceScore`, `divergenceScore`). Test files contained mock data objects typed against these interfaces that no longer matched the canonical shapes, causing TypeScript compile errors.

**Options considered:**
1. Update the mock data objects in the test files to use the new field names and add required fields — preserves all test assertions and logic, only aligns the data shape to the current type contract.
2. Escalate to Test Engineer to modify the test files — not necessary since the changes are purely to mock data values, not test assertions or test intent.

**Decision made:** Option 1. The changes are confined to mock fixture data; no assertions, test structure, or test intent was modified. The `label` field assertion (`'0 of 4 sources frame this differently'`) remains unchanged since `label` is still present in `TensionRating`.

**PM/Tech Lead review required:** No

---

## DEC-002

**Date:** 2026-05-06
**Agent:** Backend Engineer
**Task:** backend-task3-gateway

**Decision:** Use `fmt.Sprintf("%d", time.Now().UnixNano())` for `analysisId` generation instead of `github.com/google/uuid`

**Context:** The gateway pipeline generates a unique `analysisId` for each analysis run. The task description offered two options: add the `github.com/google/uuid` package, or use `time.Now().UnixNano()` as a string. Adding `uuid` requires `go mod tidy` with network access and introduces an additional package to audit. The nanosecond timestamp approach uses only stdlib, avoids a new dependency, and produces a value unique enough for this use case (one analysis per nanosecond per gateway process).

**Options considered:**
1. Add `github.com/google/uuid` — produces RFC 4122 v4 UUIDs, globally unique, well-understood format, but requires a new dependency and network access at `go mod tidy` time.
2. Use `fmt.Sprintf("%d", time.Now().UnixNano())` — stdlib only, no new dependency, unique within a single process. Not universally unique across processes, but sufficient for a session correlation identifier.

**Decision made:** Option 2 (UnixNano). The task explicitly offered this as an alternative to avoid a new dependency. The `analysisId` is a session correlation identifier returned to the client, not a primary key in a shared store. Uniqueness within a single process is sufficient.

**PM/Tech Lead review required:** No

---

## DEC-003

**Date:** 2026-05-06
**Agent:** Backend Engineer
**Task:** backend-task3-gateway

**Decision:** Default the `context` field to `"reader"` when omitted from the request body, rather than requiring it

**Context:** The existing `domain.AnalyzeRequest.Validate()` rejects a missing `context` field. The task description specifies validating `text` as non-empty (400 if missing) but does not state `context` is required. Requiring context would break clients that do not supply it; defaulting to `"reader"` is safe and backward-compatible. Explicitly invalid values (e.g., `"unknown"`) still return 422.

**Options considered:**
1. Require `context` field — return 422 if missing. Stricter, but breaks clients that omit it and is not required by the task spec.
2. Default `context` to `"reader"` when empty — allows clients to omit it. Explicit invalid values still return 422.

**Decision made:** Option 2 (default to "reader"). The task spec requires text validation only. This maintains backward compatibility with the existing API surface.

**PM/Tech Lead review required:** No

---

## DEC-004

**Date:** 2026-05-06
**Agent:** Backend Engineer
**Task:** backend-task3-gateway

**Decision:** Use actual downstream service API shapes (reading handler code) rather than the abstract shapes described in the task prompt

**Context:** The task prompt described abstract API shapes for the three downstream services. The actual implemented services use materially different field names and structures: claim-extractor uses `claimText/charOffset/charLength/riskLevel/riskReasoning/searchQuery` (not `id/text/position`); source-evaluator response uses `evaluatedClaims` (not `results`); annotator request uses `evaluatedClaims` (not `evaluations`). Using the task prompt's abstract shapes would cause runtime failures.

**Options considered:**
1. Use the abstract shapes from the task prompt — would fail at runtime because actual services use different field names.
2. Read each service's handler code and use the actual shapes — correct at runtime, matches actual service implementations.

**Decision made:** Option 2. The implemented service handlers are the ground truth. This was verified by reading all three service handler files before writing any pipeline code.

**PM/Tech Lead review required:** No

---

## DEC-005

**Date:** 2026-05-06
**Agent:** Backend Engineer
**Task:** backend-task3-gateway

**Decision:** Add `SearchProvider` field to `domain.AnalyzeRequest` to thread search provider selection through the pipeline

**Context:** The pipeline must forward the `searchProvider` field from the gateway request to the source-evaluator. The existing `domain.AnalyzeRequest` struct lacked this field. Adding it is the idiomatic Go approach: keep all request fields in the domain object rather than threading them as separate parameters through the call chain. The existing `Validate()` function and tests are unaffected.

**Options considered:**
1. Pass `searchProvider` as a separate parameter alongside the domain request — more verbose, scatters request fields across the call signature.
2. Add `SearchProvider` to `domain.AnalyzeRequest` — clean, idiomatic; keeps all client-supplied fields together in the domain object.

**Decision made:** Option 2. The domain request struct is the natural home for all fields that arrive from the client and flow through the system.

**PM/Tech Lead review required:** No

---

## DEC-006

**Date:** 2026-05-11
**Agent:** Frontend Engineer
**Task:** extension-error-visibility-fix

**Decision:** Use `chrome.runtime.sendMessage` (broadcast) rather than `chrome.tabs.sendMessage` (content script only) for popup-to-sidebar communication

**Context:** The sidebar (`sidepanel/index.html`) is a separate extension page. It registers listeners via `chrome.runtime.onMessage`. `chrome.tabs.sendMessage` targets only the content script injected into the active tab — it does not reach extension pages such as the sidebar. The existing `SHOW_ANNOTATIONS` handler in Sidebar.tsx was therefore unreachable from the popup's `chrome.tabs.sendMessage` call. All popup-to-sidebar messages must go via `chrome.runtime.sendMessage`.

**Options considered:**
1. Route through the background service worker — popup sends to background, background forwards to sidebar. More complex, adds a relay hop, background would need a registry of open sidebar ports.
2. Broadcast directly from popup via `chrome.runtime.sendMessage` — sidebar and background both receive it; background ignores it (returns false for unrecognized types); sidebar handles it. Simpler, no relay needed.

**Decision made:** Option 2. `chrome.runtime.sendMessage` is the standard MV3 channel for popup-to-sidebar communication and requires no additional infrastructure.

**PM/Tech Lead review required:** No

---

## DEC-007

**Date:** 2026-05-11
**Agent:** Frontend Engineer
**Task:** extension-messaging-bug-fix

**Decision:** Open the sidepanel and send ANALYSIS_STARTED before dispatching RUN_ANALYSIS to the content script

**Context:** The sidepanel (sidebar) is a separate extension page that only receives `chrome.runtime` messages while it is open and actively listening. If the user clicks "Analyze this page" without the sidepanel open, any `SHOW_ERROR` or `SHOW_ANNOTATIONS` broadcast fires into the void — the sidebar never receives it and stays stuck in idle state. The fix is to open the sidepanel and signal it that analysis has begun before the content script pipeline starts, guaranteeing that the sidebar is open and its listener is registered before any result or error message is broadcast.

**Options considered:**
1. Open the sidepanel and broadcast ANALYSIS_STARTED at the END of handleAnalyze (just before broadcasting error/done) — sidepanel may still miss SHOW_ERROR because the sidepanel page may not have finished loading in time.
2. Open the sidepanel and broadcast ANALYSIS_STARTED at the START of handleAnalyze (before RUN_ANALYSIS is sent to content script) — sidepanel has the entire duration of the analysis pipeline to load and register its listener. This is the safe ordering.
3. Store last error/status in the background SW and let the sidebar fetch it on load — more robust but significantly more complex; adds a background relay and a query protocol.

**Decision made:** Option 2. Opening the sidepanel at the start of handleAnalyze gives the sidebar page the full time of the async pipeline to load and register its listener, which is sufficient. Option 3 would be necessary only if the analysis completes in under ~50ms (sidepanel load time), which is not realistic for an LLM pipeline call.

**PM/Tech Lead review required:** No

---

## DEC-008

**Date:** 2026-05-11
**Agent:** Frontend Engineer
**Task:** extension-messaging-bug-fix

**Decision:** Use the callback form of chrome.runtime.sendMessage in the content script rather than the Promise form

**Context:** In MV3 background service worker environments, `chrome.runtime.sendMessage` called from a content script returns a Promise. When the background listener calls `sendResponse` asynchronously (inside a `Promise.then`), Chrome in some versions resolves the content script's Promise with `undefined` rather than the actual response value — silently discarding the auth error returned by `handleAnalyze`. This causes `runAnalysis()` to resolve with `undefined`, `sendResponse(undefined)` is called in the content script, and the popup callback receives `res = undefined`. While the `res === undefined` guard in the popup should catch this, there is also the case where `chrome.runtime.sendMessage` rejects entirely (service worker cold-start) — with no `.catch()` on `runAnalysis().then(sendResponse)`, the rejection is unhandled and `sendResponse` is never called, leaving the popup stuck in `analyzing` forever. The callback form of `chrome.runtime.sendMessage` avoids both problems: it always delivers the response value exactly as passed to `sendResponse`, and it sets `chrome.runtime.lastError` when the channel closes without a reply.

**Options considered:**
1. Keep the Promise form (`return chrome.runtime.sendMessage(...)`) and add a `.catch()` to `runAnalysis()` — handles the rejection case but does not fix the `undefined` resolution case.
2. Use the callback form wrapped in `new Promise()` — handles both cases: response is delivered reliably, and errors are surfaced via `chrome.runtime.lastError` inside the callback and then as a rejection of the outer Promise.

**Decision made:** Option 2. The callback form is more reliable across Chrome MV3 versions for content-script-to-background communication where an async `sendResponse` is involved. The outer `new Promise` wrapper maintains the async function signature expected by `runAnalysis().then(sendResponse)`.

**PM/Tech Lead review required:** No

---

## DEC-009

**Date:** 2026-05-11
**Agent:** Frontend Engineer
**Task:** extension-sidepanel-race-fix

**Decision:** Use chrome.storage.session as a persistent state bridge between the popup and the sidebar to handle the mount-timing race

**Context:** Even with the sidepanel opened before broadcasting ANALYSIS_STARTED (DEC-007), there is a residual race: chrome.sidePanel.open() is fire-and-forget, and the ANALYSIS_STARTED message sent immediately after may arrive before React has mounted and the useEffect listener has been registered. Additionally, the sidebar's useEffect never returned a cleanup function, so the onMessage listener accumulated on every re-render. The solution is to write analysis state to chrome.storage.session before opening the sidepanel — the sidebar then reads this stored state on mount and falls back to it whenever a runtime message was missed during the React initialization gap.

**Options considered:**
1. Add a retry loop in the popup — broadcast ANALYSIS_STARTED repeatedly until the sidebar acknowledges. This is complex, introduces polling, and can result in duplicate state updates if the sidebar eventually receives both the initial and retry messages.
2. Use chrome.storage.session as a write-once state bridge — popup writes state before opening the sidepanel; sidebar reads it on mount. Runtime messages still work for live updates; session storage is the fallback for anything sent during the React initialization gap. This is the standard MV3 pattern for persisting ephemeral cross-page state.

**Decision made:** Option 2 (session storage bridge). This eliminates the race entirely: the sidebar does not need to receive the runtime message — it can always reconstruct current state from session storage on mount. Runtime messages remain active for real-time updates. No retry logic, no duplicate state risk.

**PM/Tech Lead review required:** No

---

## DEC-010

**Date:** 2026-05-11
**Agent:** Frontend Engineer
**Task:** extension-unguarded-tabmessage-fix

**Decision:** Add a `safeTabMessage` helper for fire-and-forget `chrome.tabs.sendMessage` calls and use it for the `SHOW_ANNOTATIONS` content-script send in Popup.tsx

**Context:** After commit 0d22584 introduced `safeBroadcast` and session storage state bridging, the "Could not establish connection. Receiving end does not exist." error persisted. Root cause: the `chrome.tabs.sendMessage` call that forwards `SHOW_ANNOTATIONS` to the content script (for inline highlight mode) at line 96 of Popup.tsx had no callback. When the content script is not injected — e.g. on a chrome:// page, PDF viewer, or a tab that has not loaded the content script — Chrome logs an uncaught runtime error from this call. Unlike `chrome.runtime.sendMessage`, the `chrome.tabs.sendMessage` form does not raise an unhandled promise rejection; it raises a browser-level error that appears as "Could not establish connection. Receiving end does not exist." in the extension's error console and surfaces to the user via the sidebar's error display. A callback reading `chrome.runtime.lastError` suppresses this. The `safeTabMessage` helper is introduced for clarity and to prevent the same mistake on any future `chrome.tabs.sendMessage` fire-and-forget calls.

**Options considered:**
1. Inline the callback at the call site — minimal code change, but the pattern is easy to repeat incorrectly on future calls.
2. Introduce a `safeTabMessage` helper analogous to `safeBroadcast` — makes the intent explicit, documents the pattern, and prevents the same mistake on future tab message calls.

**Decision made:** Option 2. The helper is two lines, costs nothing, and makes the protection pattern discoverable for future contributors.

**PM/Tech Lead review required:** No

---

## DEC-011

**Date:** 2026-05-14
**Agent:** PO Agent
**Task:** phase1-po-gherkin (session: selection-analysis-2026-05-15)

**Decision:** Scope whitespace-only selection as equivalent to "no selection" for the purpose of CTA display

**Context:** The requirements brief specifies that when text is selected, the popup shows "Analyze selection." It does not address the edge case of a selection that contains only whitespace characters (e.g., the user accidentally drags across a blank area). Submitting a whitespace-only string as the analysis target would produce meaningless results and could cause a gateway validation error (empty text). Treating whitespace-only selections as absent is the most conservative and user-friendly interpretation.

**Options considered:**
1. Treat whitespace-only selections as a valid selection — show "Analyze selection" and submit the whitespace string. Could cause a gateway error or empty analysis result.
2. Treat whitespace-only selections the same as no selection — show "Analyze whole page." Safe, consistent with the implicit intent that a selection must have content to be meaningful.

**Decision made:** Option 2. This is recorded here as an implied scope constraint; the PM should confirm. A scenario for this case was not added to the feature files to keep them concise — the Architect should address it in the spec as a validation concern.

**PM/Tech Lead review required:** Yes

---

## DEC-012

**Date:** 2026-05-14
**Agent:** PO Agent
**Task:** phase1-po-gherkin (session: selection-analysis-2026-05-15)

**Decision:** Split feature files into two areas: popup/submission behavior and inline highlight anchoring

**Context:** The requirements brief covers four sub-areas: popup CTA, content script selection capture, analysis request routing, and inline highlight anchoring. The popup CTA, content script, and request routing are all observable from the same user perspective (the popup) and share the same Background setup. Inline highlight anchoring is a distinct observable behavior that requires a different setup (display mode must be inline) and involves different domain concepts (Annotations, charOffset). Splitting into two files keeps each file's Background tight and its scenarios coherent.

**Options considered:**
1. One file covering all four sub-areas — simpler file count but mixes popup/request behavior with rendering behavior, forcing different Background setups or adding conditional Given steps.
2. Two files: `selection-popup.feature` (popup, content script, request routing) and `selection-inline-highlights.feature` (inline highlight anchoring and sidebar display) — each file has a coherent Background and domain scope.

**Decision made:** Option 2. The two-file split produces cleaner, more maintainable scenarios with tighter Background contexts.

**PM/Tech Lead review required:** No

---

## DEC-013

**Date:** 2026-05-14
**Agent:** Architect
**Task:** phase2-architect (session: ext-auth-2026-05-11)

**Decision:** The background service worker initialises its own Clerk instance and calls `getToken()` directly, rather than requesting the token from the popup via chrome.runtime.sendMessage.

**Context:** When a user clicks "Analyse this page," the content script sends an `ANALYZE_TEXT` message to the background service worker, which calls `handleAnalyze` in `handler.ts`. `handler.ts` must attach a valid Clerk JWT to the analysis request before sending it to the gateway. The question is where that JWT comes from in an MV3 extension, where the popup (which has the active Clerk session available via React hooks) and the background service worker are separate JavaScript contexts that cannot share memory.

Two options were evaluated:

**Option A (message relay):** The popup obtains the JWT via `useAuth().getToken()` and sends it to the background via `chrome.runtime.sendMessage` before or alongside the `ANALYZE_TEXT` dispatch. This means the background handler receives the token as part of the message payload.

**Option B (background Clerk instance):** The background service worker initialises its own `@clerk/chrome-extension` Clerk instance using the same `VITE_CLERK_PUBLISHABLE_KEY`. Because `@clerk/chrome-extension` persists session state in Chrome storage APIs (not `window.localStorage`), both the popup and background Clerk instances share the same underlying session data, and the background instance can call `session.getToken()` independently.

**Options considered:**
1. Option A (message relay) — popup sends token to background. Creates a coupling: the popup must be open and have loaded before the background can authenticate. If the popup is closed mid-analysis (user closes it), the background cannot re-fetch a fresh token. Also requires a protocol change to the `ANALYZE_TEXT` message to carry token data, which adds surface area to an already complex message-passing layer.
2. Option B (background Clerk instance) — background initialises its own Clerk instance. The background can fetch a fresh JWT at any point during `handleAnalyze` without depending on the popup being open. `@clerk/chrome-extension` is explicitly designed to support this usage — its session data persists in Chrome storage, not renderer memory.

**Decision made:** Option B. The background Clerk instance is the correct MV3 pattern for this use case. It avoids a runtime dependency on the popup page being open, keeps the message protocol clean, and uses the SDK as designed. If `@clerk/chrome-extension` v1 does not expose a background initialisation API, the implementation agent must escalate to the Architect before falling back to Option A.

**Note on decision ID:** The bounded context file `.spec/bounded-contexts/extension-auth.md` referred to this decision as "DEC-011" at the time of authoring. DEC-011 was subsequently assigned to a different decision from another session. This decision is formally recorded as DEC-013. The bounded context file's open questions note is updated accordingly.

**PM/Tech Lead review required:** No

---

## DEC-014

**Date:** 2026-05-15
**Agent:** PO Agent
**Task:** phase1-po-gherkin-revision (session: selection-analysis-2026-05-15)

**Decision:** Add selection preprocessing scenarios to `selection-popup.feature` rather than creating a new file, and create a new `selection-settings.feature` for highlight color and per-selection model scenarios.

**Context:** The PM's revision instructions identified three new areas: selection preprocessing (too-short / whitespace-only warnings), highlight color selection, and per-selection model settings. The question was whether to add all new scenarios to the existing files or create one or more new files. Selection preprocessing is directly tied to popup CTA behavior — it occurs in the popup, shares the same Background, and is a prerequisite check before the "Analyze selection" submission path. Highlight color and per-selection model are settings concerns that apply at a different level (extension settings and per-submission configuration), do not share the same Background as the popup CTA scenarios, and group naturally together as user-configurable analysis parameters.

**Options considered:**
1. Add all new scenarios to the two existing files — fewer files, but mixed concerns in each file (popup CTA + settings + preprocessing). The Background for highlight color (no selection required) does not match the popup-CTA Background.
2. Add preprocessing to `selection-popup.feature` (same concern, same Background) and create `selection-settings.feature` for highlight color and per-selection model (different concern, applies globally and per-submission). This is the option the PM suggested ("a new `.features/selection-settings.feature` if the color and model scenarios are better grouped separately").

**Decision made:** Option 2. Preprocessing belongs in `selection-popup.feature` because it is part of the popup's input validation flow. Highlight color and model settings belong in a new `selection-settings.feature` because they are user configuration concerns, not popup CTA behavior.

**PM/Tech Lead review required:** No

---

## DEC-015

**Date:** 2026-05-15
**Agent:** PO Agent
**Task:** phase1-po-gherkin-revision (session: selection-analysis-2026-05-15)

**Decision:** Write the "too short to analyze" warning scenarios as two separate Scenario instances (single word; very short phrase) rather than a Scenario Outline, and treat whitespace-only and empty selection as separate scenarios.

**Context:** The PM's revision instructions describe two distinct preprocessing failure cases: (a) text that is too short (single word or very short phrase) and (b) whitespace-only or empty selections. These are different failure modes with different observable triggers. A Scenario Outline would require a concrete threshold to parameterize, but the PM did not specify a character count — only qualitative descriptions ("single word," "very short phrase"). Using plain Scenarios with qualitative Given steps preserves the PM's intent without inventing a specific threshold, which belongs in the Architect's spec. Whitespace-only and empty selections are kept as separate scenarios because their triggers are different (a user drags across blank space vs. an empty selection state), even though their outcomes are the same.

**Options considered:**
1. Use a Scenario Outline with example rows parameterized by text length — requires inventing a concrete character threshold that the PM has not specified. Premature precision.
2. Write separate plain Scenarios with qualitative Given steps — describes the observable behavior without specifying an implementation-level threshold. The threshold decision is deferred to the Architect.

**Decision made:** Option 2. Qualitative steps ("single word," "very short phrase," "only whitespace characters," "empty selection") faithfully represent the PM's stated intent. The Architect will define the precise threshold in the spec.

**PM/Tech Lead review required:** Yes — the PM should confirm what "too short" means in quantitative terms so the Architect can define the threshold. The assumption is that a single word or very short phrase (fewer than approximately 10–15 characters of non-whitespace content) fails the check.

---

## DEC-016

**Date:** 2026-05-14
**Agent:** QA Strategist
**Task:** phase3-qa-strategist (session: ext-auth-2026-05-11)

**Decision:** Do not specify the popup's exact UI during the `isSignedIn === undefined` loading state; assert only that analyse controls are absent

**Context:** When the `@clerk/chrome-extension` SDK is initialising, `useAuth()` returns `{ isSignedIn: undefined }` — the session state has not yet resolved. The ExtensionAuth bounded context and ISS-002 both state that analyse controls must not be rendered when no ClerkSession is active (invariant). However, neither document specifies what the popup should display during the loading gap — a spinner, a blank area, a greyed-out prompt, or something else. Writing a test that asserts a specific loading UI (e.g., "expects a spinner with aria-label 'Loading'") would be inventing a requirement not present in any source document.

**Options considered:**
1. Add a test case asserting a specific loading UI element (e.g., a spinner) — requires inventing a requirement not in the Gherkin or spec. Violates the "do not invent requirements" rule.
2. Add a test case asserting only that analyse controls are absent when `isSignedIn === undefined` — covers the specified invariant, leaves the positive UI assertion unspecified until the PM defines it. Gap is documented in the test plan.

**Decision made:** Option 2. TC-005 asserts only the absence of analyse controls during the loading state. GAP-001 is documented in `.test-plans/extension-auth.md` for PM review. The Test Engineer must not implement a positive loading-state assertion until the PM specifies the loading UI.

**PM/Tech Lead review required:** Yes — PM should decide whether a loading state indicator is required and what it should look like before Phase 4 tests are written for TC-005's positive assertion.

---

## DEC-017

**Date:** 2026-05-15
**Agent:** Frontend Engineer
**Task:** ISS-001 (session: ext-auth-2026-05-11)

**Decision:** Add `"vite/client"` to the `types` array in `ui/extension/tsconfig.json` to provide `import.meta.env` type support for `VITE_CLERK_PUBLISHABLE_KEY`.

**Context:** `main.tsx` was updated as part of ISS-001 to read `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` at startup (the ClerkPublishableKey invariant). TypeScript reported `Property 'env' does not exist on type 'ImportMeta'` because the extension's `tsconfig.json` declared `"types": ["chrome"]`, which provides Chrome API types but not Vite's `ImportMeta.env` augmentation. The web app's `tsconfig.json` uses `"types": ["vite/client"]` for the same purpose. Without this fix, `pnpm typecheck` would report a TypeScript error on `main.tsx`, violating the ISS-001 acceptance criterion that "the extension build completes without TypeScript errors when VITE_CLERK_PUBLISHABLE_KEY is set."

**Options considered:**
1. Add `/// <reference types="vite/client" />` as a triple-slash directive in `main.tsx` — targeted, but scatters type configuration across source files rather than centralising it in the project's tsconfig.
2. Add `"vite/client"` to the `types` array in `ui/extension/tsconfig.json` — consistent with the approach used in `ui/web/tsconfig.json`, centralises type configuration, and applies `import.meta.env` types to all source files in the extension package.

**Decision made:** Option 2. The web app already uses this pattern; applying it to the extension is consistent, does not scatter config across files, and correctly scopes the Vite types to the whole extension source tree.

**PM/Tech Lead review required:** No

---

## DEC-018

**Date:** 2026-05-19
**Agent:** Architect
**Task:** phase2-architect (session: selection-analysis-2026-05-15)

**Decision:** Use a 5-word minimum as the SelectionLengthGuard threshold, computed as `text.trim().split(/\s+/).filter(Boolean).length >= 5`.

**Context:** The PO Gherkin scenarios (DEC-015) describe "too short" selections qualitatively — "single word" and "very short phrase" — without specifying a numeric threshold. The Architect must choose a concrete threshold. A 5-word minimum is long enough to carry meaningful factual content (most facts require a subject, verb, and context) while short enough not to frustrate users who select tight quotes. Single-word selections (1 word) and very short phrases (2–4 words) are rejected, which matches the PM's qualitative intent.

**Options considered:**
1. Character-count threshold (e.g., 30 characters) — simpler but language-dependent; short words can pack into 30 chars, long words can leave meaningful single-word selections under the limit.
2. Word-count threshold (e.g., `wordCount >= 5`) — language-agnostic, matches the PM's qualitative descriptions ("single word" = 1 word fails; "very short phrase" = 2–4 words fails; meaningful selection = 5+ words passes).

**Decision made:** Option 2 — word count. The canonical implementation is `text.trim().split(/\s+/).filter(Boolean).length >= 5`. This predicate is the source of truth for `selectionMeetsLengthRequirement()` in the popup (ISS-005) and for the `wordCount` field populated by the content script (ISS-004).

**PM/Tech Lead review required:** Yes — the PM should confirm that 5 words is the correct threshold. This is the Architect's best interpretation of "single word" (fails) and "very short phrase" (fails) from DEC-015.

---

## DEC-019

**Date:** 2026-05-19
**Agent:** Architect
**Task:** phase2-architect (session: selection-analysis-2026-05-15)

**Decision:** Reactive CTA updates while the popup is open are implemented via a `SELECTION_CHANGED` message broadcast from the content script, with a 150ms debounce on the `selectionchange` DOM event.

**Context:** The popup needs to update its CTA label and SelectionPreview when the user changes their text selection while the popup is open. The popup cannot directly observe the page's `selectionchange` event (it runs in a different context). Two approaches exist: poll `GET_CONTEXT` repeatedly, or have the content script push a `SELECTION_CHANGED` notification on each `selectionchange`.

The `selectionchange` event fires on every cursor movement during a drag selection — potentially dozens of times per second. Broadcasting a chrome.runtime message on every event would flood the popup's message listener and incur unnecessary overhead.

**Options considered:**
1. Poll `GET_CONTEXT` from the popup on a timer (e.g., every 200ms) — adds a polling loop to the popup, queries the content script repeatedly even when nothing has changed. Simple but inefficient.
2. Content script listens for `selectionchange`, debounces at 150ms, then broadcasts `SELECTION_CHANGED` — efficient: message is sent only after the user pauses their selection. Popup updates reactively on receipt. 150ms is imperceptible to the user and sufficient to coalesce drag-select events.

**Decision made:** Option 2 — push-based via debounced `SELECTION_CHANGED`. 150ms debounce is the canonical value. The content script addition is noted in ISS-005 scope: if ISS-004 does not include the `selectionchange` listener, the ISS-005 implementation agent must add it to the content script.

**PM/Tech Lead review required:** No

---

## DEC-020

**Date:** 2026-05-19
**Agent:** Architect
**Task:** phase2-architect (session: selection-analysis-2026-05-15)

**Decision:** The HighlightColor settings UI is placed as a collapsible "Settings" section within the popup, below the display mode toggle. No separate options page is created for the MVP.

**Context:** ISS-007 requires a `<input type="color">` element for the user to configure HighlightColor. This can be placed in the popup or on a dedicated Chrome extension options page. A dedicated options page requires registering `options_ui` in the manifest and building a separate entrypoint. For a single preference, this overhead is disproportionate. The popup already loads settings from `chrome.storage.sync` and is the natural home for extension settings.

**Options considered:**
1. Dedicated options page — full separation of concerns, standard extension settings pattern, but requires a new entrypoint, manifest registration, and a navigation path for a single preference.
2. Collapsible settings section in the popup below the display mode toggle — no new entrypoint or manifest change needed. The color picker is immediately accessible without leaving the popup. Collapse by default to keep the popup uncluttered.

**Decision made:** Option 2 — collapsible settings section in the popup. The implementation agent should use a `<details>/<summary>` collapse pattern or a `useState` toggle. If the popup becomes visually congested after adding the color picker, escalate to the Architect before building a separate options page.

**PM/Tech Lead review required:** No

---

## DEC-021

**Date:** 2026-05-19
**Agent:** Architect
**Task:** phase2-architect (session: selection-analysis-2026-05-15)

**Decision:** Highlight color layering uses `backgroundColor` for the user's HighlightColor and CSS `outline` (not `border`) for the risk-level color indicator.

**Context:** The existing `inline-highlighter.ts` uses `backgroundColor` as the sole visual indicator, mapping `RISK_COLORS` to semi-transparent `rgba` fill values. The new design requires two simultaneous visual signals per highlight span: the user-chosen background color (HighlightColor) and a risk-level indicator. Both signals must be visible simultaneously and remain distinguishable on any HighlightColor, including the default yellow (#FFFF00).

**Options considered:**
1. Use `border` for risk-level color — adds to the layout box model, potentially shifting surrounding text. Requires `box-sizing` adjustments.
2. Use `outline` for risk-level color — does not affect layout. `outline-offset: 1px` provides a small visual gap between text background and outline, with no surrounding text displacement.
3. Use `text-decoration` or another non-layout property — less visually prominent for a risk indicator.

**Decision made:** Option 2 — CSS `outline`. Each highlight span receives:
- `backgroundColor`: the user's HighlightColor (e.g., `'#FFFF00'`)
- `outline`: risk-level-specific color as a solid 2px outline (e.g., `'2px solid rgba(230, 57, 70, 0.9)'` for high risk)
- `outlineOffset`: `'1px'` for visual separation

The existing `RISK_COLORS` map in `inline-highlighter.ts` is repurposed from semi-transparent fill values to high-opacity outline colors.

**PM/Tech Lead review required:** No

---

## DEC-022

**Date:** 2026-05-19
**Agent:** Architect
**Task:** phase2-architect (session: selection-analysis-2026-05-15)

**Decision:** The PerSelectionModelOverride picker shows all `SUPPORTED_MODELS` from `@shirajitsu/types` — no client-side filtering by configured API key. Documented as a known MVP limitation.

**Context:** The PM requirement is "show only models configured in the user's global settings." In the current architecture, `UserSettings` does not carry `UserApiKeys` to the popup — API key presence is a server-side signal held by the gateway. There is no client-side mechanism to determine which providers the user has configured. Building a client-side key-presence signal would require a new API endpoint or storing key metadata in `chrome.storage.sync` — both out of scope for this issue.

**Options considered:**
1. Show all `SUPPORTED_MODELS` — user may select a model for which they have no API key. The gateway returns a `provider_key_missing` error in that case, which is already handled in `handleAnalyze`. Simple, no new infrastructure.
2. Add a new API endpoint to query key availability — correct behavior but introduces backend scope, a new API contract, and latency on popup open. Out of scope.
3. Store key presence (not the keys themselves) in `chrome.storage.sync` after the user saves their keys — correct behavior without a new API endpoint, but requires a separate settings-sync mechanism. Out of scope.

**Decision made:** Option 1 for the MVP. Show all `SUPPORTED_MODELS`. If the user submits with an unconfigured model, the gateway's existing `provider_key_missing` error path handles it gracefully. This limitation is documented in ISS-008 and in the SelectionAnalysis bounded context.

**PM/Tech Lead review required:** No — the PM was consulted and confirmed that "show only configured models" cannot be enforced client-side in the current architecture. The gateway error path is the safety net.

---

## DEC-023

**Date:** 2026-05-19
**Agent:** Frontend Engineer
**Task:** ISS-003

**Decision:** Use the explicit callback form of `chrome.storage.sync.get` wrapped in a `Promise` constructor in `handler.ts`, rather than the native Promise form (`await chrome.storage.sync.get([...])` with no callback).

**Context:** The `handler.test.ts` test mocks `chrome.storage.sync.get` with a callback-based implementation: `(_keys, cb) => cb({gatewayUrl: '...'})`. This mock does not return a Promise — it calls the callback synchronously. If `handler.ts` uses the native Promise form (`await chrome.storage.sync.get(['gatewayUrl'])`), `chrome.storage.sync.get` is called without a callback argument, `cb` inside the mock is `undefined`, and calling `cb({...})` throws a TypeError. The explicit callback form `chrome.storage.sync.get(['gatewayUrl'], (items) => resolve(items))` works correctly with this mock: `cb = (items) => resolve(items)`, so `cb({gatewayUrl: '...'})` resolves the outer Promise as expected.

**Options considered:**
1. Use native Promise form: `const settings = await chrome.storage.sync.get(['gatewayUrl'])` — cleaner code, but incompatible with the test mock which calls the second argument as a callback. Would cause TypeErrors in tests.
2. Use callback form wrapped in `new Promise`: `const settings = await new Promise((resolve) => chrome.storage.sync.get(['gatewayUrl'], (items) => resolve(items)))` — compatible with both the test mock and the real Chrome API (which invokes the callback). Consistent with the existing pattern in `content/index.ts`.

**Decision made:** Option 2. The callback form is already the established pattern in `content/index.ts` (DEC-008). It works correctly in production (Chrome MV3 calls the callback) and in tests (mock calls the callback). No change to the test mock is required.

**PM/Tech Lead review required:** No

---

## DEC-024

**Date:** 2026-05-19
**Agent:** Frontend Engineer
**Task:** ISS-003

**Decision:** Create `.env.test` in `ui/extension/` with a placeholder `VITE_CLERK_PUBLISHABLE_KEY` value to satisfy the `index.test.ts` TC-017-a assertion that `publishableKey` matches `/^pk_/`.

**Context:** `index.test.ts` TC-017-a checks that `__unstable__createClerkClient` is called with `{ publishableKey: expect.stringMatching(/^pk_/) }`. In `handler.ts`, the publishable key is read from `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY`. In Vitest tests, `import.meta.env.VITE_*` values are loaded from `.env.*` files relative to the Vite project root (`ui/extension/`). No `.env.test` existed, so the key resolved to `undefined`, failing the regex assertion. A test placeholder value starting with `pk_test_` satisfies the assertion without exposing any real credentials.

**Options considered:**
1. Use `define` in `vite.config.ts` test section to inject a test value for `VITE_CLERK_PUBLISHABLE_KEY` — couples the env var to the build config, requires `test.define` which overrides all environments.
2. Create `.env.test` with a placeholder value — standard Vite/Vitest pattern for test environment variables; the file is committed as a testing artifact, contains no real credentials, and is loaded only in the `test` environment (`NODE_ENV=test`).

**Decision made:** Option 2. Creating `.env.test` is the standard Vite idiom for per-environment variable values. The placeholder `pk_test_placeholder_for_testing_only` clearly communicates its purpose and does not represent a real Clerk publishable key.

**PM/Tech Lead review required:** No
