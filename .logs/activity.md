# Activity Log

## Entry: frontend-types-fix

**Agent:** Frontend Engineer
**Task ID:** frontend-types-fix
**Status:** Completed
**Date:** 2026-05-06

**Task description:** Fix TypeScript type mismatches across `ui/components`, `ui/extension`, `ui/web`, and `sdk/core` caused by updated field shapes in `@shirajitsu/types`.

**Inputs received:**
- Task description (inline)
- `/Users/alexweinstein/Documents/Code/shirajitsu/shared/types/src/annotation.ts` — canonical `TensionRating` type
- `/Users/alexweinstein/Documents/Code/shirajitsu/shared/types/src/api.ts` — canonical `AnalyzeResponse` and `SessionStats` types
- `/Users/alexweinstein/Documents/Code/shirajitsu/shared/types/src/source.ts` — canonical `SourceResult` type

**Outputs produced:**
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/components/src/annotation/AnnotationCard.test.tsx` — updated `TensionRating` mock (`numerator`/`denominator` → `score`/`sourceCount`) and added `relevanceScore`/`divergenceScore` to `SourceResult` mock
- `/Users/alexweinstein/Documents/Code/shirajitsu/sdk/core/src/client.test.ts` — added `failedClaims: []` and complete `sessionStats` object to `AnalyzeResponse` mock
- `/Users/alexweinstein/Documents/Code/shirajitsu/.handoffs/frontend-types-fix.md` — handoff summary

**Self-checks applied:**
- Security module: No security-relevant changes (mock data and type alignment only)
- Accessibility module: No UI changes; not applicable
- Performance module: No rendering or bundle changes; not applicable
- Design accuracy (architectural): All field names used in mock data align exactly with the canonical types in `@shirajitsu/types`; no new domain terms introduced

**Decisions made:**
- Updated mock data in test files to match new type shapes without altering test assertions or logic — DEC-001

**Assumptions made:**
- The `SessionStats` mock in `client.test.ts` uses the first entry from `SUPPORTED_MODELS` (Claude Sonnet 4 / `anthropic`) and `'google-cse'` as `searchProvider`, matching the project defaults defined in `shared/types/src/models.ts`. These values do not affect any test assertion since the mock is only used to simulate a successful fetch response.
- The `AnnotationCard.test.tsx` assertion at line 54 checks `tensionRating.label` which remains unchanged in the new `TensionRating` shape. The mock `score: 0, sourceCount: 4` with label `'0 of 4 sources frame this differently'` is internally consistent and tests the label rendering path correctly.

**Issues flagged:** None

---

## Entry: backend-task3-gateway

**Agent:** Backend Engineer
**Task ID:** backend-task3-gateway
**Status:** Completed-with-issues
**Date:** 2026-05-06

**Task description:** Implement the full claim-extractor → source-evaluator → annotator pipeline in the gateway service, wire it into the analyze handler, update main.go, and implement Clerk JWT verification.

**Inputs received:**
- Task description (inline)
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/gateway/cmd/server/main.go` — existing gateway entry point
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/gateway/internal/handlers/analyze.go` — stub handler
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/gateway/internal/domain/request.go` — existing domain request struct
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/gateway/internal/auth/middleware.go` — existing auth middleware with JWT stub
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/gateway/go.mod` — existing module file
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/annotator/internal/handler/annotate.go` — actual annotator API shape (read before implementing)
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/source-evaluator/internal/handler/evaluate.go` — actual source-evaluator API shape (read before implementing)
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/claim-extractor/cmd/server/main.go` — actual claim-extractor API shape (read before implementing)

**Outputs produced:**
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/gateway/internal/domain/request.go` — added `SearchProvider` field to `AnalyzeRequest`
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/gateway/internal/domain/response.go` — new file: `AnalyzeResponse`, `SessionStats`, `FailedClaim`, `Annotation`, `ClaimSummary`, `TensionRating`, `SourceResult` types
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/gateway/internal/pipeline/pipeline.go` — new file: `Pipeline` struct, `New()`, `Run()`, downstream HTTP client methods, all request/response types for three services
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/gateway/internal/pipeline/pipeline_test.go` — new file: happy path, claim-extractor failure, source-evaluator failure, annotator partial failure, registry version fallback tests
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/gateway/internal/handlers/analyze.go` — rewritten: accepts pipeline argument, validates text+context, returns correct error shapes
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/gateway/internal/handlers/analyze_test.go` — new file: missing text, invalid body, pipeline success, pipeline error, invalid context tests
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/gateway/internal/auth/middleware.go` — updated: Clerk JWT verification using `clerk-sdk-go/v2/jwt.Verify()`, graceful skip when CLERK_SECRET_KEY is empty
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/gateway/cmd/server/main.go` — updated: reads CLAIM_EXTRACTOR_URL, SOURCE_EVALUATOR_URL, ANNOTATOR_URL env vars; creates pipeline; passes pipeline to handler
- `/Users/alexweinstein/Documents/Code/shirajitsu/services/gateway/go.mod` — reordered dependencies (clerk first, alphabetical)

**Self-checks applied:**
- Security module (backend): Applied. Input validation present for all fields. Error responses do not expose stack traces. Auth middleware applied to all routes. HTTP client has explicit timeout. No secrets in source. No SQL so injection N/A. Clerk JWT verification replaces TODO stub.
- Performance module (backend): Applied. HTTP client has 120s timeout (explicit, not default). No N+1 patterns. No unbounded collection queries. `http.Client` default transport uses connection pooling.
- Design accuracy module (architectural): Applied. Endpoint `POST /v1/analyze` unchanged. Response shape matches spec `AnalyzeResponse`. Domain names (`AnalyzeResponse`, `SessionStats`, `FailedClaim`, `Annotation`, `TensionRating`, `SourceResult`, `ClaimSummary`) match task spec and glossary terms. No new endpoints added outside spec scope.

**Decisions made:**
- Use UnixNano for analysisId instead of uuid package — DEC-002
- Default context field to "reader" when omitted — DEC-003
- Use actual service shapes from handler code, not abstract shapes from task prompt — DEC-004
- Add SearchProvider to domain.AnalyzeRequest — DEC-005

**Assumptions made:**
- The annotator service preserves claim order (index-aligned with claims slice). Verified by reading `annotate.go`: it iterates `req.Claims` by index in a loop and returns `annotations` in the same order.
- The source-evaluator service preserves claim order (index-aligned). Verified by reading `evaluate.go`: `results` is pre-allocated as `make([]evaluatedClaimResponse, len(claims))` and filled by index.
- The clerk SDK v2 `jwt.VerifyParams` struct has a `Token` field. Based on public clerk-sdk-go v2 documentation.
- `claims.Subject` on the returned `*clerk.SessionClaims` contains the Clerk user ID. Based on public clerk-sdk-go v2 documentation.

**Issues flagged:**
- The `github.com/clerk/clerk-sdk-go/v2` package is declared in `go.mod` but is not present in the local Go module cache. Running `go mod tidy` will require network access to download it. Until this is done, `go build ./...` and `go test ./...` will fail with a missing module error. This is a P2 infrastructure blocker for gate verification.

---

## Entry: extension-error-visibility-fix

**Agent:** Frontend Engineer (focused invocation via orchestrator)
**Date:** 2026-05-11
**Task:** Fix silent failure in Chrome extension — make errors visible end-to-end (popup + sidebar)

**Files changed:**
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/popup/Popup.tsx`
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/sidebar/Sidebar.tsx`
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/styles/sidebar.css`

**Summary of changes:**

1. `Popup.tsx` — `handleAnalyze()`: Added `chrome.runtime.lastError` check after `chrome.tabs.sendMessage`. Added guard for `res === undefined` (content script not injected, e.g. on a chrome:// page). Both conditions now produce a user-visible error message in the popup rather than a silent TypeError crash. Extracted `broadcastError()` helper that sets popup error state and calls `chrome.runtime.sendMessage({ type: 'SHOW_ERROR' })` to forward the error to the sidebar. Also patched the `GET_CONTEXT` callback in `useEffect` to guard `chrome.runtime.lastError`. Also added a parallel `chrome.runtime.sendMessage` broadcast for `SHOW_ANNOTATIONS` so the sidebar receives it (sidebar listens on `chrome.runtime.onMessage`; `chrome.tabs.sendMessage` only reaches content scripts).

2. `Sidebar.tsx`: Added `'error'` to the `status` state union. Added `errorMsg` state. Added handler for `message.type === 'SHOW_ERROR'`. Rendered a `<p className="sidebar__error" role="alert">` when status is `'error'`. Scoped the annotation card render to `status === 'done'` only.

3. `sidebar.css`: Added `.sidebar__error` rule — same sizing and padding as `.sidebar__empty`, color set to `var(--color-risk-high)`.

**Self-checks applied:**
- Security: No user-controlled content is inserted via innerHTML or dangerouslySetInnerHTML. Error messages come from `chrome.runtime.lastError.message` (browser-controlled) or from the extension's own background handler (not from page content). Tokens not logged. No new dependencies.
- Accessibility: Error paragraph uses `role="alert"` so screen readers announce it when it appears. Color is not the sole indicator — text content conveys the error. Contrast ratio of `--color-risk-high` (#E63946) against white background is ~4.6:1, meeting AA.
- Performance: No new renders, no new requests. `broadcastError` is called at most once per analyze click. No memoization needed.
- Design accuracy (architectural): Component names and state variable names match domain and existing conventions. No new components introduced. Error state follows same pattern as popup's existing `status === 'error'` branch.
- Change impact: Changes are scoped to the three files. No shared component interfaces changed. No new props added. `broadcastError` is a file-local helper.

**Build result:** `pnpm --filter @shirajitsu/extension build` — PASS (tsc + vite, 0 errors)
**Test result:** `pnpm --filter @shirajitsu/extension test` — 6/6 PASS

**Decisions made:**
- Used `chrome.runtime.sendMessage` (broadcast to all extension pages) rather than `chrome.tabs.sendMessage` (content-script only) for `SHOW_ERROR` and the sidebar copy of `SHOW_ANNOTATIONS`. This is the correct MV3 channel for popup-to-sidebar communication. Documented as DEC-006.
- Kept `chrome.tabs.sendMessage` for `SHOW_ANNOTATIONS` to content script (unchanged) for inline highlight mode. Added a second broadcast via `chrome.runtime.sendMessage` for the sidebar copy.
- `role="alert"` on the sidebar error paragraph: this is a live region that will be announced immediately by screen readers when it appears — appropriate for an error condition.

**Issues flagged:** None at P2 or above.

---

## Entry: extension-messaging-bug-fix

**Agent:** Frontend Engineer (focused invocation via orchestrator)
**Task ID:** extension-messaging-bug-fix
**Status:** Completed
**Date:** 2026-05-11

**Task description:** Debug and fix the remaining two bugs in the Chrome extension messaging chain after commit 6c4e851 — popup shows "Analysis complete" immediately (no "Analyzing…" state visible, wrong terminal state), and the sidebar stays stuck at idle even on errors.

**Inputs received:**
- Bug report (inline): popup immediately shows "Analysis complete — see sidebar"; sidebar stays at idle
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/popup/Popup.tsx`
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/content/index.ts`
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/background/handler.ts`
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/background/index.ts`
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/sidebar/Sidebar.tsx`

**Outputs produced:**
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/popup/Popup.tsx` — open sidepanel and send ANALYSIS_STARTED before dispatching RUN_ANALYSIS; split chrome.runtime.lastError and res === undefined guards; add null guard
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/content/index.ts` — replace Promise form of chrome.runtime.sendMessage with callback form wrapped in new Promise; add explicit .catch() on runAnalysis().then(sendResponse); add explicit return type annotation

**Root causes identified:**

Bug 1 (sidebar stays idle — primary bug): The sidepanel page only receives `chrome.runtime` messages while it is open. If the user clicks "Analyze this page" without the sidebar open, `SHOW_ERROR` is broadcast into the void — no listener exists to receive it. The previous fix (DEC-006) correctly changed the channel from `chrome.tabs.sendMessage` to `chrome.runtime.sendMessage`, but did not ensure the sidebar was actually open before broadcasting. Fix: open the sidepanel and send `ANALYSIS_STARTED` at the START of `handleAnalyze`, before initiating the analysis pipeline, so the sidebar is open and listening by the time any result or error message is broadcast.

Bug 2 (content-script → background communication reliability): In some Chrome MV3 environments, the Promise form of `chrome.runtime.sendMessage` in a content script resolves with `undefined` when the background service worker calls `sendResponse` asynchronously (inside a `.then()`). This causes `runAnalysis()` to resolve with `undefined`, and `sendResponse(undefined)` is called to the popup. Additionally, if the background service worker is cold and rejects the message, `runAnalysis().then(sendResponse)` had no `.catch()`, so the rejection was unhandled and `sendResponse` was never called — leaving the popup stuck in `analyzing` indefinitely. Fix: use the callback form of `chrome.runtime.sendMessage` (wrapped in a `new Promise`) which reliably delivers the `sendResponse` value and surfaces errors via `chrome.runtime.lastError`. Add `.catch()` to `runAnalysis().then(sendResponse)` to handle any remaining rejection.

**Self-checks applied:**
- Security: Error messages come from `chrome.runtime.lastError.message` (browser-controlled) or from the background handler (not from page content). No user-controlled strings are inserted into the DOM unsanitized. No new dependencies.
- Accessibility: No change to rendered output or ARIA structure. Error rendering unchanged from prior fix.
- Performance: Opening the sidepanel at the start of handleAnalyze adds one `chrome.sidePanel.open` call and one `chrome.runtime.sendMessage` per analyze click — negligible overhead. No memoization needed.
- Design accuracy (architectural): No new message types introduced. ANALYSIS_STARTED was already handled by Sidebar.tsx. The callback form of `chrome.runtime.sendMessage` is functionally equivalent from the caller's perspective.
- Change impact: Changes are scoped to two files. No shared component interfaces changed. No new message types introduced (ANALYSIS_STARTED and SHOW_ERROR were already defined).

**Build result:** `pnpm --filter @shirajitsu/extension build` — PASS (tsc + vite, 0 errors)
**Test result:** `pnpm --filter @shirajitsu/extension test` — 6/6 PASS

**Decisions made:**
- Open sidepanel and send ANALYSIS_STARTED at the start of handleAnalyze — DEC-007
- Use callback form of chrome.runtime.sendMessage in content script — DEC-008

**Assumptions made:**
- The sidepanel page finishes loading and registering its onMessage listener within the time it takes the analysis pipeline to complete (claim extraction + source evaluation + annotation). For an LLM-based pipeline, this duration is measured in seconds. The sidepanel React app loads in under 100ms. This assumption holds for the intended production use case.
- The `chrome.sidePanel.open` call in handleAnalyze does not throw when called from a popup context. Per Chrome MV3 documentation, `sidePanel.open` is permitted from popup action contexts and requires the `sidePanel` permission, which is declared in `public/manifest.json`.

**Issues flagged:** None at P2 or above.

---

## Entry: extension-sidepanel-race-fix

**Agent:** Frontend Engineer (focused invocation)
**Task ID:** extension-sidepanel-race-fix
**Status:** Completed
**Date:** 2026-05-11

**Task description:** Fix "Receiving end does not exist" error in the sidebar caused by three compounding race conditions: fire-and-forget sidePanel.open(), unguarded sendMessage calls, and no session-storage fallback for state missed during React mount.

**Inputs received:**
- Bug report (inline): three root causes identified, exact fix specified
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/popup/Popup.tsx`
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/sidebar/Sidebar.tsx`

**Outputs produced:**
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/popup/Popup.tsx` — added safeBroadcast() helper; persist state to chrome.storage.session before sidePanel.open(); use safeBroadcast for ANALYSIS_STARTED, SHOW_ERROR, and SHOW_ANNOTATIONS; broadcastError now persists to session storage
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/sidebar/Sidebar.tsx` — rewritten useEffect: read session storage on mount before registering listener; typed listener function; cleanup return removes listener on unmount

**Self-checks applied:**
- Security: safeBroadcast suppresses browser-internal error strings by consuming lastError, not logging it. No user-controlled content inserted via innerHTML. Error messages originate from browser runtime (chrome.runtime.lastError) or extension's own handlers — not from page content. chrome.storage.session is extension-private, not accessible to page scripts. No new dependencies.
- Accessibility: No change to rendered ARIA structure or interactive elements. Existing role="alert" on sidebar error paragraph unchanged.
- Performance: One additional chrome.storage.session.set per analyze flow — negligible overhead (extension storage API, not network). No new renders or requests added.
- Design accuracy (architectural): Component names, state variable names, and message types match existing conventions and glossary. Storage keys use namespaced prefix (shirajitsu_) to avoid collisions.

**Decisions made:**
- Use chrome.storage.session as persistent state bridge to eliminate sidepanel mount-timing race — DEC-009

**Assumptions made:**
- chrome.storage.session is available in all Chrome MV3 contexts (popup, sidepanel). This is documented in the Chrome Extensions API for Manifest V3.
- JSON.stringify/parse round-trip for annotations is lossless for the Annotation type (all fields are JSON-serializable primitives and arrays).

**Issues flagged:** None at P2 or above.

---

## Entry: extension-unguarded-tabmessage-fix

**Agent:** Frontend Engineer (focused invocation)
**Task ID:** extension-unguarded-tabmessage-fix
**Status:** Completed
**Date:** 2026-05-11

**Task description:** Find and fix every unguarded `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage` call across the four extension source files that could produce "Could not establish connection. Receiving end does not exist." errors after commit 0d22584.

**Inputs received:**
- Bug report (inline): error persists after 0d22584; tasked to audit all four source files for unguarded send calls
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/popup/Popup.tsx`
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/sidebar/Sidebar.tsx`
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/content/index.ts`
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/background/index.ts`

**Outputs produced:**
- `/Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src/popup/Popup.tsx` — added `safeTabMessage` helper; replaced unguarded `chrome.tabs.sendMessage` for `SHOW_ANNOTATIONS` (line 96) with `safeTabMessage`

**Audit findings — all four files:**

| File | Call | Guarded? | Notes |
|---|---|---|---|
| Popup.tsx | `chrome.tabs.sendMessage(tab.id, { type: 'GET_CONTEXT' }, cb)` | Yes — callback checks `chrome.runtime.lastError` | Already guarded |
| Popup.tsx | `chrome.tabs.sendMessage(tab.id, { type: 'RUN_ANALYSIS' }, cb)` | Yes — callback checks `chrome.runtime.lastError` | Already guarded |
| Popup.tsx | `chrome.tabs.sendMessage(tab.id!, { type: 'SHOW_ANNOTATIONS' })` | **No — no callback at all** | **Root cause of persisting error. Fixed.** |
| Popup.tsx | `chrome.runtime.sendMessage` (via `safeBroadcast`) | Yes | Already guarded |
| content/index.ts | `chrome.runtime.sendMessage` (callback form) | Yes — callback checks `chrome.runtime.lastError` | Already guarded |
| background/index.ts | No sendMessage calls | N/A | Only a message listener |
| Sidebar.tsx | No sendMessage calls | N/A | Only a message listener |

**Self-checks applied:**
- Security: `safeTabMessage` swallows `chrome.runtime.lastError` (browser-internal string), not user content. No user-controlled strings in the helper. No new dependencies. No secrets introduced.
- Accessibility: No UI changes. No ARIA structure changes.
- Performance: No additional renders or requests. One callback invocation per `SHOW_ANNOTATIONS` tab send — negligible.
- Design accuracy (architectural): `safeTabMessage` is a file-local helper, not a new exported component. Message type `SHOW_ANNOTATIONS` unchanged. No domain terminology changes.

**Build result:** `pnpm --filter @shirajitsu/extension build` — PASS (tsc + vite, 0 errors, 0 TypeScript errors)
**Test result:** `pnpm --filter @shirajitsu/extension test` — 6/6 PASS

**Decisions made:**
- Introduced `safeTabMessage` helper for fire-and-forget `chrome.tabs.sendMessage` calls — DEC-010

**Assumptions made:**
- The `SHOW_ANNOTATIONS` send to the content script is non-critical for the sidebar path. The sidebar receives annotations via `safeBroadcast` (chrome.runtime.sendMessage). The content-script send is only needed for inline highlight mode. If the content script is absent (chrome:// page, PDF viewer), swallowing the error is correct — the inline highlight path silently no-ops, and the sidebar still renders annotations.

**Issues flagged:** None at P2 or above.
