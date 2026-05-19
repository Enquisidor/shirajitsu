# Test Plan: extension-auth

**Feature area:** ExtensionAuth — Clerk OAuth sign-in/sign-out and JWT plumbing for the Chrome extension popup

**Session:** ext-auth-2026-05-11
**Produced by:** QA Strategist
**Date:** 2026-05-14

---

## Source references

| Source | Path |
|---|---|
| Gherkin (sign-in) | `.features/extension-auth-signin.feature` |
| Gherkin (sign-out) | `.features/extension-auth-signout.feature` |
| Gherkin (token plumbing) | `.features/extension-auth-token-plumbing.feature` |
| Bounded context | `.spec/bounded-contexts/extension-auth.md` |
| Issue ISS-001 | `.spec/issues/ISS-001-clerk-provider-popup-entrypoint.md` |
| Issue ISS-002 | `.spec/issues/ISS-002-popup-auth-conditional-rendering.md` |
| Issue ISS-003 | `.spec/issues/ISS-003-handler-clerk-jwt-plumbing.md` |
| API contract (auth) | `.spec/api-contracts.md` §1 (`POST /v1/analyze` — `Authorization: Bearer <clerk-jwt>`) |

**API contract note:** ExtensionAuth introduces no new server endpoints. The only relevant contract clause is the `Authorization: Bearer <clerk-jwt>` requirement on the existing `POST /v1/analyze`. API contract coverage in this plan is limited to the extension's client-side responsibility: obtaining and attaching a valid Clerk JWT. Gateway-side JWT verification is out of scope for this feature area (it belongs to the gateway service).

---

## Test cases

---

### TC-001

**Title:** ClerkProvider wraps popup — `useAuth()` and `useUser()` are available within `<Popup />`
**Gherkin scenario:** _Prerequisite for all sign-in and sign-out scenarios_ (ISS-001 acceptance criterion)
**Issue:** ISS-001
**Category:** Happy path / foundational
**Priority:** P0

**Preconditions:**
- `VITE_CLERK_PUBLISHABLE_KEY` is set to a valid non-empty string in the build environment
- `@clerk/chrome-extension` is present in `ui/extension/package.json`

**Inputs:**
- `main.tsx` renders `<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}><Popup /></ClerkProvider>`
- A test renders `<Popup />` within a mocked `ClerkProvider` that supplies a mocked auth context

**Expected output (pass criteria — all must be true):**
1. The component tree renders without throwing a React context error ("useAuth called outside of ClerkProvider" or equivalent)
2. `useAuth()` called within `<Popup />` returns an object with at least the fields `isSignedIn` (boolean or null), `signOut` (function), `openSignIn` (function or equivalent sign-in trigger)
3. `useUser()` called within `<Popup />` returns an object with at least the field `user` (object or null)
4. The rendered output of `<Popup />` matches a snapshot taken with the mocked provider context (regression guard)

---

### TC-002

**Title:** Build fails with visible error when `VITE_CLERK_PUBLISHABLE_KEY` is undefined
**Gherkin scenario:** _No Gherkin scenario — derived from ISS-001 acceptance criterion and bounded context invariant_
**Issue:** ISS-001
**Category:** Error condition / build-time invariant
**Priority:** P1

**Preconditions:**
- `VITE_CLERK_PUBLISHABLE_KEY` is NOT set in the build environment (undefined or empty string `""`)

**Inputs:**
- Run `pnpm build` or `pnpm typecheck` against `ui/extension` with `VITE_CLERK_PUBLISHABLE_KEY` unset

**Expected output (pass criteria — at least one must be true):**
1. The build exits with a non-zero exit code, OR
2. A visible build-time warning is emitted to stderr containing the string "VITE_CLERK_PUBLISHABLE_KEY" or equivalent, indicating the Clerk SDK cannot start

**Note:** The exact mechanism (Vite build plugin, runtime guard in `main.tsx`, or TypeScript type-level check) is up to the implementation agent. The test verifies the observable outcome: the build does not silently produce an extension that will fail at runtime with an undefined key.

---

### TC-003

**Title:** Existing `ui/extension` Vitest tests continue to pass after ISS-001 changes
**Gherkin scenario:** _No Gherkin scenario — derived from ISS-001 acceptance criterion (regression guard)_
**Issue:** ISS-001
**Category:** Regression
**Priority:** P1

**Preconditions:**
- ISS-001 changes applied to `ui/extension/src/popup/main.tsx` (and optionally `vite.config.ts`)
- `ClerkProvider` is mocked appropriately in test utilities (e.g., `vi.mock('@clerk/chrome-extension')`)

**Inputs:**
- Run `pnpm --filter @shirajitsu/extension test`

**Expected output (pass criteria — all must be true):**
1. All tests that existed before ISS-001 changes continue to pass (zero regressions)
2. No test relies on reading `chrome.storage.sync['userToken']` as a valid auth path after this change

---

### TC-004

**Title:** SignInPrompt shown when no ClerkSession is active
**Gherkin scenario:** "Sign-in prompt shown when no session exists" (`extension-auth-signin.feature`)
**Issue:** ISS-002
**Category:** Happy path
**Priority:** P0

**Preconditions:**
- ISS-001 complete; `ClerkProvider` wraps `<Popup />`
- `useAuth()` returns `{ isSignedIn: false }`

**Inputs:**
- Render `<Popup />` with mocked `ClerkProvider` providing `isSignedIn: false`

**Expected output (pass criteria — all must be true):**
1. The rendered output contains an element with accessible text "Sign in" (button or link)
2. The rendered output does NOT contain the "Analyse this page" CTA button (or equivalent analyse control)
3. The rendered output does NOT contain the mode selector
4. The rendered output does NOT contain the model selector
5. The rendered output does NOT contain the sidebar button
6. The rendered output does NOT contain the display toggle
7. The rendered output does NOT contain a "Sign out" button

---

### TC-005

**Title:** AnalyseView not rendered when `isSignedIn` is undefined (loading state)
**Gherkin scenario:** _Derived from bounded context invariant: "The analyse controls in the popup MUST NOT be rendered when no ClerkSession is active"_
**Issue:** ISS-002
**Category:** Boundary condition / auth gate
**Priority:** P1

**Preconditions:**
- ISS-001 complete
- `useAuth()` returns `{ isSignedIn: undefined }` (session loading, indeterminate)

**Inputs:**
- Render `<Popup />` with mocked `ClerkProvider` providing `isSignedIn: undefined`

**Expected output (pass criteria — all must be true):**
1. The rendered output does NOT contain the "Analyse this page" CTA button
2. The rendered output does NOT contain the mode selector, model selector, sidebar button, or display toggle

**Gap note:** The spec does not define the exact UI shown when `isSignedIn` is `undefined` (loading state). This test only asserts that analyse controls are absent — it does not assert what IS shown. If a loading indicator or blank state is required, that must be specified before this test can assert it.

---

### TC-006

**Title:** Clicking "Sign in" launches Clerk OAuth popup
**Gherkin scenario:** "Clerk OAuth popup launched on sign-in click" (`extension-auth-signin.feature`)
**Issue:** ISS-002
**Category:** Happy path / interaction
**Priority:** P0

**Preconditions:**
- `useAuth()` returns `{ isSignedIn: false, openSignIn: <mock function> }`
- SignInPrompt is rendered

**Inputs:**
- User clicks the "Sign in" button

**Expected output (pass criteria — all must be true):**
1. The `openSignIn` function (or equivalent `@clerk/chrome-extension` sign-in API) is called exactly once
2. The extension popup page does NOT navigate away (no `window.location` change, no tab close)

---

### TC-007

**Title:** Popup transitions to AnalyseView after successful Clerk OAuth flow
**Gherkin scenario:** "Popup transitions to analyse view after successful sign-in" (`extension-auth-signin.feature`)
**Issue:** ISS-002
**Category:** Happy path / state transition
**Priority:** P0

**Preconditions:**
- `isSignedIn` transitions from `false` to `true` (mocked by updating the auth context)

**Inputs:**
- Initial render: `useAuth()` provides `{ isSignedIn: false }`
- State change: re-render with `useAuth()` providing `{ isSignedIn: true, user: { fullName: 'Test User', primaryEmailAddress: { emailAddress: 'test@example.com' } } }`

**Expected output (pass criteria — all must be true):**
1. After the state change, the rendered output contains the "Analyse this page" CTA button (or equivalent analyse control)
2. After the state change, the rendered output does NOT contain the "Sign in" button
3. No manual reload is required — the transition is driven by React re-render

---

### TC-008

**Title:** SignedInIdentity displays `user.fullName` when set
**Gherkin scenario:** "User identity shown after successful sign-in" (`extension-auth-signin.feature`)
**Issue:** ISS-002
**Category:** Happy path
**Priority:** P1

**Preconditions:**
- `useAuth()` returns `{ isSignedIn: true }`
- `useUser()` returns `{ user: { fullName: 'Alex Weinstein', primaryEmailAddress: { emailAddress: 'alex@example.com' } } }`

**Inputs:**
- Render `<Popup />` with the above mocked context

**Expected output (pass criteria — all must be true):**
1. The rendered output contains the text "Alex Weinstein"
2. The rendered output does NOT contain "alex@example.com" as the primary displayed identity

---

### TC-009

**Title:** SignedInIdentity falls back to `user.primaryEmailAddress` when `fullName` is empty
**Gherkin scenario:** "User identity shown after successful sign-in" (`extension-auth-signin.feature`) — PM-confirmed fallback
**Issue:** ISS-002
**Category:** Boundary condition / fallback
**Priority:** P1

**Preconditions:**
- `useAuth()` returns `{ isSignedIn: true }`
- `useUser()` returns `{ user: { fullName: '', primaryEmailAddress: { emailAddress: 'alex@example.com' } } }`

**Inputs:**
- Render `<Popup />` with the above mocked context

**Expected output (pass criteria — all must be true):**
1. The rendered output contains the text "alex@example.com"

---

### TC-010

**Title:** SignedInIdentity falls back to `user.primaryEmailAddress` when `fullName` is null
**Gherkin scenario:** "User identity shown after successful sign-in" (`extension-auth-signin.feature`) — PM-confirmed fallback
**Issue:** ISS-002
**Category:** Boundary condition / fallback
**Priority:** P1

**Preconditions:**
- `useAuth()` returns `{ isSignedIn: true }`
- `useUser()` returns `{ user: { fullName: null, primaryEmailAddress: { emailAddress: 'alex@example.com' } } }`

**Inputs:**
- Render `<Popup />` with the above mocked context

**Expected output (pass criteria — all must be true):**
1. The rendered output contains the text "alex@example.com"

---

### TC-011

**Title:** Signed-in state shown on popup open when a prior Clerk session exists
**Gherkin scenario:** "Signed-in state persists across browser sessions" (`extension-auth-signin.feature`)
**Issue:** ISS-002
**Category:** Happy path / session persistence
**Priority:** P1

**Preconditions:**
- `useAuth()` returns `{ isSignedIn: true }` on initial render (simulating a persisted session restored by `@clerk/chrome-extension`)
- `useUser()` returns a valid user object

**Inputs:**
- Render `<Popup />` with `isSignedIn: true` on mount (no sign-in interaction in this test)

**Expected output (pass criteria — all must be true):**
1. The AnalyseView is rendered immediately on mount (analyse controls visible)
2. The SignInPrompt is NOT rendered
3. No sign-in interaction is required

**Note:** Session persistence is managed internally by `@clerk/chrome-extension` via Chrome storage APIs. The implementation does not need to add any code for persistence. This test verifies that the popup respects a pre-existing `isSignedIn: true` state on mount.

---

### TC-012

**Title:** "Sign out" button is visible in AnalyseView
**Gherkin scenario:** "Sign-out button shown when signed in" (`extension-auth-signout.feature`)
**Issue:** ISS-002
**Category:** Happy path
**Priority:** P0

**Preconditions:**
- `useAuth()` returns `{ isSignedIn: true }`

**Inputs:**
- Render `<Popup />` with `isSignedIn: true`

**Expected output (pass criteria — all must be true):**
1. The rendered output contains an element with accessible text "Sign out" (button or equivalent)

---

### TC-013

**Title:** Clicking "Sign out" calls Clerk `signOut()` and popup returns to SignInPrompt
**Gherkin scenario:** "Session ended and sign-in prompt returned on sign-out" (`extension-auth-signout.feature`)
**Issue:** ISS-002
**Category:** Happy path / state transition
**Priority:** P0

**Preconditions:**
- `useAuth()` returns `{ isSignedIn: true, signOut: <mock function that resolves immediately> }`
- AnalyseView is rendered

**Inputs:**
- User clicks the "Sign out" button

**Expected output (pass criteria — all must be true):**
1. The `signOut()` function is called exactly once
2. After `signOut()` resolves, re-render with `isSignedIn: false` causes the SignInPrompt to appear (no analyse controls visible)
3. The "Sign out" button is no longer visible after the state transition

---

### TC-014

**Title:** Analysis request blocked when no ClerkSession is active — no fetch is sent
**Gherkin scenario:** "Analysis blocked when no session exists" (`extension-auth-token-plumbing.feature`)
**Issue:** ISS-002 (auth gate — CTA not rendered) + ISS-003 (handler-level guard)
**Category:** Auth gate / error condition
**Priority:** P0

**Preconditions:**
- Popup: `useAuth()` returns `{ isSignedIn: false }` — CTA button is not rendered
- Handler: background Clerk instance has `clerk.session` equal to `null`

**Test split — two independent assertions:**

**Part A (popup layer — ISS-002):**
- Render `<Popup />` with `isSignedIn: false`
- Assert: no "Analyse this page" CTA button is present in the rendered output — user cannot trigger analysis at the UI level

**Part B (handler layer — ISS-003):**
- Call `handleAnalyze(message, sendResponse)` with a mocked Clerk instance where `clerk.session` is `null` (or `clerk.session?.getToken()` resolves to `null`)
- Assert: `sendResponse` is called with `{ error: 'Not authenticated. Please sign in.' }`
- Assert: `fetch` (or `globalThis.fetch`) is NOT called (verify with a spy that `fetch` call count is zero)

**Expected output (pass criteria — all four must be true):**
1. Part A: no CTA button rendered
2. Part B: `sendResponse` called with `{ error: 'Not authenticated. Please sign in.' }` exactly
3. Part B: `fetch` not called (zero invocations)
4. Part B: no unhandled promise rejection

---

### TC-015

**Title:** Analysis request carries a valid Clerk JWT in the Authorization header
**Gherkin scenario:** "Analysis request carries a valid Clerk JWT" (`extension-auth-token-plumbing.feature`)
**Issue:** ISS-003
**Category:** Happy path / API contract
**Priority:** P0

**Preconditions:**
- Background Clerk instance is initialised with `VITE_CLERK_PUBLISHABLE_KEY`
- `clerk.session?.getToken()` resolves to `"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test-payload.signature"` (a mock JWT string)
- `gatewayUrl` in `chrome.storage.sync` is set to `"https://gateway.example.com"`
- `fetch` is mocked to return `{ ok: true, json: async () => ({ analysisId: 'test-id', annotations: [] }) }`

**Inputs:**
- Call `handleAnalyze({ type: 'ANALYZE_TEXT', payload: { text: 'Test claim text', context: 'reader' } }, sendResponse)`

**Expected output (pass criteria — all must be true):**
1. `fetch` is called exactly once
2. The first argument to `fetch` is `"https://gateway.example.com/v1/analyze"` (or the gateway URL with `/v1/analyze` appended)
3. The second argument to `fetch` contains a `headers` object where `Authorization` equals `"Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test-payload.signature"` exactly
4. `sendResponse` is called with a success payload (not an error object)

---

### TC-016

**Title:** `chrome.storage.sync['userToken']` is not read in `handler.ts` or `background/index.ts`
**Gherkin scenario:** "Manual token path is not used" (`extension-auth-token-plumbing.feature`)
**Issue:** ISS-003
**Category:** Security / invariant
**Priority:** P0

**Preconditions:**
- ISS-003 changes applied to `handler.ts` and `background/index.ts`

**Inputs (static analysis / code inspection):**
- Source files: `ui/extension/src/background/handler.ts` and `ui/extension/src/background/index.ts`

**Expected output (pass criteria — all must be true):**
1. The string `userToken` does NOT appear in `handler.ts` as a storage key access (i.e., `chrome.storage.sync.get(['userToken'])` or `settings.userToken` or equivalent is absent)
2. The string `userToken` does NOT appear in `background/index.ts` as a storage key access
3. The `gatewayUrl` storage read is still present in `handler.ts` (the `userToken` removal must be surgical — only the auth token path is removed)

**Implementation note for the Test Engineer:** This test may be implemented as a static string search (Jest/Vitest inline snapshot or a `grep`-based assertion), or as a unit test that sets `chrome.storage.sync['userToken'] = 'legacy-token'` and then verifies the value is never accessed during a `handleAnalyze` call. Either approach satisfies the criterion.

---

### TC-017

**Title:** Background Clerk instance initialised with `VITE_CLERK_PUBLISHABLE_KEY`
**Gherkin scenario:** _Derived from ISS-003 acceptance criterion and DEC-013_
**Issue:** ISS-003
**Category:** Happy path / initialisation
**Priority:** P1

**Preconditions:**
- `VITE_CLERK_PUBLISHABLE_KEY` is set to `"pk_test_abc123"` in the build environment
- ISS-003 changes applied to `background/index.ts`

**Inputs:**
- The background service worker module is loaded (import/initialisation)

**Expected output (pass criteria — all must be true):**
1. The Clerk SDK initialisation call (whichever `@clerk/chrome-extension` background API is used) receives `publishableKey: "pk_test_abc123"`
2. The Clerk instance is initialised before the `chrome.runtime.onMessage` listener is registered (order of operations)

---

### TC-018

**Title:** `handleAnalyze` returns auth error without fetching when `getToken()` returns null
**Gherkin scenario:** "Analysis blocked when no session exists" (`extension-auth-token-plumbing.feature`) — handler-layer sub-case
**Issue:** ISS-003
**Category:** Error condition / auth guard
**Priority:** P0

**Preconditions:**
- Background Clerk instance is initialised
- `clerk.session` is non-null but `clerk.session.getToken()` resolves to `null` (expired or invalid token)

**Inputs:**
- Call `handleAnalyze({ type: 'ANALYZE_TEXT', payload: { text: 'Test claim text', context: 'reader' } }, sendResponse)`
- `clerk.session?.getToken()` is mocked to resolve with `null`

**Expected output (pass criteria — all must be true):**
1. `fetch` is NOT called (zero invocations)
2. `sendResponse` is called with `{ error: 'Not authenticated. Please sign in.' }` exactly
3. No unhandled promise rejection

---

### TC-019

**Title:** `gatewayUrl` storage read is preserved after ISS-003 changes
**Gherkin scenario:** _Derived from ISS-003 acceptance criterion — gatewayUrl must not be removed_
**Issue:** ISS-003
**Category:** Regression
**Priority:** P1

**Preconditions:**
- ISS-003 changes applied to `handler.ts`
- `chrome.storage.sync` is mocked: `{ gatewayUrl: 'https://gateway.example.com' }`
- `clerk.session?.getToken()` resolves to a valid mock JWT string
- `fetch` is mocked to return a 200 response

**Inputs:**
- Call `handleAnalyze({ type: 'ANALYZE_TEXT', payload: { text: 'Test claim text', context: 'reader' } }, sendResponse)`

**Expected output (pass criteria — all must be true):**
1. `fetch` is called with `"https://gateway.example.com/v1/analyze"` as the URL (confirming `gatewayUrl` was read and used)

---

### TC-020

**Title:** ISS-003 changes do not break existing `ui/extension` Vitest tests
**Gherkin scenario:** _Derived from ISS-003 acceptance criterion (regression guard)_
**Issue:** ISS-003
**Category:** Regression
**Priority:** P1

**Preconditions:**
- ISS-003 changes applied to `handler.ts` and `background/index.ts`
- `@clerk/chrome-extension` background API is mocked appropriately in test setup

**Inputs:**
- Run `pnpm --filter @shirajitsu/extension test`

**Expected output (pass criteria — all must be true):**
1. All tests that existed before ISS-003 continue to pass (zero regressions)
2. TypeScript compiles without errors (`pnpm typecheck`)

---

## Coverage summary table

Every Gherkin scenario from the three approved feature files must appear in this table.

| Gherkin scenario | Feature file | Test case(s) |
|---|---|---|
| Sign-in prompt shown when no session exists | `extension-auth-signin.feature` | TC-004 |
| Clerk OAuth popup launched on sign-in click | `extension-auth-signin.feature` | TC-006 |
| Popup transitions to analyse view after successful sign-in | `extension-auth-signin.feature` | TC-007 |
| User identity shown after successful sign-in | `extension-auth-signin.feature` | TC-008, TC-009, TC-010 |
| Signed-in state persists across browser sessions | `extension-auth-signin.feature` | TC-011 |
| Sign-out button shown when signed in | `extension-auth-signout.feature` | TC-012 |
| Session ended and sign-in prompt returned on sign-out | `extension-auth-signout.feature` | TC-013 |
| Analysis request carries a valid Clerk JWT | `extension-auth-token-plumbing.feature` | TC-015 |
| Analysis blocked when no session exists | `extension-auth-token-plumbing.feature` | TC-014, TC-018 |
| Manual token path is not used | `extension-auth-token-plumbing.feature` | TC-016 |

**Total Gherkin scenarios:** 10
**Total test cases in this plan:** 20 (TC-001 through TC-020)

---

## Non-Gherkin test cases and their derivation basis

| Test case | Derivation |
|---|---|
| TC-001 | ISS-001 acceptance criterion — ClerkProvider wraps popup correctly |
| TC-002 | ISS-001 acceptance criterion + bounded context invariant — build must fail on undefined key |
| TC-003 | ISS-001 acceptance criterion — regression guard |
| TC-005 | Bounded context invariant — analyse controls MUST NOT render when no session |
| TC-017 | ISS-003 acceptance criterion + DEC-013 — background Clerk initialisation |
| TC-019 | ISS-003 acceptance criterion — gatewayUrl preserved |
| TC-020 | ISS-003 acceptance criterion — regression guard |

---

## Gaps and ambiguities flagged

**GAP-001:** Loading state UI when `isSignedIn === undefined`
- The spec does not define what the popup shows while `@clerk/chrome-extension` is initialising and `isSignedIn` has not yet resolved. TC-005 asserts only that analyse controls are absent; it does not assert what IS shown. If a loading spinner, blank state, or placeholder is required, this must be specified before the Test Engineer can assert it.
- Logged in the decision log as a coverage decision (see DEC-014).

**GAP-002:** `getToken()` returning null vs. `clerk.session` being null
- TC-014 (Part B) and TC-018 cover two sub-cases: `clerk.session === null` (no session) and `clerk.session?.getToken()` resolving to `null` (expired/invalid token). The spec (ISS-003) describes both as "no active session" but groups them under the same error message. The Test Engineer should implement both sub-cases. The error message `{ error: 'Not authenticated. Please sign in.' }` must be identical for both.

---

## Self-evaluation checklist

- [x] Every Gherkin scenario (10 total) maps to at least one test case — confirmed via coverage table
- [x] Bounded context invariants drive additional test cases (TC-001, TC-002, TC-005, TC-016, TC-017)
- [x] API contract coverage: the `Authorization: Bearer <clerk-jwt>` requirement on `POST /v1/analyze` is covered by TC-015 (JWT placed in header) and TC-014/TC-018 (no fetch when unauthenticated)
- [x] No server-side API endpoint test cases added — server-side JWT verification is out of ExtensionAuth scope
- [x] All acceptance criteria are binary (pass/fail without interpretation)
- [x] No vague language used in acceptance criteria
- [x] Coverage summary table present and complete (10/10 scenarios mapped)
- [x] All TC IDs are unique (TC-001 through TC-020) — no prior test plans exist, so sequence starts at TC-001
- [x] No executable test code written — only test plan specifications
- [x] Gaps flagged in writing (GAP-001, GAP-002) rather than silently resolved
- [x] State transitions covered: `isSignedIn: false → true` (TC-007), `isSignedIn: true → false` (TC-013), `isSignedIn: undefined` (TC-005)
- [x] Security-relevant path covered: TC-016 (userToken not read), TC-014/TC-018 (no fetch without auth)
