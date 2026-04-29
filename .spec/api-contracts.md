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
- `registryVersion` identifies which snapshot of `source-registry.json` was used. Must be returned to the client in `AnalyzeResponse`.
- `accessible: false` means the source is paywalled or otherwise not directly surfaceable to users.
- `summary` must not be empty for `tier1` and `tier2` sources. It may be empty for `community-verified` and `tier3`.
- `commentaryItems` contains unverified public discussion found during search (e.g. Reddit, forums). Always labelled `"unverified-public-discussion"`.

#### Error Responses

| Status | Meaning |
|---|---|
| `400` | Malformed body or empty claims array |
| `502` | Search API unavailable |
| `500` | Internal error |

> **Open — search provider:** The specific search API (Brave Search, SerpAPI, Google Custom Search, etc.) has not yet been selected. This decision affects the `SEARCH_PROVIDER` env var and the search client implementation, but not this contract's shape.

---

### `GET /healthz`

#### Response `200 OK`
```json
{ "status": "ok" }
```

---

## 4. Internal: Gateway → Annotator

### `POST /annotate`

Assembles final `Annotation` objects from claims and their evaluated sources. Computes `AnnotationState` and `TensionRating` for each claim.

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
      "sources": [...],
      "commentaryItems": [...],
      "generatedAt": "2026-04-29T12:00:00Z"
    }
  ],
  "usage": {
    "inputTokens": 8400,
    "outputTokens": 1200
  }
}
```

**Invariants:**
- `annotations` has exactly one entry per input claim (same order as `claims`).
- `tensionRating` is `null` when no Tier 1 or Tier 2 sources are present for a claim.
- `tensionRating.denominator` = count of sources where `tier` is `tier1` or `tier2`.
- `tensionRating.numerator` = count of those sources that frame the claim differently, determined by a single LLM call per claim: annotator sends the claim text + all Tier 1/2 source summaries to an LLM and asks it to identify which sources frame the claim differently. The LLM returns a boolean per source. Annotator sums the `true` values.
- `tensionRating.label` must use the form `"X of Y sources frame this differently"`.
- `state` is computed by `DetermineState(sources)` — sourced if any accessible Tier 1/2 source; limited if only inaccessible Tier 1/2; unverified if none.
- `generatedAt` is the ISO timestamp set by annotator at assembly time.

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

## 5. External API: Per-Claim Re-Evaluate

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

## 7. Open Decisions

| # | Question | Blocking |
|---|---|---|
| 1 | ~~Which search provider to default to?~~ Default is `google-cse`. User must supply their own Google CSE API key. | Resolved 2026-04-29 |
| 2 | Max claims per request — is there a hard cap? | claim-extractor implementation |
| 3 | LLM failure strategy in claim-extractor — retry with fallback provider or fail-fast? | claim-extractor implementation |
| 4 | What additional controls belong in the claim bubble beyond model + search provider? | claim bubble UI implementation |
