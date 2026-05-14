# Gateway Pipeline — Implementation Handoff

**Phase completed:** backend-task3-gateway
**Timestamp:** 2026-05-06T00:00:00Z
**Agent:** Backend Engineer

---

## Files produced

| Path | Change | Description |
|---|---|---|
| `services/gateway/internal/domain/request.go` | Modified | Added `SearchProvider string` field to `AnalyzeRequest` |
| `services/gateway/internal/domain/response.go` | Created | `AnalyzeResponse`, `SessionStats`, `FailedClaim`, `Annotation`, `ClaimSummary`, `TensionRating`, `SourceResult` domain types |
| `services/gateway/internal/pipeline/pipeline.go` | Created | `Pipeline` struct with `New()` and `Run()` methods; all downstream HTTP client types; `post()` helper |
| `services/gateway/internal/pipeline/pipeline_test.go` | Created | 5 tests: happy path, claim-extractor failure, source-evaluator failure, annotator partial failure, registry version fallback |
| `services/gateway/internal/handlers/analyze.go` | Rewritten | Accepts `*pipeline.Pipeline` argument; validates text + context; returns `{"error","detail"}` on error; 200 with `AnalyzeResponse` on success |
| `services/gateway/internal/handlers/analyze_test.go` | Created | 5 tests: missing text, invalid body, pipeline success, pipeline error, invalid context |
| `services/gateway/internal/auth/middleware.go` | Modified | Replaced JWT TODO stub with `jwt.Verify()` from `clerk-sdk-go/v2`; graceful skip when `CLERK_SECRET_KEY` is empty |
| `services/gateway/cmd/server/main.go` | Modified | Reads `CLAIM_EXTRACTOR_URL`, `SOURCE_EVALUATOR_URL`, `ANNOTATOR_URL` env vars; constructs `pipeline.New()`; passes it to `handlers.Analyze()` |
| `services/gateway/go.mod` | Modified | Reordered `require` block alphabetically |

---

## go mod tidy / build / test results

**BLOCKED:** The `github.com/clerk/clerk-sdk-go/v2` package is declared in `go.mod` but is not present in the local Go module cache and has no `go.sum` entry. `go mod tidy` must be run with network access to resolve this dependency before `go build` and `go test` can succeed.

**Required manual steps (in `services/gateway/`):**
```bash
go mod tidy        # downloads clerk-sdk-go/v2 and all transitive deps; generates go.sum
go build ./...     # must pass
go test ./...      # must pass (expected: ~10 tests across pipeline, handlers, domain, ratelimit packages)
```

All other dependencies (`chi`, `go-redis`) are already in the module cache.

---

## Key decisions

| Decision | Rationale | Reference |
|---|---|---|
| UnixNano for `analysisId` instead of `github.com/google/uuid` | Avoids adding a dependency; sufficient as a session correlation identifier | DEC-002 |
| Default `context` to `"reader"` when omitted | Task spec only requires text validation; backward-compatible with existing clients | DEC-003 |
| Used actual service API shapes (read from handler code) rather than task prompt's abstract shapes | Abstract shapes in task prompt do not match actual implementations; using them would fail at runtime | DEC-004 |
| Added `SearchProvider` to `domain.AnalyzeRequest` | Idiomatic Go: keep all request fields in domain object; threads `searchProvider` cleanly to source-evaluator | DEC-005 |

---

## Assumptions made that downstream agents or reviewers need to know

1. **Claim order alignment:** Both the source-evaluator and annotator preserve claim ordering (index-aligned with the input `claims` slice). Verified by reading each handler's implementation. The pipeline relies on this alignment when building the annotator request.

2. **Annotator partial failure detection:** Claims with `evaluationFailed: true` in the annotator response are moved to `failedClaims` in the gateway response. The original claim data is taken from the parallel `claims` slice by index for fidelity.

3. **Clerk SDK v2 API assumptions:** The middleware uses `jwt.Verify(ctx, &jwt.VerifyParams{Token: token})` and `claims.Subject` as the user ID. These are based on the public clerk-sdk-go v2 documentation. If the v2.0.0 release has a different API, the auth middleware will fail to compile.

4. **HTTP client pool:** The `Pipeline` uses `&http.Client{Timeout: 120s}` which uses Go's default `http.DefaultTransport` under the hood. The default transport maintains a connection pool. This is appropriate for a gateway service; a custom transport with explicit `MaxIdleConnsPerHost` could be configured if performance tuning is needed later.

---

## Open questions or blockers

1. **BLOCKING — Clerk SDK download required:** `go mod tidy` must be run with internet access before `go build ./...` and `go test ./...` will succeed. The Go binary must be in PATH.

2. **Platform API key validation:** The `X-API-Key` path in `auth/middleware.go` still contains `// TODO: validate key against database`. This is pre-existing and out of scope for this task, but should be tracked.

3. **Clerk `jwt.Verify` API surface:** The actual clerk-sdk-go v2.0.0 API should be confirmed after `go mod tidy` downloads it. If `jwt.VerifyParams` does not have a `Token` field, or if `claims.Subject` is not the user ID field, the auth middleware code must be corrected.

Status: READY FOR PHASE-2 VERIFICATION (pending `go mod tidy` + `go build` + `go test` gate steps above)
