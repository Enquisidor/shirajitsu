# Aggregate: Source

**Bounded context:** SourceEvaluation
**Purpose:** Represents an evaluated web source for a given claim — classified by tier, marked as accessible or not, and carrying a summary — used downstream to compute AnnotationState and TensionRating.

---

### Aggregate Root

**Entity name:** Source
**Identity type:** [REQUIRED — URL is the natural key within an analysis request; globally stable identity TBD by Architect]
**Description:** A Source is a web resource that has been fetched or classified against the source registry for a given claim's search query. It carries its registry tier, whether the full content is accessible to users, and a brief summary of how it relates to the claim.

**Invariants enforced by the root:**
- `url` must be a valid, non-empty URL
- `tier` must be one of: `tier1`, `tier2`, `community-verified`, `tier3`
- `accessible` must be explicitly set — not defaulted
- `summary` must not be empty for tier1 and tier2 sources

---

### Child Entities

*(none — Source is a leaf aggregate)*

---

### Value Objects

| Value Object | Attributes | Validation Rules | Notes |
|---|---|---|---|
| Tier | `tier1 \| tier2 \| community-verified \| tier3` | Must match registry enum | `GeneratesRating` = true for tier1 and tier2 only |

---

### Domain Events

| Event Name (past tense) | Trigger Condition | Key Payload Fields | Scope |
|---|---|---|---|
| [SourceEvaluated] | When a source has been classified and its accessibility determined | url, tier, accessible, summary | [Internal \| Published — to be decided by Architect] |

---

### Repository Interface

- `findByUrl(url: string)` → `Source | null`
- `save(source: Source)` → `void`
- [Additional finders to be defined by Architect]

---

### Lifecycle

*(Source classification is currently stateless per-request — no lifecycle transitions detected)*

---

### Persistence Notes

- **Storage model:** [To be decided — source-evaluator appears stateless; the registry is a static JSON file]
- **Registry:** `registry/source-registry.json` is the authoritative source for tier classification; versioned by the `version` field in the JSON
- **PII:** No

---

### Open Questions

- [ ] Does source-evaluator perform live web fetches, or does it classify based on domain matching alone? — Assigned to: Architect
- [ ] Are Source evaluations cached between requests for the same URL? — Assigned to: Architect
- [ ] Who calls the web search API and passes URLs to this context? — Assigned to: Architect
