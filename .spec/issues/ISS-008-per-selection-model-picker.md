# ISS-008: Add PerSelectionModelOverride model picker to the popup

**ID:** ISS-008
**Title:** Add PerSelectionModelOverride model picker to the popup
**Bounded context:** SelectionAnalysis — SelectionSettings sub-context
**Complexity estimate:** S (under 2 hours)
**Security flag:** No
**Performance flag:** No
**Depends on:** ISS-005
**API contract references:** None — frontend-only change. No new backend endpoints.

---

## Description

The current popup has a `ModelSelector` component that calls `saveModel()`, which writes the selected model to `chrome.storage.sync`. This is the global model setting.

This issue adds a separate, ephemeral PerSelectionModelOverride: a model picker that is only visible when a SelectionContext is present, whose value is held in React state (`perSelectionModel: AIModel | null`) and never written to `chrome.storage.sync`.

**What changes in `Popup.tsx`:**

1. Add React state: `const [perSelectionModel, setPerSelectionModel] = useState<AIModel | null>(null)`

2. Show the per-selection model picker only when `selection !== null` (a SelectionContext is present). The per-selection picker should be visually distinct from the global model selector (e.g., labeled "Model for this selection:" vs. the global "Model:").

3. The per-selection picker shows only models that are configured in the user's global settings — specifically, models for providers where the user has a configured API key. The PM-confirmed constraint is: "show only models configured in the user's global settings (not persisted per-selection)." In the current architecture, `UserSettings` does not carry `UserApiKeys` to the popup (the keys are server-side). The available models list is `SUPPORTED_MODELS` from `@shirajitsu/types`. For the MVP, show all `SUPPORTED_MODELS` — there is no client-side key availability signal. Document this gap as a known limitation (DEC-022 if needed, or an open question in the bounded context).

4. When the user clicks "Analyze selection":
   - Use `perSelectionModel ?? settings.selectedModel` as the `model` field in the analysis request. The `handleAnalyze` function should accept or close over this resolved model value.
   - Do NOT call `saveModel()` (which writes to `chrome.storage.sync`).

5. When the popup closes and reopens, `perSelectionModel` resets to `null` (React state is ephemeral). On next open, the popup will show the global `settings.selectedModel` as the effective model.

6. When the user clears their selection while the popup is open (`selection` becomes `null`), hide the per-selection model picker. Do NOT reset `perSelectionModel` to `null` in state — if the user re-selects text, the picker should reappear showing the global default (the picker was hidden, so any prior in-session choice is lost when it disappears, which is fine).

**Gherkin scenarios satisfied:**
- `selection-settings.feature`: "Model selection controls are shown in the popup when text is selected"
- `selection-settings.feature`: "Per-selection model override is used for that submission"
- `selection-settings.feature`: "Per-selection model override does not affect the global default setting"
- `selection-settings.feature`: "Popup reverts to global default model on next open after a per-selection override"

---

## Files to modify

- `ui/extension/src/popup/Popup.tsx` — add `perSelectionModel` state; add conditional per-selection model picker; update `handleAnalyze` to use `perSelectionModel ?? settings.selectedModel`

---

## Acceptance criteria

- [ ] When `selection !== null`, a model picker is rendered in the popup labeled distinctly from the global model selector
- [ ] When `selection === null`, the per-selection model picker is not rendered
- [ ] The per-selection model picker renders the `SUPPORTED_MODELS` list (or a subset filtered by configured API keys if that signal becomes available)
- [ ] When the user selects a model in the per-selection picker, the `perSelectionModel` state is updated
- [ ] When the user clicks "Analyze selection", the analysis request uses `perSelectionModel` as the `model` field (if set), or `settings.selectedModel` (if `perSelectionModel` is `null`)
- [ ] `chrome.storage.sync['selectedModel']` is NOT written when the user interacts with the per-selection model picker (only the global `saveModel()` writes to storage)
- [ ] After clicking "Analyze selection" with a per-selection override, the global `settings.selectedModel` is unchanged
- [ ] On the next popup open (closing and reopening), the per-selection picker shows the current global `settings.selectedModel` (i.e., the override does not persist)
- [ ] Unit tests cover: per-selection picker visible when selection present; picker hidden when selection absent; analysis uses perSelectionModel when set; analysis uses settings.selectedModel when perSelectionModel is null; storage not written on picker change
- [ ] `pnpm typecheck` passes in `ui/extension`

---

## Notes on implementation approach

- The `ModelSelector` component from `@shirajitsu/react` can be reused for the per-selection picker. Pass `value={perSelectionModel ?? settings.selectedModel}` and `onChange={setPerSelectionModel}`.
- The distinction from the global model selector: the global selector calls `saveModel()` (writes to storage); the per-selection selector calls `setPerSelectionModel()` (React state only).
- The PM-confirmed constraint "show only models configured in the user's global settings" cannot be fully enforced client-side in the current architecture because API key presence is a server-side signal. Document this as a known limitation: the popup shows all `SUPPORTED_MODELS`; the gateway will return a `provider_key_missing` error if the user submits with a model for which they have no key. The error handling in `handleAnalyze` already handles gateway errors.
- `perSelectionModel` must never be written to `chrome.storage.sync` or `chrome.storage.session`. This is an invariant from the bounded context. Add a comment in the code explicitly stating this.
