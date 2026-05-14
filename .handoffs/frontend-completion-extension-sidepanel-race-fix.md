# Completion Artifact — Frontend Engineer

**Issue ID:** extension-sidepanel-race-fix
**Issue title:** Fix "Receiving end does not exist" error in Chrome extension sidebar
**Agent:** Frontend Engineer
**Timestamp:** 2026-05-11T16:07:00Z

---

## Files created or modified

| File | Change |
|---|---|
| `ui/extension/src/popup/Popup.tsx` | Added `safeBroadcast()` helper that suppresses "Receiving end does not exist" by consuming `chrome.runtime.lastError` in the callback. Persists analysis state to `chrome.storage.session` before opening the sidepanel. Uses `safeBroadcast` in place of bare `chrome.runtime.sendMessage` for ANALYSIS_STARTED, SHOW_ERROR, and SHOW_ANNOTATIONS. `broadcastError()` now also persists to session storage. |
| `ui/extension/src/sidebar/Sidebar.tsx` | Rewrote `useEffect` to: (1) read `chrome.storage.session` on mount to recover state missed during React initialization, (2) register typed runtime listener after session read, (3) return cleanup that removes the listener on unmount — eliminating listener accumulation on re-renders. |

---

## Implementation summary

The fix addresses three compounding causes of the "Receiving end does not exist" error:

1. **Fire-and-forget race:** `chrome.sidePanel.open()` returns before the sidepanel's React tree has mounted. The `ANALYSIS_STARTED` message sent immediately after arrives before any `onMessage` listener exists. Fixed by writing `{ shirajitsu_state: 'analyzing' }` to `chrome.storage.session` before calling `sidePanel.open()` — the sidebar reads this on mount and sets its own state regardless of whether it received the runtime message.

2. **Unguarded sendMessage:** `chrome.runtime.sendMessage` calls with no error guard surface Chrome's "Receiving end does not exist" string as the visible error message when the sidepanel is not yet open. Fixed by the `safeBroadcast()` helper which reads `chrome.runtime.lastError` in its callback (suppressing the error from surfacing elsewhere) and discards it — the session storage write ensures state is not lost even when the broadcast is received by no one.

3. **Listener accumulation and no fallback:** The sidebar `useEffect` never returned a cleanup, so `onMessage.addListener` was called on every re-render. The listener had no mechanism to recover state sent before React mounted. Fixed by a typed listener function with a cleanup return, and the session storage read that runs before the listener is registered.

---

## Deviations from spec

None. The fix was fully specified in the task description. The implementation matches the specified code exactly, with no deviations.

---

## Design gaps

None. No UI states were changed. The sidebar's visual rendering is identical to before; only the state recovery mechanism was changed.

---

## Test suite result

**Command:** `pnpm --filter @shirajitsu/extension test`

```
> @shirajitsu/extension@0.0.1 test /Users/alexweinstein/Documents/Code/shirajitsu/ui/extension
> vitest run

 RUN  v1.6.1 /Users/alexweinstein/Documents/Code/shirajitsu/ui/extension/src

 ✓ context/detector.test.ts  (6 tests) 27ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  16:06:39
   Duration  1.23s (transform 61ms, setup 0ms, collect 50ms, tests 27ms, environment 600ms, prepare 147ms)
```

**Build command:** `pnpm --filter @shirajitsu/extension build`

Result: PASS — tsc --noEmit (0 TypeScript errors) + vite build (0 errors, 55 modules transformed).

---

## Commit

`0d22584` — `fix(extension): guard sidepanel messaging race with session-storage fallback` — pushed to `main`.

---

Status: READY FOR PHASE-2 VERIFICATION
