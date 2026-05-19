# Bounded Context: ExtensionAuth

**Purpose:** Responsible for managing the Chrome extension's authentication lifecycle: presenting sign-in and sign-out UI, orchestrating the Clerk OAuth popup flow, maintaining the active ClerkSession, displaying user identity, and supplying a valid ClerkJwt to the analysis pipeline.

**Owner:** Architect owns all contexts.

---

### Responsibility Boundary

**This context owns:**
- Detecting whether an active ClerkSession exists when the extension popup opens
- Displaying the SignInPrompt when no ClerkSession is active
- Launching the Clerk OAuth popup (via `@clerk/chrome-extension`) when the user requests sign-in
- Transitioning the popup to the AnalyseView upon successful sign-in
- Displaying the SignedInIdentity (user display name or primary email) when a ClerkSession is active
- Displaying a sign-out button and ending the ClerkSession on user request
- Supplying a valid ClerkJwt to `handler.ts` for use in the `Authorization` header of analysis requests
- Blocking analysis requests when no ClerkSession is active

**This context explicitly does not own:**
- The analysis pipeline itself (claim extraction, source evaluation, annotation) — belongs to the pipeline bounded contexts
- Gateway auth verification (JWT validation server-side) — belongs to the gateway service
- Platform API key authentication (`X-API-Key`) — a separate feature
- Web app authentication (already handled by `@clerk/clerk-react` in `ui/web`) — out of scope

---

### Core Model

**Aggregate root:**
- `ClerkSession`: the active Clerk user session. Root entity that carries the session state (active or absent), user identity, and provides access to a ClerkJwt. Managed entirely by the `@clerk/chrome-extension` SDK — the extension does not own the session lifecycle, only observes it.

**Value objects:**
- `ClerkJwt`: an opaque signed JWT string obtained from the active ClerkSession. Immutable per issuance. Passed to `handler.ts` for use as `Authorization: Bearer <token>`. Never stored in `chrome.storage.sync`.
- `SignedInIdentity`: the user display string shown in the popup — the user's display name if set, otherwise the user's primary email address. Derived from the ClerkSession at display time.
- `ClerkPublishableKey`: the Clerk publishable key (`VITE_CLERK_PUBLISHABLE_KEY`) injected at build time via `vite.config.ts`. Immutable per build. Not a secret.

**Domain events:**
- `UserSignedIn` — emitted by `ClerkSession` when the Clerk OAuth flow completes successfully.
  - Trigger: Clerk SDK reports an active session after the OAuth popup closes.
  - Payload: `{ clerkUserId: string, signedInIdentity: SignedInIdentity, occurredAt: ISO8601 }`
- `UserSignedOut` — emitted by `ClerkSession` when the user explicitly clicks "Sign out" and the Clerk SDK confirms session termination.
  - Trigger: `signOut()` resolves successfully.
  - Payload: `{ occurredAt: ISO8601 }`
- `TokenAcquired` — emitted by the background script's Clerk instance when a ClerkJwt is successfully retrieved.
  - Trigger: `getToken()` resolves with a non-null JWT string.
  - Payload: `{ clerkUserId: string, occurredAt: ISO8601 }` (JWT itself not in payload — it is passed directly to the fetch call, not logged)

**Invariants:**
- A ClerkJwt MUST NOT be read from `chrome.storage.sync`. It MUST be obtained from the live Clerk SDK instance via `getToken()`.
- The `userToken` key in `chrome.storage.sync` MUST NOT be read by any extension entrypoint after this feature is implemented.
- When no ClerkSession is active, `handler.ts` MUST return `{ error: 'Not authenticated. Please sign in.' }` without making any fetch call to the gateway.
- The analyse controls in the popup MUST NOT be rendered when no ClerkSession is active.
- The SignInPrompt MUST NOT be rendered when a ClerkSession is active.
- `VITE_CLERK_PUBLISHABLE_KEY` MUST be provided at build time; the extension MUST NOT start the Clerk SDK with an undefined publishable key.

---

### Context Map

| Adjacent Context | Relationship Type | Integration Mechanism | Notes |
|---|---|---|---|
| Gateway (external service) | Open Host Service (Conformist) | HTTP — `Authorization: Bearer <ClerkJwt>` header on `POST /v1/analyze` | ExtensionAuth supplies the JWT; Gateway validates it via Clerk SDK server-side. ExtensionAuth conforms to Gateway's published auth contract (DEC-010). |
| ClaimExtraction / SourceEvaluation / Annotation | No direct relationship | — | ExtensionAuth does not interact with pipeline contexts directly. The JWT it supplies is consumed by the Gateway, which orchestrates the pipeline. |

---

### Ubiquitous Language (context-specific terms)

| Term | Definition within this context | Anti-patterns (do not use) |
|---|---|---|
| ClerkSession | The active Clerk user session managed by `@clerk/chrome-extension`. Either active (user is signed in) or absent (user is not signed in). | "auth state", "login session", "token state" |
| ClerkJwt | An opaque signed JSON Web Token obtained from the active ClerkSession via `getToken()`. Used in the `Authorization: Bearer` header. Never stored to disk. | "userToken", "auth token", "bearer token" (use ClerkJwt as the canonical name) |
| ClerkPublishableKey | The Clerk publishable key used to initialise the Clerk SDK. Injected at build time. Not a secret. | "API key", "Clerk key", "publishable key" (use full compound form) |
| SignedInIdentity | The user display string shown in the popup: display name if available, primary email otherwise. | "username", "user info", "profile" |
| SignInPrompt | The UI state shown when no ClerkSession exists. Displays a "Sign in" button. Mutually exclusive with AnalyseView. | "login screen", "auth wall", "unauthenticated state" |
| AnalyseView | The UI state shown when a ClerkSession is active. Displays analyse controls, SignedInIdentity, and "Sign out" button. Mutually exclusive with SignInPrompt. | "main view", "authenticated state", "dashboard" |
| OAuthPopup | The Clerk-managed OAuth browser popup launched when the user clicks "Sign in". Controlled entirely by `@clerk/chrome-extension`; the extension does not manage it directly. | "login popup", "Clerk window", "auth dialog" |

---

### Open Questions

- None. The architectural decision on background token acquisition is formally recorded as DEC-013. The PM-confirmed display name fallback is incorporated into SignedInIdentity definition above.
