# Bounded Context: SourceEvaluation

**Purpose:** Responsible for evaluating web sources against the Shirajitsu source registry, classifying each source by tier, and determining whether sources are accessible, in order to produce a set of evaluated `Source` objects for each claim.

**Owner:** Architect owns all contexts.

---

### Responsibility Boundary

**This context owns:**
- Calling an external search API (configured via `SEARCH_PROVIDER` + `SEARCH_API_KEY`) with each claim's `searchQuery` to discover source URLs — one parallel search per claim
- Classifying returned URLs against the source registry tiers (Institutional / Reputable / CommunityVerified / Unrated)
- Determining source accessibility (paywalled, restricted, or open)
- Maintaining and versioning the source registry (`source-registry.json`)
- Producing `Source` domain objects with tier, summary, and accessibility information
- Surfacing `CommentaryItem` objects (unverified public discussion) found during search

**This context explicitly does not own:**
- Extracting claims from text — belongs to ClaimExtraction
- Computing `TensionRating` or `AnnotationState` from evaluated sources — belongs to Annotation

---

### Core Model

**Aggregate roots:**
- [Source](../aggregates/Source.md): an evaluated web source for a given claim, classified by tier with accessibility status

**Value objects (context-level):**
- `Tier`: tier1 (Institutional) / tier2 (Reputable) / community-verified / tier3 (Unrated) — immutable classification derived from the registry
- `RegistryVersion`: semantic version string identifying which registry snapshot was used — immutable per analysis

**Domain events produced:**
- [REQUIRED if this context publishes events — to be completed by Architect]

**Domain events consumed:**
- [IF APPLICABLE — to be completed by Architect]

---

### Context Map

| Adjacent Context | Relationship Type | Integration Mechanism | Notes |
|---|---|---|---|
| ClaimExtraction | Customer–Supplier | Sync HTTP | Receives claim + searchQuery; returns evaluated Source list |
| Annotation | Customer–Supplier | Sync HTTP | Annotation is downstream consumer of Source objects |

---

### Ubiquitous Language (context-specific terms)

| Term | Definition within this context | Anti-patterns (do not use) |
|---|---|---|
| Tier | A registry classification of a source's reliability. tier1 = Institutional; tier2 = Reputable; community-verified = crowd-sourced editing; tier3 = Unrated. | "rank", "score", "credibility level" |
| GeneratesRating | A property of a tier: true if the tier contributes to a TensionRating (tier1 and tier2 only). | "countable", "included" |
| Accessible | Whether the source URL can be surfaced directly to the user (false = paywalled or restricted). | "available", "open", "reachable" |
| RegistryVersion | The version of `source-registry.json` used for this evaluation. Returned with every response for traceability. | "version", "snapshot" |

---

### Open Questions

- [x] Who performs the web search — source-evaluator calls a search API (option A). The goal is to enhance the original article using external sources not mentioned in it. Parallel goroutines per claim. — Resolved 2026-04-29
- [x] Is the annotator a separate service, or does source-evaluator call annotator directly? — Gateway orchestrates; services do not call each other. — Resolved 2026-04-29
- [ ] How is the source registry updated? Manual PR, automated crawl, or both? — Assigned to: Architect
- [ ] Which search provider to use? (Brave Search, SerpAPI, Google CSE, etc.) — Assigned to: Architect
