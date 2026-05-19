# Requirements Brief: Extension Auth (Clerk OAuth)

**Date:** 2026-05-11
**Requested by:** PM
**Feature:** Chrome Extension Authentication

---

## Background

The Chrome extension currently has no authentication flow. `handler.ts` checks for a `userToken` in `chrome.storage.sync` — but there is no UI to sign in or set that token. Any user who clicks "Analyze this page" sees: _"Not authenticated. Please sign in."_ with no way to act on it.

The spec (api-contracts.md Decision 10) calls for Clerk OAuth via `@clerk/chrome-extension`. The user should never paste a token manually.

---

## What needs to be built

### Sign-in flow (popup)
- When the extension popup opens and no active Clerk session exists, show a "Sign in" prompt instead of the analyze controls.
- Clicking "Sign in" triggers the Clerk OAuth popup (using `@clerk/chrome-extension`).
- After successful sign-in, the popup transitions to the normal analyze view.
- Signed-in state is persistent across browser sessions (Clerk handles token refresh).

### Sign-out
- Signed-in popup shows the user's name/email and a "Sign out" button.
- Clicking "Sign out" ends the Clerk session and returns to the sign-in view.

### Token plumbing
- `handler.ts` must obtain the JWT from the active Clerk session (not from `chrome.storage.sync['userToken']`).
- The existing `userToken` key in `chrome.storage.sync` must be removed from all reads.

### Out of scope for this feature
- Web app auth (already uses `@clerk/clerk-react` — not part of this brief)
- Platform API key auth (`X-API-Key`) — separate feature
- User account settings / provider key configuration — separate feature

---

## Acceptance criteria (summary)

1. A user with no Clerk session sees a sign-in prompt in the popup and cannot trigger analysis.
2. Clicking "Sign in" opens a Clerk OAuth popup and completes the flow without leaving the extension.
3. After sign-in, the popup shows the analyze controls and the user's identity.
4. "Analyze this page" sends a valid Clerk JWT in the `Authorization` header.
5. Clicking "Sign out" clears the session and returns to the sign-in prompt.
6. The `userToken` manual-token path is fully removed.

---

## Tech notes for the Architect

- `@clerk/chrome-extension` is the official Clerk SDK for MV3 extensions. It wraps `@clerk/clerk-js` with Chrome-specific storage and OAuth popup handling.
- The extension has four separate entrypoints (background, content, popup, sidepanel). Clerk state must be accessible in the popup entrypoint only — not shared runtime.
- Clerk publishable key (`VITE_CLERK_PUBLISHABLE_KEY`) is already an env var pattern used in the web app; the extension build should follow the same pattern via `vite.config.ts`.
- The background entrypoint (`handler.ts`) needs to obtain the JWT. In MV3, the Clerk session lives in the popup's renderer context — the background script needs to either (a) request the token from the popup/sidepanel via `chrome.runtime.sendMessage`, or (b) use `@clerk/chrome-extension`'s `getToken()` from a shared Clerk instance initialized in background. The Architect should decide the right approach.
