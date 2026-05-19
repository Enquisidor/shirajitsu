# QA Strategist — Phase 3 Handoff Summary

**Phase completed:** Phase 3 — Test Plan
**Session:** ext-auth-2026-05-11
**Date:** 2026-05-14

---

## Files produced

- `/Users/alexweinstein/Documents/Code/shirajitsu/.test-plans/extension-auth.md` — structured test plan for the ExtensionAuth feature area: 20 test cases (TC-001 through TC-020), coverage summary table, gap documentation

---

## Test case summary

| Category | Count | TC IDs |
|---|---|---|
| Happy path | 8 | TC-001, TC-004, TC-006, TC-007, TC-008, TC-012, TC-013, TC-015 |
| Boundary condition / fallback | 4 | TC-005, TC-009, TC-010, TC-011 |
| Error condition / auth gate | 4 | TC-002, TC-014, TC-018 |
| Security / invariant | 1 | TC-016 |
| Regression | 3 | TC-003, TC-019, TC-020 |
| Initialisation | 1 | TC-017 |
| **Total** | **20** | TC-001 — TC-020 |

**Gherkin scenarios covered:** 10 of 10 (all scenarios from all three feature files)

---

## Key decisions made

- **DEC-016:** For TC-005 (loading state when `isSignedIn === undefined`), only assert the absence of analyse controls — do not assert what is shown. The loading-state UI is not specified in the Gherkin or spec. The gap is documented for PM review rather than silently inventing a requirement.

---

## Assumptions made

1. No prior test plans existed in `.test-plans/` — TC IDs begin at TC-001.
2. Gateway-side JWT verification is explicitly out of scope for the ExtensionAuth test plan. The extension's responsibility ends at attaching the JWT to the Authorization header (covered by TC-015).
3. TC-016 (manual token path not used) may be implemented by the Test Engineer as either a static source-file string search or a unit test that verifies `chrome.storage.sync['userToken']` is never accessed. Both approaches satisfy the acceptance criterion.

---

## Open questions / gaps for next phase

**GAP-001 — Loading state UI (PM decision required before Phase 4):**
The spec does not define what the popup shows while `@clerk/chrome-extension` is initialising and `isSignedIn === undefined`. TC-005 asserts only that analyse controls are absent. If a loading spinner, blank area, or placeholder is required, the PM must specify it before the Test Engineer can write a positive assertion for this state.

**GAP-002 — `getToken()` returning null vs. `clerk.session` being null (informational):**
TC-014 (Part B) and TC-018 cover two sub-cases of the unauthenticated handler path. Both must return `{ error: 'Not authenticated. Please sign in.' }` exactly, per ISS-003. The Test Engineer should implement both sub-cases as separate test assertions. No PM decision needed — this is a Test Engineer implementation note.
