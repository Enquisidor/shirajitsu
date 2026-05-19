# ISS-003: Update handler.ts to obtain ClerkJwt from background Clerk instance

**ID:** ISS-003
**Title:** Update handler.ts to obtain ClerkJwt from background Clerk instance and remove legacy userToken path
**Bounded context:** ExtensionAuth
**Complexity estimate:** M (2–6 hours)
**Security flag:** Yes — auth token acquisition; directly controls what is sent in the Authorization header on every analysis request; legacy userToken path removal
**Performance flag:** No
**Depends on:** ISS-001
**API contract references:** `POST /v1/analyze` (`.spec/api-contracts.md` §1) — `Authorization: Bearer <clerk-jwt>` header

---

## Description

The current `ui/extension/src/background/handler.ts` obtains the auth token by reading `chrome.storage.sync['userToken']` — a manually-stored string that has never had a UI to set it. This is the legacy path that must be removed.

This issue replaces the `userToken` read with a `getToken()` call on a Clerk SDK instance initialized in the background service worker. This follows the architectural decision in DEC-011: the background service worker initialises its own `@clerk/chrome-extension` Clerk instance and calls `session.getToken()` directly. The alternative (popup sending the token via `chrome.runtime.sendMessage`) was rejected because it creates a dependency on the popup being open, which cannot be guaranteed for the lifetime of the background's async fetch to the gateway.

**What changes in `handler.ts`:**
- Remove: `const settings = await chrome.storage.sync.get(['gatewayUrl', 'userToken'])`
- Remove: `const token = settings.userToken as string | undefined`
- Add: obtain a Clerk instance initialised with `VITE_CLERK_PUBLISHABLE_KEY` in the background context
- Add: call `clerk.session?.getToken()` (or equivalent `@clerk/chrome-extension` background API) to retrieve the ClerkJwt
- If `getToken()` returns null (no active session), return `{ error: 'Not authenticated. Please sign in.' }` without making any fetch call to the gateway — same error message as before, but now triggered by a missing Clerk session rather than a missing storage value
- The `gatewayUrl` read from `chrome.storage.sync` remains (it is not part of the auth path being replaced)

**What changes in `background/index.ts` or a new file:**
- Initialise the Clerk instance for the background service worker using `@clerk/chrome-extension`'s background/service-worker initialisation API
- The Clerk instance must be initialised before the `onMessage` listener can call `getToken()`

**Gherkin scenarios satisfied:**
- `extension-auth-token-plumbing.feature` Scenario 1: "Analysis request carries a valid Clerk JWT" — `getToken()` is called and the returned JWT is placed in the Authorization header
- `extension-auth-token-plumbing.feature` Scenario 3: "Manual token path is not used" — `chrome.storage.sync['userToken']` is no longer read

---

## Files to modify

- `ui/extension/src/background/handler.ts` — replace `userToken` read with Clerk `getToken()` call
- `ui/extension/src/background/index.ts` — add Clerk instance initialisation for the background service worker context

---

## Acceptance criteria

- [ ] `chrome.storage.sync['userToken']` is not read anywhere in `handler.ts` or `background/index.ts`
- [ ] A Clerk instance is initialised in the background service worker using `@clerk/chrome-extension`'s background initialisation API, using `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY`
- [ ] `handler.ts` calls `clerk.session?.getToken()` (or equivalent) to obtain the ClerkJwt before each analysis request
- [ ] When the Clerk session is active, the ClerkJwt is placed in the `Authorization: Bearer` header of the `POST /v1/analyze` fetch call
- [ ] When `getToken()` returns null (no active session), `handleAnalyze` returns `{ error: 'Not authenticated. Please sign in.' }` immediately without making any fetch call
- [ ] All existing Vitest tests in `ui/extension` continue to pass; new tests cover both the authenticated path (valid JWT in Authorization header) and the unauthenticated path (no fetch, returns auth error)
- [ ] The `gatewayUrl` read from `chrome.storage.sync` is preserved — only the `userToken` read is removed
- [ ] TypeScript compiles without errors (`pnpm typecheck`)

---

## Notes on implementation approach

- `@clerk/chrome-extension` provides a mechanism to use Clerk in a background service worker context. The implementation agent should read the `@clerk/chrome-extension` v1 documentation to determine the exact initialisation API for background contexts. The spec does not prescribe the exact import name — only the behavior: initialise once, call `getToken()` per request.
- The Clerk instance in the background is separate from the `ClerkProvider` in the popup. Both initialise with the same `VITE_CLERK_PUBLISHABLE_KEY`. Session state is shared via Chrome storage APIs (managed by the Clerk SDK internally).
- If `@clerk/chrome-extension` does not support direct background initialisation in v1, the fallback approach (option a from DEC-011) must be escalated to the Architect before implementing — do not silently fall back.
