# Completion Artifact — Backend Engineer

**Issue ID:** backend-task3-gateway
**Issue title:** Implement full request pipeline in the gateway service
**Agent:** Backend Engineer
**Timestamp:** 2026-05-06T00:00:00Z

---

## Files created or modified

| File | Change |
|---|---|
| `services/gateway/internal/domain/request.go` | Modified — added `SearchProvider string` field to `AnalyzeRequest` |
| `services/gateway/internal/domain/response.go` | Created — `AnalyzeResponse`, `SessionStats`, `FailedClaim`, `Annotation`, `ClaimSummary`, `TensionRating`, `SourceResult` |
| `services/gateway/internal/pipeline/pipeline.go` | Created — `Pipeline` struct, `New()`, `Run()`, three-service HTTP client, `post()` helper |
| `services/gateway/internal/pipeline/pipeline_test.go` | Created — 5 tests using httptest.NewServer mocks |
| `services/gateway/internal/handlers/analyze.go` | Rewritten — pipeline-wired handler, validation, error shape |
| `services/gateway/internal/handlers/analyze_test.go` | Created — 5 handler tests |
| `services/gateway/internal/auth/middleware.go` | Modified — Clerk JWT verification replacing TODO stub |
| `services/gateway/cmd/server/main.go` | Modified — reads downstream URLs from env, constructs Pipeline, passes to handler |
| `services/gateway/go.mod` | Modified — alphabetical reorder of require block |

---

## Implementation summary

The gateway now orchestrates a three-step pipeline: POST /extract on claim-extractor, POST /evaluate on source-evaluator, then POST /annotate on annotator. The pipeline assembles the annotator's response into an `AnalyzeResponse` with `analysisId` (UnixNano string), `registryVersion` from source-evaluator (fallback "1.0.0"), `sessionStats` (TotalClaims, SuccessfulClaims, FailedClaims, TotalTokens as sum of inputTokens+outputTokens, TotalSources as sum of sources across evaluatedClaims), `failedClaims` (claims where `evaluationFailed: true` in annotator response), and `annotations` (all non-failed annotated claims). The analyze handler validates text (400 if missing) and context (422 if invalid), defaults context to "reader" when omitted, calls the pipeline, and returns 502 with `{"error": "pipeline error", "detail": "..."}` on failure. The Clerk auth middleware now calls `jwt.Verify()` from `clerk-sdk-go/v2` and skips verification when `CLERK_SECRET_KEY` is unset (local dev).

---

## Deviations from spec

| Deviation | Spec behavior | Implemented behavior | Reference |
|---|---|---|---|
| `analysisId` format | Task suggested uuid or UnixNano | UnixNano string chosen | DEC-002 |
| `context` field | Not specified as required or optional | Defaults to "reader" when omitted; explicit invalid values rejected with 422 | DEC-003 |
| Pipeline request/response types | Task prompt described abstract shapes | Actual shapes from reading each service's handler code | DEC-004 |
| `SearchProvider` in domain | Not in existing `AnalyzeRequest` | Added `SearchProvider string` field | DEC-005 |

---

## New dependencies added

| Library | Version | Purpose |
|---|---|---|
| `github.com/clerk/clerk-sdk-go/v2` | v2.0.0 (pre-existing in go.mod) | Clerk JWT verification in auth middleware |

Note: No new dependencies were added beyond what was already declared in go.mod. The clerk SDK was already listed but not downloaded. `go mod tidy` will download it and generate go.sum.

---

## Test suite result

**Status: CANNOT BE RUN**

The `github.com/clerk/clerk-sdk-go/v2` package is not in the local module cache and has no go.sum entry. `go mod tidy` must be run with network access before `go build ./...` and `go test ./...` can execute.

**Command to run after go mod tidy:**
```
cd services/gateway && go mod tidy && go build ./... && go test ./...
```

**Expected outcome after go mod tidy:**
- `go mod tidy`: downloads clerk SDK and transitive deps, generates go.sum
- `go build ./...`: passes (all imports resolved)
- `go test ./...`: ~10 tests across 4 packages (domain, pipeline, handlers, ratelimit), all pass

**Known risk:** The Clerk SDK v2.0.0 `jwt.VerifyParams.Token` field name and `claims.Subject` field name are assumed based on public documentation. If the actual API differs, `auth/middleware.go` will fail to compile and must be corrected by reading the downloaded SDK source.

---

Status: AWAITING TECH LEAD REVIEW — go mod tidy with network access required before phase-2 verification can proceed. All code is written; the sole blocker is the clerk SDK download.
