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
<!-- To be completed by the Architect agent after spec phase -->

## Directory Structure
<!-- To be completed by the Architect agent after spec phase -->
