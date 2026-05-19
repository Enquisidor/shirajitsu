# ISS-002: Add SignInPrompt and AnalyseView conditional rendering to Popup.tsx

**ID:** ISS-002
**Title:** Add SignInPrompt and AnalyseView conditional rendering to Popup.tsx
**Bounded context:** ExtensionAuth
**Complexity estimate:** M (2–6 hours)
**Security flag:** Yes — auth-gated UI; must not render analyse controls when no ClerkSession is active
**Performance flag:** No
**Depends on:** ISS-001
**API contract references:** None — this is a client-only change.

---

## Description

The current `Popup.tsx` renders the analyse controls unconditionally regardless of whether the user has an active Clerk session. This issue replaces the popup's single render path with two mutually exclusive UI states:

**SignInPrompt** (rendered when `isSignedIn` is false or undefined):
- Displays the Shirajitsu branding header
- Displays a "Sign in" button that triggers the Clerk OAuth popup (via `@clerk/chrome-extension`'s sign-in API)
- Does NOT render the analyse controls, mode selector, model selector, sidebar button, or display toggle
- Satisfies the invariant: "The analyse controls in the popup MUST NOT be rendered when no ClerkSession is active"

**AnalyseView** (rendered when `isSignedIn` is true):
- Displays the SignedInIdentity — the user's display name if set, otherwise their primary email address (PM-confirmed fallback from Gate 1)
- Displays a "Sign out" button that calls Clerk's `signOut()` and returns the popup to the SignInPrompt state
- Displays all existing analyse controls (CTA button, mode selector, model selector, sidebar button, display toggle, error/success states)
- The analyse controls are functionally unchanged — they continue to read settings from `chrome.storage.sync` for display mode, mode override, and selected model

**Gherkin scenarios satisfied:**
- `extension-auth-signin.feature`: all 5 scenarios (sign-in prompt shown; OAuth popup launched; popup transitions to analyse view; user identity shown; signed-in state persists)
- `extension-auth-signout.feature`: both scenarios (sign-out button shown when signed in; session ended and sign-in prompt returned)
- `extension-auth-token-plumbing.feature` Scenario 2: "Analysis blocked when no session exists" — no analysis request sent when SignInPrompt is displayed, because the CTA button is not rendered

---

## Files to modify

- `ui/extension/src/popup/Popup.tsx` — add `useAuth()` / `useUser()` hooks; split render into SignInPrompt and AnalyseView branches

---

## Acceptance criteria

- [ ] When `isSignedIn` is false (no active ClerkSession), the popup renders ONLY a sign-in prompt with a "Sign in" button; no analyse controls, mode selector, model selector, sidebar button, or display toggle are rendered
- [ ] When `isSignedIn` is true, the popup renders ONLY the AnalyseView: SignedInIdentity, "Sign out" button, and all existing analyse controls
- [ ] SignedInIdentity displays `user.fullName` if non-empty, otherwise `user.primaryEmailAddress?.emailAddress`
- [ ] Clicking "Sign in" launches the Clerk OAuth popup (via `@clerk/chrome-extension` sign-in API) — does not navigate away from the extension popup
- [ ] After successful sign-in, the popup transitions to AnalyseView without requiring a manual reload
- [ ] Clicking "Sign out" calls Clerk's `signOut()`, which — upon resolution — causes the popup to return to SignInPrompt state
- [ ] The "Sign out" button is visible in AnalyseView
- [ ] Closing and reopening Chrome with a prior active session shows AnalyseView directly (session persistence is handled by `@clerk/chrome-extension` — no additional code needed, but the test must confirm it)
- [ ] All existing Vitest tests in `ui/extension` continue to pass; new tests cover both SignInPrompt and AnalyseView branches
- [ ] No reads of `chrome.storage.sync['userToken']` are introduced or retained

---

## Notes on implementation approach

- `useAuth()` from `@clerk/chrome-extension` provides `isSignedIn`, `signOut`, and `openSignIn` (or equivalent)
- `useUser()` from `@clerk/chrome-extension` provides `user.fullName` and `user.primaryEmailAddress`
- The existing `handleAnalyze` function in the popup dispatches to the content script via `chrome.tabs.sendMessage` — this path is unchanged; the auth gate is the conditional render (no CTA button visible = no analysis possible)
- The existing settings state (`chrome.storage.sync` reads for `displayMode`, `manualModeOverride`, `selectedModel`) remains in `Popup.tsx` — it is only relevant in AnalyseView but can continue to be loaded unconditionally on mount
