# PO Agent Approval Summary — Extension Auth (Clerk OAuth)

**Phase completed:** Phase 1 — Gherkin authoring
**Timestamp:** 2026-05-14
**Session:** ext-auth-2026-05-11

---

## Feature files produced

| File | Path | Scenarios |
|---|---|---|
| Extension sign-in via Clerk OAuth | `.features/extension-auth-signin.feature` | 5 |
| Extension sign-out via Clerk | `.features/extension-auth-signout.feature` | 2 |
| Extension JWT token plumbing for analysis requests | `.features/extension-auth-token-plumbing.feature` | 3 |
| **Total** | | **10** |

---

## Open questions encountered during authoring

| # | Question | Assumption made |
|---|---|---|
| 1 | The requirements brief says the popup shows the user's "name/email" after sign-in (acceptance criterion 3), but does not specify which to prefer if both are available. | Assumed: display name is preferred; fall back to primary email address if display name is not set. This aligns with standard Clerk user object behaviour. PM should confirm. |
| 2 | The brief says Clerk state must be accessible in the popup entrypoint only (tech note). The token plumbing feature file covers the case where the analysis request is sent from the popup context. Whether `handler.ts` (background entrypoint) can obtain the JWT independently, or must request it from the popup, is an architectural decision left to the Architect. The Gherkin describes the observable outcome only — "the analysis request is sent with a valid Clerk JWT in the Authorization header" — without prescribing the implementation path. | Assumed: this is correct and intentional. The Gherkin is silent on the mechanism; the Architect decides. |
| 3 | The brief specifies that the `userToken` manual-token path must be removed. It does not specify what error or UI state appears if the user somehow reaches analysis while unauthenticated (e.g. session expires mid-use without popup refresh). | Assumed: the "Analysis blocked when no session exists" scenario in `extension-auth-token-plumbing.feature` covers this. The popup reverts to the sign-in prompt. PM should confirm this is the intended behaviour for session expiry mid-use. |

---

## Implied scenarios (not explicitly stated in the brief)

The following scenarios were added based on logical error cases implied by the stated requirements. The PM should confirm each or request removal.

| Scenario | File | Rationale |
|---|---|---|
| "Analysis blocked when no session exists" | `extension-auth-token-plumbing.feature` | The brief says unauthenticated users cannot trigger analysis (AC 1). The scenario covering the token plumbing feature for the unauthenticated case is implied. |
| "Manual token path is not used" | `extension-auth-token-plumbing.feature` | AC 6 requires full removal of the `userToken` manual path. A scenario explicitly asserting this behaviour is required to make the removal verifiable as an observable behaviour, not just a code deletion. |
| "Signed-in state persists across browser sessions" | `extension-auth-signin.feature` | The brief states "Signed-in state is persistent across browser sessions (Clerk handles token refresh)." This is a distinct observable behaviour that requires a scenario. |

---

**Awaiting PO/PM approval before proceeding.**
