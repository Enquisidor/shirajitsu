# Ubiquitous Language Glossary — Shirajitsu

The Architect owns and maintains this file. All agents must use the canonical term from this file in code, API fields, comments, log messages, and inter-agent communication.

**This is a living document.** Update it whenever a new concept is introduced or an existing term's meaning is refined. Any agent that encounters an undefined term or a term used inconsistently must add it to the Contested Terms section and request Architect resolution before proceeding.

---

## How to use this glossary

- Every term used in `.spec/api-contracts.md`, `.spec/bounded-contexts/`, `.spec/aggregates/`, or any implementation issue must appear in the glossary.
- When writing code: use the canonical identifier exactly (PascalCase for types, camelCase for fields in Go/TS). No abbreviations, synonyms, or informal variations.
- When in doubt about a term: check this file before inventing a name.

---

## Core Terms (All Contexts)

Terms with consistent meaning across all bounded contexts.

---

### Claim · All Contexts

**Definition:** A discrete, checkable factual assertion extracted from a body of text. A Claim is something that can in principle be verified against external sources. It is never an opinion, a framing choice, or a rhetorical assertion.

**Canonical identifier in code:** `Claim` (type), `claim` (field), `claimText` (the assertion string)

**Related terms:**
- Annotation: contains a Claim as its root fact
- RiskLevel: classified per Claim

**Synonyms (DO NOT USE in code or communication):**
- "statement": too broad — includes opinions and rhetoric
- "fact": prejudges verifiability
- "assertion": acceptable in documentation but not in code identifiers

**Anti-patterns:**
- "fact-check item": informal; not a domain term

**Example in a domain sentence:**
"The claim-extractor identified three Claims in the article, each with a searchQuery optimised for source lookup."

---

### Annotation · All Contexts

**Definition:** The assembled result for a single Claim — comprising the AnnotationState, TensionRating (if applicable), evaluated Sources, and any CommentaryItems. An Annotation is the primary output unit of the Shirajitsu analysis pipeline.

**Canonical identifier in code:** `Annotation` (type), `annotation` (field)

**Related terms:**
- Claim: the factual assertion the Annotation describes
- AnnotationState: the confidence classification within an Annotation
- TensionRating: the probabilistic framing divergence within an Annotation

**Synonyms (DO NOT USE):**
- "result": too generic
- "fact-check": prejudges; use Annotation

---

### AnnotationState · All Contexts

**Definition:** A three-value classification of the confidence level of an Annotation given the sources found: `sourced` (accessible Tier 1 or Tier 2 source found), `limited` (only inaccessible Tier 1/2 sources found), `unverified` (no Tier 1/2 sources found).

**Canonical identifier in code:** `AnnotationState` (type), `state` (field on Annotation)

**Anti-patterns (terms that must never be used for this concept):**
- "verified" / "unverified" as truth judgements: `unverified` means we couldn't find sources, not that the claim is false
- "true" / "false": Shirajitsu never makes truth verdicts

---

### TensionRating · All Contexts

**Definition:** A probabilistic measure of how many Tier 1 and Tier 2 sources frame a given Claim differently from each other. Always expressed as a fraction (numerator / denominator) with hedged language: "X of Y sources frame this differently." Never a truth verdict.

**Canonical identifier in code:** `TensionRating` (type), `tensionRating` (field)

**Anti-patterns:**
- "contradiction score": implies a verdict
- "accuracy rating": implies a verdict
- "credibility score": implies a verdict

---

### Source · All Contexts

**Definition:** A web resource that has been evaluated against the Shirajitsu source registry for a given Claim. Carries a Tier, accessibility status, and a summary of how it relates to the claim.

**Canonical identifier in code:** `Source` (type), `source` (field), `sources` (collection)

**Related terms:**
- Tier: the registry classification of a Source
- Accessible: whether the Source can be surfaced to the user

---

### Tier · All Contexts

**Definition:** The registry classification of a Source's reliability. Four values: `tier1` (Institutional — peer-reviewed, government data, academic bodies), `tier2` (Reputable — established journalism, named subject-matter experts), `community-verified` (crowd-sourced editing, e.g. Wikipedia), `tier3` (Unrated — no registry classification).

**Canonical identifier in code:** `Tier` (type), `tier` (field). String values: `"tier1"`, `"tier2"`, `"community-verified"`, `"tier3"`.

**Anti-patterns:**
- "rank": use Tier
- "credibility level": not a domain term
- "source score": not a domain term

---

## Context-Specific Terms

### ClaimExtraction

---

#### RiskLevel · ClaimExtraction

**Definition:** A probabilistic classification of how likely a Claim is to be contested or verifiably incorrect, assigned by the LLM during extraction. Three values: `high`, `medium`, `low`. Not a truth judgement — a triage signal for prioritising verification effort.

**Canonical identifier in code:** `RiskLevel` (type), `riskLevel` (field)

**Synonyms (DO NOT USE):**
- "severity": implies a known harm
- "confidence": ambiguous direction

---

#### SearchQuery · ClaimExtraction

**Definition:** A web search string derived from a Claim's text and optimised for source lookup. Not the claim text verbatim — the LLM rewrites it for search effectiveness.

**Canonical identifier in code:** `searchQuery` (field on Claim)

**Synonyms (DO NOT USE):**
- "query": acceptable in comments, not in code fields
- "search term": not the canonical form

---

### SourceEvaluation

---

#### GeneratesRating · SourceEvaluation

**Definition:** A boolean property of a Tier — true if the tier contributes to a TensionRating computation. Only `tier1` and `tier2` generate ratings; `community-verified` and `tier3` do not.

**Canonical identifier in code:** `GeneratesRating()` (method on Tier in Go), checked in TensionRating computation

**Synonyms (DO NOT USE):**
- "countable": informal
- "included in rating": not a domain term

---

#### Accessible · SourceEvaluation

**Definition:** Whether the full content of a Source can be surfaced directly to the user. False for paywalled, geo-restricted, or otherwise inaccessible sources.

**Canonical identifier in code:** `accessible` (field on Source, boolean)

**Synonyms (DO NOT USE):**
- "available": too broad
- "open": ambiguous (open source vs. open access)
- "reachable": implies network reachability, not content access

---

### Annotation

---

#### CommentaryItem · Annotation

**Definition:** An item of unverified public discussion (e.g., forum thread, social media post) surfaced as context alongside an Annotation. Always labelled `unverified-public-discussion`. Never counted in the TensionRating and never presented as evidence.

**Canonical identifier in code:** `CommentaryItem` (type), `commentaryItems` (field on Annotation)

**Synonyms (DO NOT USE):**
- "source": a CommentaryItem is not a Source
- "reference": too broad

---

### ExtensionAuth

---

#### ClerkSession · ExtensionAuth

**Definition:** The active Clerk user session managed by `@clerk/chrome-extension`. Either active (user is signed in) or absent (user is not signed in). The extension does not own the session lifecycle — it observes and reacts to it via the Clerk SDK. A ClerkSession is the aggregate root of the ExtensionAuth bounded context.

**Canonical identifier in code:** `ClerkSession` (type), Clerk SDK's `useAuth()` hook (`isSignedIn` field), `clerk.session` (background)

**Anti-patterns (DO NOT USE):**
- "auth state": use ClerkSession
- "login session": use ClerkSession
- "token state": use ClerkSession

---

#### ClerkJwt · ExtensionAuth

**Definition:** An opaque signed JSON Web Token obtained from the active ClerkSession via `getToken()`. Used as the value of the `Authorization: Bearer` header on analysis requests. Immutable per issuance. Never stored to disk — obtained fresh from the Clerk SDK instance on each analysis request.

**Canonical identifier in code:** `ClerkJwt` (type alias for `string`), obtained via `clerk.session.getToken()` or `getToken()` from `useAuth()`

**Invariant:** A ClerkJwt MUST NOT be read from `chrome.storage.sync`. The legacy `userToken` key in `chrome.storage.sync` is retired by this feature.

**Anti-patterns (DO NOT USE):**
- "userToken": retired; the `chrome.storage.sync['userToken']` path is removed by ISS-003
- "auth token": use ClerkJwt
- "bearer token": use ClerkJwt

---

#### ClerkPublishableKey · ExtensionAuth

**Definition:** The Clerk publishable key used to initialise the Clerk SDK instances in the popup and background entrypoints. Injected at build time via `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY`. Immutable per build. Not a secret — safe to embed in the extension bundle.

**Canonical identifier in code:** `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` (Vite env var)

**Invariant:** The extension MUST NOT start a Clerk SDK instance if this value is undefined.

**Anti-patterns (DO NOT USE):**
- "API key": use ClerkPublishableKey
- "Clerk key": use ClerkPublishableKey
- "publishable key": use full compound form ClerkPublishableKey

---

#### SignedInIdentity · ExtensionAuth

**Definition:** The user display string shown in the popup when a ClerkSession is active. Computed at display time from the ClerkSession: uses the user's display name if set, otherwise falls back to the user's primary email address. PM-confirmed fallback behaviour (Gate 1 approval).

**Canonical identifier in code:** `SignedInIdentity` (type alias for `string`), derived from `user.fullName ?? user.primaryEmailAddress?.emailAddress`

**Anti-patterns (DO NOT USE):**
- "username": use SignedInIdentity
- "user info": use SignedInIdentity
- "profile": use SignedInIdentity

---

#### SignInPrompt · ExtensionAuth

**Definition:** The UI state rendered in the popup when no ClerkSession is active. Displays the Shirajitsu branding and a "Sign in" button that launches the OAuthPopup. Mutually exclusive with AnalyseView — exactly one is rendered at any time.

**Canonical identifier in code:** `<SignInPrompt />` (React component)

**Invariant:** The analyse controls MUST NOT be rendered when SignInPrompt is active.

**Anti-patterns (DO NOT USE):**
- "login screen": use SignInPrompt
- "auth wall": use SignInPrompt
- "unauthenticated state": use SignInPrompt

---

#### AnalyseView · ExtensionAuth

**Definition:** The UI state rendered in the popup when a ClerkSession is active. Displays the analyse controls (CTA button, mode selector, model selector), the SignedInIdentity, and the "Sign out" button. Mutually exclusive with SignInPrompt — exactly one is rendered at any time.

**Canonical identifier in code:** `<AnalyseView />` (React component, or conditional branch within `<Popup />`)

**Invariant:** The SignInPrompt MUST NOT be rendered when AnalyseView is active.

**Anti-patterns (DO NOT USE):**
- "main view": use AnalyseView
- "authenticated state": use AnalyseView
- "dashboard": use AnalyseView

---

#### OAuthPopup · ExtensionAuth

**Definition:** The Clerk-managed OAuth browser popup launched when the user clicks "Sign in". Controlled entirely by `@clerk/chrome-extension` via the `openSignIn()` or equivalent API — the extension initiates it but does not manage its lifecycle.

**Canonical identifier in code:** launched via `@clerk/chrome-extension` sign-in API (e.g., `openSignIn()`)

**Anti-patterns (DO NOT USE):**
- "login popup": use OAuthPopup
- "Clerk window": use OAuthPopup
- "auth dialog": use OAuthPopup

---

### SelectionAnalysis

Terms introduced by the Selection-Based Analysis feature (session: selection-analysis-2026-05-15).

---

#### SelectionContext · SelectionAnalysis

**Definition:** The snapshot of the user's current text selection on the active page, captured by the content script and reported to the popup via `GET_CONTEXT`. Contains the selected text string, the word count of that text, and the DOM Range object used to build the SelectionCharacterMap. A SelectionContext is absent when the user has no text selected, when the selection contains only whitespace, or when the selection is empty.

**Canonical identifier in code:** `SelectionContext` (type), `selection` (field on `DetectedContext` extension), `null` when no selection is present

**Invariants:**
- `text` must be non-empty and contain at least one non-whitespace character
- `wordCount` must be ≥ 1
- A `SelectionContext` with `wordCount < 5` is valid to capture but will fail the SelectionLengthGuard

**Anti-patterns (DO NOT USE):**
- "selected text": use SelectionContext (for the object) or `selection.text` (for the string value)
- "highlight selection": ambiguous — "highlight" is a rendered element; "selection" is the user's browser text selection
- "user selection": use SelectionContext

---

#### SelectionLengthGuard · SelectionAnalysis

**Definition:** The validation rule that a SelectionContext's `wordCount` must be ≥ 5 (five words, PM-confirmed) before the popup permits submission of an "Analyze selection" request. When the guard fails, the popup renders a SelectionTooShortWarning and blocks the submit action. The guard is enforced in the popup at click time — not by the content script, not by the background, and not by the gateway.

**Canonical identifier in code:** `selectionMeetsLengthRequirement(selection: SelectionContext): boolean` (pure function in popup helper module)

**Invariant:** A selection that passes the SelectionLengthGuard (wordCount ≥ 5) MUST NOT show a SelectionTooShortWarning.

**Anti-patterns (DO NOT USE):**
- "character limit": the guard is word-count-based, not character-count-based
- "minimum length": use SelectionLengthGuard (for the rule) or "minimum word count" (for documentation)
- "short selection check": use SelectionLengthGuard

---

#### SelectionTooShortWarning · SelectionAnalysis

**Definition:** The inline UI message rendered in the popup when the user clicks "Analyze selection" and the SelectionLengthGuard fails. It informs the user that the selected text is too short to analyze. It is rendered inline in the popup (not a toast or modal). It is cleared when the selection changes to a valid selection.

**Canonical identifier in code:** `selectionTooShort` (boolean state field in Popup), rendered as an inline `<p>` or `<span>` with a descriptive message

**Invariant:** When SelectionTooShortWarning is visible, the analysis request MUST NOT be submitted.

**Anti-patterns (DO NOT USE):**
- "error": this is a validation warning, not a system error; use SelectionTooShortWarning
- "alert": use SelectionTooShortWarning
- "validation error": use SelectionTooShortWarning

---

#### SelectionPreview · SelectionAnalysis

**Definition:** The truncated display of the selected text shown in the popup beneath the "Analyze selection" CTA. Displays the first 80 characters of `SelectionContext.text`, followed by an ellipsis (`…`) if the text exceeds 80 characters. If the text is 80 characters or fewer, no ellipsis is appended. The 80-character limit is a display-only truncation — the full selected text is always submitted in the analysis request.

**Canonical identifier in code:** `selectionPreview(text: string): string` (pure function in popup helper module), rendered as a `<p>` beneath the CTA

**Invariant:** The SelectionPreview MUST NOT be shown when no SelectionContext is present.

**Anti-patterns (DO NOT USE):**
- "preview text": use SelectionPreview
- "selection snippet": use SelectionPreview
- "truncated selection": use SelectionPreview

---

#### SelectionCharacterMap · SelectionAnalysis

**Definition:** A `CharacterMapEntry[]` built from the selected DOM Range, not the full page text extraction. Offset 0 in the SelectionCharacterMap corresponds to the first character of the selected text. Used as the argument to `applyHighlights()` when the analysis was run on a selection. The SelectionCharacterMap is built at analysis time (when `RUN_ANALYSIS` is processed in the content script) by calling `extractSelection()`.

**Canonical identifier in code:** `CharacterMapEntry[]` (same type as the full-page map), produced by `extractSelection(): ExtractedSelection` in `extractor.ts`

**Related terms:**
- `CharacterMapEntry`: existing type — `{ textOffset: number, node: Text, nodeOffset: number }`
- `extractText()`: the full-page equivalent

**Anti-patterns (DO NOT USE):**
- "selection map": use SelectionCharacterMap
- "offset map": use SelectionCharacterMap
- "highlight map": use SelectionCharacterMap

---

#### ExtractedSelection · SelectionAnalysis

**Definition:** The return value of `extractSelection()` — the parallel to `ExtractedText` for the selected DOM range. Contains the selected text string and the SelectionCharacterMap anchored to the selected DOM range.

**Canonical identifier in code:** `ExtractedSelection` (interface in `extractor.ts`), fields: `{ text: string, characterMap: CharacterMapEntry[] }`

**Anti-patterns (DO NOT USE):**
- "selection result": use ExtractedSelection
- "extracted text" (for a selection): use ExtractedSelection; `ExtractedText` refers specifically to the full-page extraction result

---

#### HighlightColor · SelectionAnalysis

**Definition:** The user-configured persistent background color applied to all inline highlight spans, for both selection-based and whole-page analyses. Stored in `chrome.storage.sync` under the key `highlightColor` as a CSS color string (hex, rgb, or named color). Defaults to `'#FFFF00'` (yellow) when not set. The HighlightColor is layered with the RiskLevel border: the highlight span's `backgroundColor` is the HighlightColor; the `outline` is the risk-level color (DEC-021, PM-confirmed layering rule).

**Canonical identifier in code:** `highlightColor` (field in `UserSettings`, `chrome.storage.sync` key), default `'#FFFF00'`

**Invariant:** The HighlightColor MUST be applied to every inline highlight span, regardless of whether the analysis was run on a selection or the full page.

**Anti-patterns (DO NOT USE):**
- "user color": use HighlightColor
- "custom color": use HighlightColor
- "highlight background": use HighlightColor (the background aspect is the canonical meaning; the border aspect is the risk-level color)

---

#### PerSelectionModelOverride · SelectionAnalysis

**Definition:** An ephemeral model selection that the user can change in the popup for a single "Analyze selection" submission. The PerSelectionModelOverride is held in React state only — it is never written to `chrome.storage.sync`. When the popup closes and reopens, it reverts to the global `UserSettings.selectedModel`. The override is applied only to the `model` field in the analysis request when the user clicks "Analyze selection." It does not affect global settings.

**Canonical identifier in code:** `perSelectionModel: AIModel | null` (React state field in Popup), `null` means use `settings.selectedModel`

**Invariant:** Writing `perSelectionModel` to `chrome.storage.sync` is forbidden. The PerSelectionModelOverride MUST NOT persist across popup open/close cycles.

**Anti-patterns (DO NOT USE):**
- "temporary model": use PerSelectionModelOverride
- "session model": use PerSelectionModelOverride
- "one-off model": use PerSelectionModelOverride

---

#### SelectionAnalysisMode · SelectionAnalysis

**Definition:** The flag that records whether the currently active analysis (or the most recently completed analysis) was run on a selection or on the full page. Used by the content script's `SHOW_ANNOTATIONS` handler to determine which character map to use for inline highlight anchoring: SelectionCharacterMap when `selectionAnalysisMode === 'selection'`, full-page characterMap when `selectionAnalysisMode === 'whole-page'`. Stored in `chrome.storage.session` alongside the annotations so the content script can reconstruct the correct anchoring context after a service worker restart.

**Canonical identifier in code:** `selectionAnalysisMode: 'selection' | 'whole-page'` (field in the `SHOW_ANNOTATIONS` message payload and in `chrome.storage.session`)

**Anti-patterns (DO NOT USE):**
- "analysis type": use SelectionAnalysisMode
- "mode": too generic — use SelectionAnalysisMode
- "highlight mode": ambiguous with `displayMode` (sidebar vs. inline); use SelectionAnalysisMode

---

## Contested Terms

*(None)*

---

## Retired Terms

### userToken · ExtensionAuth (retired by ISS-003)

**Formerly:** The manually-stored Clerk JWT in `chrome.storage.sync['userToken']`. Read by `handler.ts` to authenticate analysis requests.

**Retired because:** This feature (ISS-003) removes all reads of `chrome.storage.sync['userToken']`. The JWT is now obtained from the live Clerk SDK instance via `getToken()`. Do not use this key in any new code.
