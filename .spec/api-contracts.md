# API Contracts

**Version:** 1.1 — 2026-04-29
**Status:** Draft — pending search provider selection

This document specifies all HTTP contracts between services in the Shirajitsu pipeline. All request/response bodies are JSON (`Content-Type: application/json`). All timestamps are ISO 8601 UTC.

---

## Orchestration Flow

```
Client
  └─► POST /v1/analyze  (gateway)
        ├─► POST /extract          (claim-extractor)  → claims[]
        ├─► POST /evaluate         (source-evaluator) → evaluatedClaims[]
        │       └─ [internal] parallel search-API call per claim (goroutines)
        └─► POST /annotate         (annotator)        → annotations[]
              └─► AnalyzeResponse returned to client
```

Gateway orchestrates the full pipeline. Services do not call each other directly.
Source-evaluator fans out search API calls internally — one per claim, in parallel — and waits for all results before returning.
Annotator makes one LLM call per claim (claim text + all source summaries) to determine which sources frame the claim differently (`tensionRating.numerator`).

---

## 1. External API: Client → Gateway

### `POST /v1/analyze`

The primary entry point. Accepts text from the Chrome extension, web dashboard, or SDK.

#### Authentication

One of:
- `Authorization: Bearer <clerk-jwt>` — end-user session token
- `X-API-Key: <platform-key>` — platform partner API key (requires `platformUserId` in body)

#### Request Body

```json
{
  "text": "string (required, non-empty)",
  "context": "writer | reader",
  "platformUserId": "string (optional — required when using X-API-Key auth)",
  "model": {
    "provider": "anthropic | openai | google | ollama",
    "modelId": "string"
  },
  "searchProvider": "brave | serpapi | google-cse | bing"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `text` | string | Yes | The text to analyze. Non-empty. |
| `context` | `"writer"` \| `"reader"` | Yes | Writer = pre-publication; reader = post-publication. |
| `platformUserId` | string | Conditional | Required with `X-API-Key` auth. Hashed platform user ID for per-user rate limiting. |
| `model` | object | No | If omitted, gateway uses the user's saved account model preference. |
| `model.provider` | string | Conditional | Required if `model` is present. |
| `model.modelId` | string | Conditional | Required if `model` is present. |
| `searchProvider` | string | No | Override the search provider for this analysis. If omitted, falls back to the user's saved account preference, then the service default (`SEARCH_PROVIDER` env var). |

#### Response `200 OK`

```json
{
  "analysisId": "uuid-v4",
  "registryVersion": "1.0.0",
  "sessionStats": {
    "claimsExtracted": 8,
    "sourcesEvaluated": 34,
    "llmCalls": 9,
    "tokens": { "inputTokens": 9640, "outputTokens": 1580 },
    "model": { "provider": "anthropic", "modelId": "claude-sonnet-4-20250514", "label": "Claude Sonnet 4", "description": "..." },
    "searchProvider": "google-cse"
  },
  "annotations": [
    {
      "claim": {
        "claimText": "string",
        "charOffset": 0,
        "charLength": 42,
        "riskLevel": "high | medium | low",
        "riskReasoning": "string",
        "searchQuery": "string"
      },
      "state": "sourced | limited | unverified",
      "tensionRating": {
        "numerator": 2,
        "denominator": 5,
        "label": "2 of 5 sources frame this differently"
      },
      "sources": [
        {
          "url": "string",
          "title": "string",
          "tier": "tier1 | tier2 | community-verified | tier3",
          "tierLabel": "Institutional | Reputable | Community-edited source | Unrated",
          "summary": "string",
          "accessible": true
        }
      ],
      "commentaryItems": [
        {
          "text": "string",
          "sourceUrl": "string",
          "anchorSourceUrl": "string",
          "label": "unverified-public-discussion"
        }
      ],
      "generatedAt": "2026-04-29T12:00:00Z"
    }
  ]
}
```

**Invariants on the response:**
- `tensionRating` is `null` when no Tier 1 or Tier 2 sources were evaluated (i.e. `denominator` would be 0).
- `tensionRating.label` always uses hedged language: `"X of Y sources frame this differently"`. Never "contradicts", "false", or "debunked".
- `state: "unverified"` does not mean the claim is false — it means no rated sources were found.
- `commentaryItems` items are always labelled `"unverified-public-discussion"`. Never presented as evidence.

#### Error Responses

| Status | `code` | Meaning |
|---|---|---|
| `400` | `invalid_request` | Malformed JSON or missing required fields |
| `401` | `unauthorized` | Missing or invalid auth header |
| `422` | `validation_error` | `text` is empty, `context` is invalid, etc. |
| `422` | `provider_key_missing` | The requested `searchProvider` or `model.provider` has no API key configured in the user's account. Shirajitsu does not supply provider keys. |
| `429` | `rate_limited` | Per-user or global rate limit exceeded |
| `502` | `upstream_error` | One of the internal services is unavailable |
| `500` | `internal_error` | Unexpected server error |

Error body:
```json
{
  "code": "string",
  "message": "string",
  "retryable": true
}
```

---

### `GET /healthz`

#### Response `200 OK`
```json
{ "status": "ok" }
```

---

## 2. Internal: Gateway → Claim Extractor

### `POST /extract`

Extracts discrete, checkable factual claims from a body of text using an LLM.

**Caller:** Gateway
**No auth header** — internal network only (not exposed externally).

#### Request Body

```json
{
  "text": "string (required, non-empty)",
  "model": {
    "provider": "anthropic | openai | google | ollama",
    "modelId": "string"
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `text` | string | Yes | The text to analyze. Forwarded from the gateway. |
| `model` | object | No | If omitted, claim-extractor uses its configured default (`AI_PROVIDER` + `AI_MODEL` env vars). |

#### Response `200 OK`

```json
{
  "claims": [
    {
      "claimText": "string",
      "charOffset": 0,
      "charLength": 42,
      "riskLevel": "high | medium | low",
      "riskReasoning": "string",
      "searchQuery": "string"
    }
  ],
  "usage": {
    "inputTokens": 1240,
    "outputTokens": 380
  }
}
```

**Invariants:**
- `claimText` is never empty.
- `charOffset` ≥ 0; `charLength` > 0.
- `searchQuery` is never empty — every claim must have a usable search string.
- Claims are opinions, framing, or rhetorical assertions — not facts — are excluded by the LLM prompt. The contract does not enforce this; it is enforced by prompt design.

#### Error Responses

| Status | Meaning |
|---|---|
| `400` | Malformed body |
| `422` | `text` is empty |
| `400` | `model.provider` is unrecognised |
| `500` | LLM call failed |

---

### `GET /healthz`

#### Response `200 OK`
```json
{ "status": "ok" }
```

---

## 3. Internal: Gateway → Source Evaluator

### `POST /evaluate`

Evaluates sources for a set of claims. For each claim, source-evaluator calls an external search API (configured via `SEARCH_PROVIDER` + `SEARCH_API_KEY`) using the claim's `searchQuery`, classifies the returned URLs against the source registry, and returns evaluated sources.

**Search parallelization:** source-evaluator fans out one search API call per claim in parallel (Go goroutines). The HTTP response is returned only after all claims have been evaluated. This means latency scales with the slowest single claim search, not with the total number of claims.

**Caller:** Gateway
**No auth header** — internal network only.

#### Request Body

```json
{
  "searchProvider": "brave | serpapi | google-cse | bing",
  "claims": [
    {
      "claimText": "string",
      "charOffset": 0,
      "charLength": 42,
      "riskLevel": "high | medium | low",
      "riskReasoning": "string",
      "searchQuery": "string"
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `searchProvider` | string | No | The provider to use for all claim searches in this request. If omitted, source-evaluator uses its `SEARCH_PROVIDER` env var default. |
| `claims` | array | Yes | The full claim list from claim-extractor. Minimum 1. |

#### Response `200 OK`

```json
{
  "registryVersion": "1.0.0",
  "evaluatedClaims": [
    {
      "claimIndex": 0,
      "sources": [
        {
          "url": "string",
          "title": "string",
          "tier": "tier1 | tier2 | community-verified | tier3",
          "tierLabel": "Institutional | Reputable | Community-edited source | Unrated",
          "summary": "string",
          "accessible": true
        }
      ],
      "commentaryItems": [
        {
          "text": "string",
          "sourceUrl": "string",
          "anchorSourceUrl": "string",
          "label": "unverified-public-discussion"
        }
      ]
    }
  ]
}
```

**Notes:**
- `claimIndex` is the 0-based index into the input `claims` array. Used by gateway to correlate results when forwarding to annotator.
- `evaluatedClaims` has exactly one entry per input claim (same length as input `claims`). A claim with no search results returns an entry with `sources: []`.
- `registryVersion` identifies which snapshot of `source-registry.json` was used. Hot-reloaded by source-evaluator on file change (no restart required).
- `summary` is the raw search snippet / quote returned by the search API. Shown verbatim in the UI. AI summarisation is a future opt-in feature.
- `accessible` determination:
  1. Domain is on the static paywall list → `false`
  2. Domain is not on the list → live HTTP HEAD check → result cached per domain
  3. A background job re-checks all known domains weekly and updates the static list
- `commentaryItems` are classified by domain type: known social/forum domains (reddit.com, twitter.com, etc.) are always commentary. Borderline cases default to `tier3` source, not commentary.

#### Error Responses

| Status | Meaning |
|---|---|
| `400` | Malformed body or empty claims array |
| `502` | Search API unavailable |
| `500` | Internal error |

---

### `GET /healthz`

#### Response `200 OK`
```json
{ "status": "ok" }
```

---

## 4. Internal: Gateway → Annotator

### `POST /annotate`

Assembles final `Annotation` objects from claims and their evaluated sources. For each claim, makes a single LLM call that returns per-source `relevanceScore` and `divergenceScore`. These scores drive both the tension rating and display ordering.

**Failure strategy:** If the LLM call fails for an individual claim, that claim's annotation is returned with `tensionRating: null` and `evaluationFailed: true`. The gateway still returns a 200 with all other annotations intact. The UI shows a retry affordance for failed claims; users re-run them via `POST /v1/evaluate-claim`.

**Caller:** Gateway
**No auth header** — internal network only.

#### Request Body

```json
{
  "analysisId": "uuid-v4",
  "claims": [
    {
      "claimText": "string",
      "charOffset": 0,
      "charLength": 42,
      "riskLevel": "high | medium | low",
      "riskReasoning": "string",
      "searchQuery": "string"
    }
  ],
  "evaluatedClaims": [
    {
      "claimIndex": 0,
      "sources": [
        {
          "url": "string",
          "title": "string",
          "tier": "tier1 | tier2 | community-verified | tier3",
          "tierLabel": "string",
          "summary": "string",
          "accessible": true
        }
      ],
      "commentaryItems": [
        {
          "text": "string",
          "sourceUrl": "string",
          "anchorSourceUrl": "string",
          "label": "unverified-public-discussion"
        }
      ]
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `analysisId` | string | Yes | UUID v4 generated by gateway for this analysis request. Annotator stamps this on each assembled Annotation. |
| `claims` | array | Yes | The full claim list from claim-extractor, in index order. |
| `evaluatedClaims` | array | Yes | The evaluated claims from source-evaluator. `claimIndex` aligns each entry to `claims[claimIndex]`. Must be same length as `claims`. |

#### Response `200 OK`

```json
{
  "annotations": [
    {
      "claim": { "claimText": "string", "charOffset": 0, "charLength": 42, "riskLevel": "high | medium | low", "riskReasoning": "string", "searchQuery": "string" },
      "state": "sourced | limited | unverified",
      "tensionRating": {
        "numerator": 2,
        "denominator": 5,
        "label": "2 of 5 sources frame this differently"
      },
      "sources": [
        {
          "url": "string",
          "title": "string",
          "tier": "tier1 | tier2 | community-verified | tier3",
          "tierLabel": "string",
          "summary": "string (raw search snippet)",
          "accessible": true,
          "relevanceScore": 0.87,
          "divergenceScore": 0.72
        }
      ],
      "commentaryItems": [...],
      "generatedAt": "2026-04-30T12:00:00Z",
      "evaluationFailed": false
    }
  ],
  "usage": {
    "inputTokens": 8400,
    "outputTokens": 1200
  }
}
```

**LLM call per claim:** Annotator sends claim text + all source summaries (quotes) to the LLM in a single call. The LLM returns structured output — one entry per source:
```json
{ "sourceIndex": 0, "relevanceScore": 0.87, "divergenceScore": 0.72 }
```

**Tension score computation (annotator, after LLM call):**
```
tensionScore = Σ(divergenceScore[i] × relevanceScore[i])  for Tier 1/2 sources
             ─────────────────────────────────────────────
                        Σ(relevanceScore[i])
```
Weighted mean: a high-relevance source that diverges pulls the score harder than a peripheral one. Result is always 0.0–1.0.

**Tension label ranges** (for accessibility — shown on hover, never as a verdict):
- 0.00–0.25 → "Sources largely frame this consistently"
- 0.25–0.50 → "Sources show some variation in framing"
- 0.50–0.75 → "Sources show notable framing differences"
- 0.75–1.00 → "Sources show substantial framing differences"

**UI colour mapping:** `tensionRating.score` maps to a blue→red gradient displayed on the claim bubble and inline highlights. 0.0 = blue, 0.5 = purple, 1.0 = red. No binary threshold — the colour IS the signal.

**Invariants:**
- `annotations` has exactly one entry per input claim (same order as `claims`).
- `relevanceScore`: 0.0–1.0 for all sources. Used for display ordering (sources sorted descending by relevance).
- `divergenceScore`: 0.0–1.0 for Tier 1/2 sources only; `null` for community-verified and tier3.
- `tensionRating.score`: weighted mean divergence across all Tier 1/2 sources (0.0–1.0).
- `tensionRating.sourceCount`: count of Tier 1/2 sources the score is based on.
- `tensionRating` is `null` when `sourceCount = 0` or when `evaluationFailed: true`.
- Tension label language is always hedged — never "contradicts", "false", or "verdict".
- `state` computed by `DetermineState(sources)` — sourced if any accessible Tier 1/2; limited if only inaccessible Tier 1/2; unverified if none.
- `evaluationFailed: true` when the LLM call for this claim failed. Other fields populated from source-evaluator results where possible.
- `generatedAt` is set by annotator at assembly time.

#### Error Responses

| Status | Meaning |
|---|---|
| `400` | Malformed body, empty claims, or mismatched claims/evaluatedClaims lengths |
| `500` | Internal error |

---

### `GET /healthz`

#### Response `200 OK`
```json
{ "status": "ok" }
```

---

## 5. External API: Claim Feedback

### `POST /v1/claim-feedback`

Saves user feedback for one or more claims in an analysis. Handles both single-bubble SAVE and the sidebar's Save All button — both use this same endpoint with one or more items in `feedback`.

**Auth:** same as `/v1/analyze`.

#### Request Body

```json
{
  "analysisId": "uuid-v4",
  "feedback": [
    { "claimCharOffset": 142, "markedAsOpinion": true },
    { "claimCharOffset": 287, "markedAsOpinion": false }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `analysisId` | string | Yes | UUID from the original `AnalyzeResponse`. |
| `feedback` | array | Yes | One entry per claim being saved. Minimum 1. |
| `feedback[].claimCharOffset` | number | Yes | `charOffset` of the claim — uniquely identifies it within the analysis. |
| `feedback[].markedAsOpinion` | boolean | Yes | `true` = user marked this as an opinion/rhetorical statement; `false` = un-marked (checkbox unchecked after a prior save). |

#### Response `204 No Content`

No body. The UI updates checkbox state optimistically before the request completes and reconciles on 204.

`analysisId` is a correlation ID only — analyses are not persisted server-side. The feedback is appended to a training log keyed by user ID; no lookup of the original analysis occurs. There is no 404.

#### Error Responses

| Status | `code` | Meaning |
|---|---|---|
| `400` | `invalid_request` | Missing fields or empty `feedback` array |
| `401` | `unauthorized` | Missing or invalid auth |

---

### UI Behaviour: Pre-Save Highlighting and Save All

**Dirty state tracking (client-side):** Each claim bubble independently tracks two states — `savedState` (what was last successfully POSTed) and `pendingState` (current checkbox value). When they differ, the bubble is *dirty*.

**Dirty bubble treatment:**
- The "Mark as opinion" checkbox row gets an amber left border and a muted "unsaved" label
- The per-bubble SAVE button becomes visually active (full colour, not greyed)

**Save All button:**
- Appears as a sticky footer in the annotation sidebar whenever ≥ 1 bubble is dirty
- Label: `Save all (N)` where N is the count of dirty claims
- Clicking it collects all dirty claims into a single `POST /v1/claim-feedback` with the full `feedback` array, then clears dirty state for all of them on 204
- After a successful Save All, the sticky footer disappears

**Optimistic updates:** Both SAVE and Save All update `savedState` immediately on click (before the network response). On error, roll back `pendingState` to `savedState` and show an inline error.

---

## 6. External API: Per-Claim Re-Evaluate

### `POST /v1/evaluate-claim`

Re-evaluates a single claim with a different search provider or model. Used by the claim bubble UI to let users swap settings and refresh a specific claim without re-running the full analysis.

**Auth:** same as `/v1/analyze`.

#### Request Body

```json
{
  "claim": {
    "claimText": "string",
    "charOffset": 0,
    "charLength": 42,
    "riskLevel": "high | medium | low",
    "riskReasoning": "string",
    "searchQuery": "string"
  },
  "searchProvider": "brave | serpapi | google-cse | bing | duckduckgo",
  "model": {
    "provider": "anthropic | openai | google | ollama",
    "modelId": "string"
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `claim` | object | Yes | The claim to re-evaluate (from a prior analysis response). |
| `searchProvider` | string | No | Override the search provider for this re-evaluation. Falls back to user account default. |
| `model` | object | No | Override the LLM used for annotator framing analysis. Falls back to user account default. |

#### Response `200 OK`

Returns a single updated `Annotation` object — same shape as one item in `AnalyzeResponse.annotations`.

```json
{
  "annotation": {
    "claim": { ... },
    "state": "sourced | limited | unverified",
    "tensionRating": { ... },
    "sources": [ ... ],
    "commentaryItems": [ ... ],
    "generatedAt": "2026-04-29T12:00:00Z"
  },
  "registryVersion": "1.0.0",
  "searchProvider": "brave"
}
```

The response echoes back `searchProvider` so the UI can display which provider was used.

#### Error Responses

Same error codes as `/v1/analyze`.

---

## 6. Environment Variables (service-level)

| Service | Env Var | Purpose |
|---|---|---|
| gateway | `CLAIM_EXTRACTOR_URL` | Base URL of claim-extractor (default: `http://claim-extractor:8080`) |
| gateway | `SOURCE_EVALUATOR_URL` | Base URL of source-evaluator (default: `http://source-evaluator:8082`) |
| gateway | `ANNOTATOR_URL` | Base URL of annotator (default: `http://annotator:8083`) |
| gateway | `REDIS_URL` | Redis connection string for rate limiting |
| gateway | `CLERK_SECRET_KEY` | Clerk secret key for JWT verification |
| claim-extractor | `AI_PROVIDER` | Default LLM provider: `anthropic \| openai \| google \| ollama` |
| claim-extractor | `AI_MODEL` | Default model ID (e.g. `claude-sonnet-4-6`) |
| claim-extractor | `AI_API_KEY` | API key for the LLM provider |
| claim-extractor | `AI_BASE_URL` | Base URL override (Ollama or custom endpoint) |
| source-evaluator | `SEARCH_PROVIDER` | Default search provider: `brave \| serpapi \| google-cse \| bing \| duckduckgo` |
| source-evaluator | `SEARCH_API_KEY` | API key for the default search provider |
| source-evaluator | `SEARCH_RESULTS_PER_CLAIM` | Max search results to classify per claim (default: `10`) |
| annotator | `AI_PROVIDER` | LLM provider for framing analysis (same options as claim-extractor) |
| annotator | `AI_MODEL` | Model ID for framing analysis |
| annotator | `AI_API_KEY` | API key for the annotator LLM provider |
| annotator | `AI_BASE_URL` | Base URL override (Ollama or custom endpoint) |

---

## 8. Resolved Decisions

| # | Decision |
|---|---|
| 1 | Default search provider: `google-cse`. User supplies their own API key. |
| 2 | Max claims per request: **20**. Claim-extractor truncates after 20 with no error — excess claims silently dropped. |
| 3 | LLM failure strategy: fail as few analyses as possible. Annotator LLM failure per claim → `evaluationFailed: true`, `tensionRating: null`. Claim-extractor LLM failure → 502 (cannot extract claims at all; nothing to return). |
| 4 | Source summaries: raw search snippet (quote). LLM rates relevance but does not rewrite. AI summarisation is a future opt-in. |
| 5 | Paywall detection: static domain list → live HEAD check if absent → weekly background re-check of all known domains. |
| 6 | CommentaryItem classification: domain-based (known social/forum domains). Borderline → tier3 source. |
| 7 | API key storage: **Clerk user metadata (encrypted)** for v1. Limitations: no key rotation, no audit log, size-limited. Re-evaluate when usage grows. |
| 8 | Tension is a score: annotator LLM returns `divergenceScore: 0.0–1.0` per Tier 1/2 source. `numerator` = count where score ≥ 0.5. Score surfaced per-source for UI display. |
| 9 | Writer vs reader: identical pipeline for v1. UI framing differs (advisory tone for writer, informational for reader). Cross-document tension is a future milestone. |
| 10 | Extension auth: Clerk OAuth popup via `@clerk/chrome-extension`. User never pastes a token. |
| 11 | Source registry: hot-reloaded by source-evaluator on file change (Go `fsnotify`). No restart required. Manual PR to update registry; no automated crawl for v1. |
| 12 | Feedback: learning signal only. `analysisId` is a correlation ID; no server-side persistence of analyses. |

## 9. Remaining Open Items

| # | Question | Blocking |
|---|---|---|
| 1 | ~~`divergenceScore` threshold~~ — resolved: no threshold. Tension is a continuous weighted-mean score (0.0–1.0) displayed as a blue→red gradient. | Resolved. |
| 2 | ~~Commentary domain list~~ — resolved: reddit.com, twitter.com, x.com, facebook.com, threads.net, instagram.com, tiktok.com, quora.com, news.ycombinator.com, linkedin.com, tumblr.com, pinterest.com, youtube.com. Medium/Substack/blogs → tier3, not commentary. | Resolved. |
| 3 | ~~Training pipeline~~ — resolved: phased. v1: append feedback to structured log (BigQuery/Firestore). Near-term: DSPy prompt optimisation against labeled log. Later: SFT at ~1,000+ examples. RLHF deferred indefinitely. | Resolved. |
