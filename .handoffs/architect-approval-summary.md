# Architect Phase 2 Approval Summary — ExtensionAuth (Clerk OAuth)

**Session:** ext-auth-2026-05-11
**Phase completed:** Phase 2 — Spec
**Timestamp:** 2026-05-14
**Awaiting:** Tech Lead Gate 2 approval

---

## Files produced

| File | Description |
|---|---|
| `/Users/alexweinstein/Documents/Code/shirajitsu/.spec/glossary.md` | Updated — ExtensionAuth context-specific terms added (ClerkSession, ClerkJwt, ClerkPublishableKey, SignedInIdentity, SignInPrompt, AnalyseView, OAuthPopup); userToken added as a Retired Term |
| `/Users/alexweinstein/Documents/Code/shirajitsu/.spec/bounded-contexts/extension-auth.md` | Updated — DEC-011 reference corrected to DEC-013 (background token acquisition decision) |
| `/Users/alexweinstein/Documents/Code/shirajitsu/.spec/issues/ISS-001-clerk-provider-popup-entrypoint.md` | New — wrap popup entrypoint with ClerkProvider |
| `/Users/alexweinstein/Documents/Code/shirajitsu/.spec/issues/ISS-002-popup-auth-conditional-rendering.md` | New — SignInPrompt and AnalyseView conditional rendering in Popup.tsx |
| `/Users/alexweinstein/Documents/Code/shirajitsu/.spec/issues/ISS-003-handler-clerk-jwt-plumbing.md` | New — update handler.ts to obtain ClerkJwt from background Clerk instance, remove userToken path |
| `/Users/alexweinstein/Documents/Code/shirajitsu/.logs/decisions.md` | Updated — DEC-013 appended (background token acquisition decision) |
| `/Users/alexweinstein/Documents/Code/shirajitsu/CLAUDE.md` | Updated — Architecture Conventions and Directory Structure sections filled in |

---

## Bounded context summary

**ExtensionAuth** (already fully specified in `.spec/bounded-contexts/extension-auth.md`)

Responsible for the Chrome extension's full authentication lifecycle: detecting an active ClerkSession when the popup opens, rendering SignInPrompt or AnalyseView accordingly, orchestrating the Clerk OAuth popup on sign-in, displaying the SignedInIdentity, handling sign-out, and supplying a valid ClerkJwt to the background's `handleAnalyze` function for use in the `Authorization: Bearer` header. All UI states are client-only — no new server endpoints are required for this feature.

---

## Key design decisions

| Decision | ID | Summary |
|---|---|---|
| Background Clerk instance for JWT acquisition | DEC-013 | Background service worker initialises its own Clerk instance and calls `getToken()` directly, rather than receiving the token from the popup via message relay. Chosen because it removes runtime dependency on the popup being open, keeps the message protocol clean, and uses `@clerk/chrome-extension` as designed. |
| Conformist relationship with Gateway auth contract | DEC-010 (prior) | ExtensionAuth conforms to the Gateway's published `Authorization: Bearer <jwt>` contract. No changes to gateway auth verification are part of this feature. |

---

## Issue breakdown

| Issue | Complexity | Depends On | Agent |
|---|---|---|---|
| ISS-001: Wrap popup entrypoint with ClerkProvider | S | none | Frontend Engineer |
| ISS-002: Popup SignInPrompt / AnalyseView conditional rendering | M | ISS-001 | Frontend Engineer |
| ISS-003: handler.ts ClerkJwt acquisition + userToken removal | M | ISS-001 | Frontend Engineer |

**Total:** 3 issues — 1 S, 2 M. No L issues. No backend or DevOps issues.

**Dependency graph:**
```
ISS-001 (ClerkProvider entrypoint)
  ├── ISS-002 (popup auth rendering)   [depends on ISS-001]
  └── ISS-003 (handler.ts JWT)         [depends on ISS-001]
```

ISS-002 and ISS-003 are independent of each other and may run in parallel once ISS-001 is complete. They touch different files (`Popup.tsx` vs `handler.ts` + `background/index.ts`) and have no shared output paths.

---

## No new API contracts

This feature is entirely client-side. The existing `POST /v1/analyze` endpoint already accepts `Authorization: Bearer <clerk-jwt>` (Decision 10 in `.spec/api-contracts.md`). No new endpoints were added and no existing endpoints were modified.

## No schema changes

Clerk manages session persistence in its own Chrome storage APIs. No Shirajitsu database schema changes are required for this feature.

---

## Assumptions

1. `@clerk/chrome-extension` v1 supports a background service worker initialisation API that allows calling `getToken()` without a renderer context. ISS-003 explicitly states that if this assumption is false, the implementation agent must escalate before falling back to the message-relay pattern.
2. The `VITE_CLERK_PUBLISHABLE_KEY` environment variable pattern already used by `ui/web` is sufficient for `ui/extension` — the same variable name, injected the same way via `import.meta.env`.
3. Session persistence across browser restarts is handled entirely by `@clerk/chrome-extension` — the extension does not need to implement any persistence layer for this.

---

## Open questions for tech lead

None — all architectural decisions have been resolved and documented. The only conditional risk is Assumption 1 above (background Clerk instance API surface), which is flagged in ISS-003 as an escalation condition rather than an open question blocking the spec.

---

**Awaiting tech lead approval before proceeding.**
