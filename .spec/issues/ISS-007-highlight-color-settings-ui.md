# ISS-007: Add HighlightColor setting — UserSettings type extension and settings UI

**ID:** ISS-007
**Title:** Add HighlightColor setting: extend UserSettings type and add settings UI
**Bounded context:** SelectionAnalysis — SelectionSettings sub-context
**Complexity estimate:** M (2–6 hours)
**Security flag:** No
**Performance flag:** No
**Depends on:** none
**API contract references:** None — frontend-only change. No new backend endpoints.

---

## Description

The HighlightColor is a persistent user preference for the background color applied to all inline highlight spans. It must be stored in `chrome.storage.sync` under the key `highlightColor` and default to `'#FFFF00'` (yellow) when not set. This issue adds the type field and the settings UI.

**1. Extend `UserSettings` in `shared/types/src/settings.ts`**

Add `highlightColor: string` to the `UserSettings` interface with default `'#FFFF00'`:
```typescript
// In UserSettings interface:
highlightColor: string

// In DEFAULT_USER_SETTINGS:
highlightColor: '#FFFF00'
```

This makes HighlightColor available in the `settings` object that is already loaded from `chrome.storage.sync` in `Popup.tsx`, passed in `SHOW_ANNOTATIONS`, and read by the content script.

**2. Add color picker to the extension settings UI**

The Gherkin scenarios specify "the user has set a custom highlight color in the extension settings." The settings surface should be a dedicated settings page (option page registered in `manifest.json`) or an expanded settings section within the popup. 

Recommendation (DEC-020): add a collapsible "Settings" section in the popup below the display mode toggle. This avoids building a separate settings page for a single preference. If the popup is already crowded, a separate settings page is the alternative — the implementation agent should use their judgment and document the decision.

The color picker must:
- Display the current HighlightColor (read from `settings.highlightColor` on mount, defaulting to `'#FFFF00'`)
- Allow the user to pick a new color via a native `<input type="color">` element
- On change, write the new color to `chrome.storage.sync` via `chrome.storage.sync.set({ highlightColor: newColor })` and update the `settings` state in the popup
- Persist across popup open/close and browser sessions (guaranteed by `chrome.storage.sync`)

**3. Update `Popup.tsx` to read `highlightColor` from settings**

The existing `chrome.storage.sync.get(Object.keys(DEFAULT_USER_SETTINGS), ...)` call in `Popup.tsx` already reads all keys from `DEFAULT_USER_SETTINGS`. After adding `highlightColor` to `DEFAULT_USER_SETTINGS`, this call will automatically include it. No change to the `get()` call is needed.

The popup must forward `settings` (including `highlightColor`) in both `SHOW_ANNOTATIONS` payloads — this is already done in the existing code.

**Gherkin scenarios satisfied:**
- `selection-settings.feature`: "Chosen highlight color is applied to highlights from selection-based analysis" (type field and forwarding enable ISS-006 to apply it)
- `selection-settings.feature`: "Chosen highlight color is applied to highlights from whole-page analysis"
- `selection-settings.feature`: "Highlight color persists across browser sessions" (chrome.storage.sync guarantees persistence)
- `selection-settings.feature`: "Highlight color is layered on top of risk-level color coding" (type field enables ISS-006's outline layering)

---

## Files to modify

- `shared/types/src/settings.ts` — add `highlightColor: string` to `UserSettings` and `DEFAULT_USER_SETTINGS`
- `ui/extension/src/popup/Popup.tsx` — add color picker UI element; add `saveHighlightColor()` handler that writes to `chrome.storage.sync`

---

## Acceptance criteria

- [ ] `UserSettings` interface in `shared/types/src/settings.ts` includes `highlightColor: string`
- [ ] `DEFAULT_USER_SETTINGS.highlightColor` is `'#FFFF00'`
- [ ] The popup renders a color picker (`<input type="color">`) displaying the current HighlightColor
- [ ] When the user selects a new color, it is written to `chrome.storage.sync['highlightColor']` and the `settings` state is updated
- [ ] On next popup open, the color picker shows the previously selected color (read from `chrome.storage.sync`)
- [ ] The `SHOW_ANNOTATIONS` payload `settings` object includes the current `highlightColor` value
- [ ] `DEFAULT_USER_SETTINGS` is used as the fallback in the `chrome.storage.sync.get()` call — no explicit `'#FFFF00'` hardcoding in the popup handler
- [ ] All existing tests that reference `UserSettings` or `DEFAULT_USER_SETTINGS` are updated to include `highlightColor`
- [ ] `pnpm typecheck` passes in `shared/types` and `ui/extension`

---

## Notes on implementation approach

- `<input type="color">` provides a native OS color picker without any additional dependency. It accepts and returns hex color strings (e.g., `#ffff00`). This is sufficient for the MVP.
- If the popup is visually congested, the implementation agent may place the color picker in a collapsible settings section below the display toggle, and must document this layout decision in the decision log.
- This issue is independent of ISS-004, ISS-005, and ISS-006 — it can run in parallel with any of them as long as ISS-006 is not started before this issue's type changes to `UserSettings` are complete (ISS-006 reads `settings.highlightColor`). Sequencing: ISS-007 must be merged before ISS-006 begins, OR ISS-006 uses the `settings.highlightColor ?? '#FFFF00'` fallback explicitly as specified in ISS-006's description.
- The `shared/types` package is imported by the backend Go services indirectly through the TypeScript SDK — changing `UserSettings` does not affect backend types.
