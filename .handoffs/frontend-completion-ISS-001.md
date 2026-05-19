# Completion Artifact — ISS-001: Wrap popup entrypoint with ClerkProvider

**Issue ID:** ISS-001
**Title:** Wrap popup entrypoint with ClerkProvider from `@clerk/chrome-extension`
**Agent:** Frontend Engineer
**Timestamp:** 2026-05-15T16:10:00Z
**Session:** ext-auth-2026-05-11

---

## Files Created or Modified

| File | Change |
|---|---|
| `ui/extension/src/popup/main.tsx` | Added `ClerkProvider` wrapper from `@clerk/chrome-extension`, added ClerkPublishableKey startup invariant validation (throws if `VITE_CLERK_PUBLISHABLE_KEY` is missing or does not start with `pk_`), wrapped `<Popup />` in `<ClerkProvider publishableKey={...}>` inside `<StrictMode>` |
| `ui/extension/tsconfig.json` | Added `"vite/client"` to `types` array to provide `import.meta.env` type support for `VITE_CLERK_PUBLISHABLE_KEY`; consistent with `ui/web/tsconfig.json` pattern |

---

## Implementation Summary

`main.tsx` now validates `VITE_CLERK_PUBLISHABLE_KEY` at startup before any Clerk SDK initialisation: if the key is absent or does not start with `"pk_"`, a descriptive `Error` is thrown immediately with a clear message instructing the developer to set the environment variable before building. When the key is valid, `<Popup />` is rendered wrapped in `<ClerkProvider publishableKey={clerkPublishableKey}>` inside `<StrictMode>`, satisfying the ExtensionAuth bounded context invariant that the Clerk SDK must not be initialised with an undefined key.

The `tsconfig.json` change adds `"vite/client"` to the extension's TypeScript types, enabling `import.meta.env` type resolution without scattering triple-slash directives across source files. This is the pattern already used by `ui/web/tsconfig.json`. No new runtime dependencies were added — `@clerk/chrome-extension` was already present in `package.json`.

---

## Deviations from Spec

| Deviation | DEC Reference |
|---|---|
| Added `"vite/client"` to `ui/extension/tsconfig.json` — not explicitly mentioned in ISS-001 spec but required to satisfy the TypeScript typecheck acceptance criterion | DEC-017 |

---

## Design Gaps

None. ISS-001 is an entrypoint-only change with no UI rendering surface.

---

## Test Suite Result

**Command run:** `cd ui/extension && pnpm test -- --run`

**Result:** 39 failed | 9 passed (48 total)

This is identical to the pre-implementation baseline established in the Phase 1 report (`.test-reports/phase1-2026-05-15.md`). No regressions were introduced.

**Why TC-001 through TC-013 still fail after ISS-001:**

All 24 tests in `Popup.test.tsx` (TC-001 through TC-013) import `<Popup />` directly and mock `@clerk/chrome-extension` (including `useAuth` and `useUser`). These tests test the conditional rendering behavior of `Popup.tsx` — specifically that it calls `useAuth()` and conditionally renders `SignInPrompt` vs `AnalyseView` based on `isSignedIn`. The current committed `Popup.tsx` does NOT call `useAuth()` or `useUser()` — it renders all controls unconditionally. This is the behavior ISS-002 will fix.

ISS-001's change to `main.tsx` is not exercised by the test suite because:
- Tests import `<Popup />` directly (not `main.tsx`)
- `@clerk/chrome-extension` including `ClerkProvider` is fully mocked in the test file

The TC-001 through TC-013 tests will pass after ISS-002 is implemented (adding `useAuth`/`useUser` hooks and conditional rendering to `Popup.tsx`).

**Pre-existing typecheck errors (unrelated to ISS-001):**

- `Popup.test.tsx`: `toBeInTheDocument` — `@testing-library/jest-dom` matchers not configured in vitest setup (pre-existing, not ISS-001's scope)
- `handler.test.ts`: "Expected 1 arguments, but got 2" — pre-existing, will be fixed by ISS-003 implementation

The ISS-001-introduced typecheck error (`Property 'env' does not exist on type 'ImportMeta'`) was resolved by the `tsconfig.json` change (DEC-017). No errors from ISS-001 code remain.

---

## Self-Check Status

| Module | Status | Findings |
|---|---|---|
| Security | Completed | ClerkPublishableKey validated before SDK init; not stored; not logged; `@clerk/chrome-extension` is an existing pinned dependency |
| Accessibility | Completed | No new UI elements rendered by this change; `StrictMode` wrapper added |
| Performance | Completed | No new dependencies; `ClerkProvider` is placed correctly at the root; no unnecessary re-renders introduced |
| Design Accuracy (architectural) | Completed | `ClerkPublishableKey` named correctly per glossary; `VITE_CLERK_PUBLISHABLE_KEY` env var matches canonical identifier; no undocumented API endpoints; ISS-001 acceptance criteria all satisfied |

---

Status: READY FOR PHASE-2 VERIFICATION

Note: Phase-2 verification of TC-001 through TC-013 is contingent on ISS-002 being merged first. ISS-001 alone does not change test outcomes for `Popup.test.tsx`.
