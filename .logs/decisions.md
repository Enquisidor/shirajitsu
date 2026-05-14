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
