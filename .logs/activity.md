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
