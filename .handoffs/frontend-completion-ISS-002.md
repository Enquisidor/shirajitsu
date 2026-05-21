# ISS-002 Completion — Frontend Engineer

**Task:** ISS-002 — Add SignInPrompt and AnalyseView conditional rendering to Popup.tsx
**Agent:** Frontend Engineer
**Session:** ext-auth-2026-05-11
**Date:** 2026-05-20
**Status:** Complete

---

## Files changed

- `ui/extension/src/popup/Popup.tsx` — split into SignInPrompt + AnalyseView components; root Popup() now reads `useAuth()`/`useUser()` and renders exactly one branch

## What was implemented

1. **`SignInPrompt` component** — rendered when `isSignedIn` is false or undefined. Shows branding header + "Sign in" button only. No analyse controls rendered.

2. **`AnalyseView` component** — rendered when `isSignedIn` is true. Shows SignedInIdentity (fullName || primaryEmailAddress), "Sign out" button, and all existing analyse controls (unchanged).

3. **Root `Popup()` component** — uses `usePopupAuth()` (thin wrapper around `useAuth()` with type assertion for `openSignIn`) and `useUser()`. Renders `<SignInPrompt>` or `<AnalyseView>` exclusively.

4. **SignedInIdentity derivation** — `user.fullName || user.primaryEmailAddress?.emailAddress || ''`

5. **`usePopupAuth()` helper** — type-asserts `useAuth()` return to include `openSignIn`, which the `@clerk/types` `UseAuthReturn` type does not declare but the SDK exposes at runtime via the Clerk global. If `openSignIn` is not available via `useAuth()` in a future SDK version, switch to `useClerk().openSignIn()` instead.

## Test results

| Phase | Failing | Passing | Total |
|---|---|---|---|
| Before ISS-002 (Phase 1 baseline) | 39 | 9 | 48 |
| After ISS-002 | 15 | 33 | 48 |

**24 new tests pass** — all from `Popup.test.tsx` (TC-001 through TC-013 + additional popup tests).

Remaining 15 failures are in `background/handler.test.ts` and `background/index.test.ts` — these are ISS-003 scope (handler.ts `userToken` replacement with Clerk `getToken()`). Not introduced by ISS-002.

## Typecheck

Pre-existing errors in `handler.test.ts` (argument count mismatch) remain — ISS-003 scope. No new TypeScript errors introduced by ISS-002.

## Security invariant verified

The popup renders exactly ONE of SignInPrompt OR AnalyseView — never both, never neither. The invariant is enforced by the conditional: `if (!isSignedIn) return <SignInPrompt ...>` followed by `return <AnalyseView ...>`.

---

SIGNED OFF
Agent: Frontend Engineer
Task: ISS-002
Status: Complete
Artifacts: ui/extension/src/popup/Popup.tsx, .handoffs/frontend-completion-ISS-002.md
