# Shirajitsu

## Project Overview

Shirajitsu is an AI-based news fact-checking platform with humans in the loop. It extracts discrete factual claims from text using an LLM, evaluates each claim against a tiered source registry, and returns probabilistic "tension ratings" — hedged assessments of how many rated sources frame a claim differently. It is delivered as a Chrome extension, a web dashboard, and a TypeScript SDK for third-party integrations.

## Tech Stack

### Backend (`services/`)

- **Runtime:** Go 1.22
- **Router:** [go-chi/chi v5](https://github.com/go-chi/chi)
- **Auth:** Clerk SDK for Go (`clerk/clerk-sdk-go/v2`) — user JWTs and platform API keys
- **Rate limiting:** Redis (`redis/go-redis/v9`) — per-user, per-platform, global circuit breaker
- **LLM dispatch:** Provider-agnostic interface; Anthropic, OpenAI, Google, Ollama supported
- **Logging:** `log/slog` with JSON handler
- **Services:**
  - `services/gateway` — auth, rate limiting, request routing (port 8080)
  - `services/claim-extractor` — LLM-based claim extraction (port 8081)
  - `services/source-evaluator` — source registry classification (port 8082)
  - `services/annotator` — tension rating assembly (port 8083)

### Frontend (`ui/`)

- **Framework:** React 18 + TypeScript
- **Bundler:** Vite 5
- **Extension:** `ui/extension` — Chrome extension, Manifest V3, multi-entrypoint (background, content, popup, sidepanel)
- **Web app:** `ui/web` — SPA, React Router v6, Firebase Hosting
- **Shared components:** `ui/components` — `@shirajitsu/react`
- **Auth (extension/web):** `@clerk/chrome-extension`, `@clerk/clerk-react`
- **Testing:** Vitest + Testing Library

### SDK (`sdk/`)

- `sdk/core` — `@shirajitsu/core`: headless TypeScript client, zero UI dependency
- `shared/types` — `@shirajitsu/types`: shared TypeScript types (Annotation, Claim, Source, API contracts)

### Infrastructure

- **Monorepo:** pnpm workspaces + Turborepo
- **Containers:** Docker (per-service Dockerfiles), Docker Compose for local dev
- **Orchestration:** Kubernetes with Helm charts (`infra/k8s/helm/`) on GKE
- **Web hosting:** Firebase Hosting (web app)
- **CI/CD:** [to be configured]

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all dev servers (watch mode)
pnpm dev

# Type-check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Clean all build outputs
pnpm clean

# Local development stack (all services + Redis)
docker-compose -f infra/docker-compose.yml up

# Run tests for a specific service (Go)
cd services/<name> && go test ./...

# Run tests for a specific package (TS)
cd ui/extension && pnpm test
```

## Ports

| Service | Local port |
|---|---|
| gateway | 8080 |
| claim-extractor | 8081 |
| source-evaluator | 8082 |
| annotator | 8083 |
| Redis | 6379 |

## Architecture Conventions

### Ubiquitous Language

- Use the exact canonical terms from `.spec/glossary.md` in all code, API field names, comments, log messages, and variable names. No synonyms, abbreviations, or informal variations.
- When introducing a new concept, add it to `.spec/glossary.md` before using it in code. Do not invent terms mid-implementation.
- PascalCase for type names, camelCase for field names — follow the canonical identifier listed in the glossary entry, not convention alone.

### Bounded Context Boundaries

- Each bounded context owns its own domain model. Do not reach into another context's aggregate — only interact via published contracts (API calls, message payloads).
- ExtensionAuth is owned entirely by the Chrome extension (`ui/extension`). It does not share code with `ui/web` authentication, even though both use Clerk.
- The gateway service is the only service that calls the Clerk SDK server-side. Internal services (claim-extractor, source-evaluator, annotator) receive no auth headers and must not be exposed publicly.

### Backend Rules (Go services)

- All domain types live in a `domain/` package within each service. Handlers read from and write to domain types — they do not construct HTTP responses directly from raw structs.
- Every handler validates its input against the domain type's `Validate()` method before processing. Return `400` for malformed requests, `422` for semantically invalid inputs.
- Use `log/slog` with a JSON handler for all structured logging. No `fmt.Println` or `log.Printf` in handlers.
- LLM calls must go through the provider-agnostic interface in the service — never call a provider SDK directly from a handler.
- `tensionRating` language is always hedged: "X of Y sources frame this differently." Never use words like "contradicts," "false," or "debunked" in any response field or log message.
- `AnnotationState` is computed by `DetermineState(sources)` — never inferred from claim text.

### Extension Rules (Chrome MV3)

- The popup, sidepanel, background, and content script are separate JavaScript contexts with no shared memory. All communication between them uses `chrome.runtime.sendMessage` or `chrome.storage`.
- Fire-and-forget `chrome.tabs.sendMessage` calls must always supply a callback that reads `chrome.runtime.lastError` to suppress uncaught runtime errors (use the `safeTabMessage` pattern from DEC-010).
- Fire-and-forget `chrome.runtime.sendMessage` calls must always supply a callback that reads `chrome.runtime.lastError` (use the `safeBroadcast` pattern).
- State that must survive across extension page loads (e.g., analysis result, analysis status) must be persisted to `chrome.storage.session` before broadcasting it via `chrome.runtime.sendMessage`.
- A ClerkJwt MUST NOT be read from `chrome.storage.sync`. Obtain it from the live Clerk SDK instance via `getToken()`.
- The `userToken` key in `chrome.storage.sync` is retired — do not read or write it.
- `VITE_CLERK_PUBLISHABLE_KEY` must be set at build time. The Clerk SDK must not initialise with an undefined key.
- The popup renders exactly one of: SignInPrompt (no active ClerkSession) or AnalyseView (active ClerkSession). Never both. Never neither.
- The background service worker initialises its own Clerk instance for token acquisition (DEC-013). It does not receive the token via message from the popup.

### Frontend Rules (React / TypeScript)

- Use the canonical types from `@shirajitsu/types` for all API request and response shapes. Do not redefine inline types for data structures that exist in the shared package.
- All `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage` calls in popup code must handle `chrome.runtime.lastError`. No silent failures.
- Extension entrypoints (popup, sidepanel) must not import from each other. Shared logic goes in `ui/extension/src/` helper modules.
- Mock Clerk providers in Vitest tests — never call real Clerk APIs in tests.

### Testing

- Every new handler, domain function, or React component must have unit tests written before implementation (TDD).
- Go services: use `testing` package only — no third-party test frameworks.
- TypeScript packages: use Vitest + Testing Library.
- Tests must not make real network calls. Mock all external dependencies (LLM clients, search APIs, Clerk SDK).
- Passing `pnpm typecheck` and `pnpm test` in the affected package is required before marking any issue complete.

---

## Directory Structure

```
shirajitsu/
├── services/                        # Go microservices
│   ├── gateway/                     # Auth, rate limiting, request routing (port 8080)
│   │   ├── domain/                  # Domain types: AnalyzeRequest, AnalyzeResponse
│   │   └── handler/                 # HTTP handlers: /v1/analyze, /v1/claim-feedback, /healthz
│   ├── claim-extractor/             # LLM-based claim extraction (port 8081)
│   │   ├── domain/                  # Domain types: Claim, RiskLevel, SearchQuery
│   │   └── handler/                 # HTTP handlers: /extract, /healthz
│   ├── source-evaluator/            # Source registry classification (port 8082)
│   │   ├── domain/                  # Domain types: Source, Tier, EvaluatedClaim
│   │   ├── registry/                # source-registry.json (hot-reloaded via fsnotify)
│   │   └── handler/                 # HTTP handlers: /evaluate, /healthz
│   └── annotator/                   # Tension rating assembly (port 8083)
│       ├── domain/                  # Domain types: Annotation, AnnotationState, TensionRating
│       └── handler/                 # HTTP handlers: /annotate, /healthz
│
├── ui/
│   ├── extension/                   # Chrome extension (Manifest V3)
│   │   ├── public/
│   │   │   └── manifest.json        # MV3 manifest
│   │   └── src/
│   │       ├── background/
│   │       │   ├── index.ts         # Service worker: message listener + Clerk initialisation
│   │       │   └── handler.ts       # handleAnalyze: obtains ClerkJwt, calls POST /v1/analyze
│   │       ├── content/
│   │       │   └── index.ts         # Content script: selection capture, annotation highlights
│   │       ├── popup/
│   │       │   ├── index.html       # Popup entrypoint HTML
│   │       │   ├── main.tsx         # ClerkProvider wrapper + React root
│   │       │   └── Popup.tsx        # SignInPrompt | AnalyseView (conditional on ClerkSession)
│   │       ├── sidepanel/
│   │       │   ├── index.html       # Sidepanel entrypoint HTML
│   │       │   └── main.tsx         # Sidepanel React root
│   │       └── sidebar/
│   │           └── Sidebar.tsx      # Annotation display sidebar
│   │
│   ├── web/                         # SPA web dashboard (React Router v6, Firebase Hosting)
│   └── components/                  # @shirajitsu/react — shared UI components
│
├── sdk/
│   └── core/                        # @shirajitsu/core — headless TypeScript client
│
├── shared/
│   └── types/                       # @shirajitsu/types — shared TypeScript types
│
├── infra/
│   ├── docker-compose.yml           # Local dev stack (all services + Redis)
│   └── k8s/helm/                    # Kubernetes Helm charts (GKE)
│
└── .spec/
    ├── glossary.md                  # Ubiquitous Language Glossary — authoritative naming
    ├── api-contracts.md             # All HTTP API contracts
    ├── bounded-contexts/            # One file per bounded context
    ├── aggregates/                  # One file per aggregate
    └── issues/                      # Implementation issues (ISS-NNN-slug.md)
```
