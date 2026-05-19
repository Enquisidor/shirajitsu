# ISS-001: Wrap popup entrypoint with ClerkProvider

**ID:** ISS-001
**Title:** Wrap popup entrypoint with ClerkProvider from `@clerk/chrome-extension`
**Bounded context:** ExtensionAuth
**Complexity estimate:** S (under 2 hours)
**Security flag:** Yes — introduces the Clerk SDK initialisation surface; ClerkPublishableKey must be validated at build time
**Performance flag:** No
**Depends on:** none
**API contract references:** None — this is a client-only change. No new server endpoints.

---

## Description

The extension popup currently renders `<Popup />` directly from `ui/extension/src/popup/main.tsx` with no authentication context. `@clerk/chrome-extension` provides a `ClerkProvider` component that must wrap the entire popup React tree to make Clerk session state available via hooks (`useAuth`, `useUser`) to child components.

This issue adds `ClerkProvider` to the popup entrypoint (`main.tsx`) and ensures `VITE_CLERK_PUBLISHABLE_KEY` is correctly injected at build time via the Vite environment variable pattern already used by `ui/web`.

This is the foundational issue that all other ExtensionAuth popup issues depend on. Until this is in place, `useAuth()` and `useUser()` are not available in `Popup.tsx`.

**Gherkin scenarios satisfied (prerequisite for):**
All 5 scenarios in `.features/extension-auth-signin.feature` and both scenarios in `.features/extension-auth-signout.feature` and all 3 scenarios in `.features/extension-auth-token-plumbing.feature` — all of which require Clerk session state to be available in the popup React tree.

---

## Files to modify

- `ui/extension/src/popup/main.tsx` — wrap `<Popup />` with `<ClerkProvider publishableKey={...} />`
- `ui/extension/vite.config.ts` — if needed, ensure `VITE_CLERK_PUBLISHABLE_KEY` is exposed via `define` or `import.meta.env`

---

## Acceptance criteria

- [ ] `ui/extension/src/popup/main.tsx` wraps `<Popup />` with `<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} />`
- [ ] The extension build completes without TypeScript errors when `VITE_CLERK_PUBLISHABLE_KEY` is set in the environment
- [ ] The extension build fails (or emits a visible build-time warning) when `VITE_CLERK_PUBLISHABLE_KEY` is not set — the Clerk SDK must not start with an undefined key (invariant from bounded context)
- [ ] `useAuth()` and `useUser()` hooks from `@clerk/chrome-extension` return valid values when called within `<Popup />` after this change
- [ ] All existing Vitest tests in `ui/extension` continue to pass (popup tests must mock `ClerkProvider` appropriately)
- [ ] No new reads of `chrome.storage.sync['userToken']` are introduced

---

## Assumptions

- `@clerk/chrome-extension` is already in `ui/extension/package.json` (confirmed in requirements brief) — no new dependency installation required
- The `VITE_CLERK_PUBLISHABLE_KEY` env var pattern follows `ui/web`'s existing usage of `VITE_CLERK_PUBLISHABLE_KEY` for `@clerk/clerk-react`
- A `.env` or `.env.local` file for development is not the concern of this issue — only the build-time injection pattern needs to be in place
