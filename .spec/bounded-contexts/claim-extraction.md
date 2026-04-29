# Bounded Context: ClaimExtraction

**Purpose:** Responsible for extracting discrete, checkable factual assertions from a body of text using an LLM, and assigning each claim a risk level and a search query optimised for verification.

**Owner:** Architect owns all contexts.

---

### Responsibility Boundary

**This context owns:**
- Determining which statements in a body of text are discrete, checkable factual assertions (vs. opinions, framing, or rhetoric)
- Assigning a `RiskLevel` (high / medium / low) and a `riskReasoning` to each claim
- Generating a `searchQuery` optimised for downstream source lookup
- Selecting and invoking the appropriate LLM provider based on the request's model selection
- Parsing and validating LLM output into `Claim` domain objects

**This context explicitly does not own:**
- Source lookup or evaluation — belongs to SourceEvaluation
- Producing `TensionRating` or `AnnotationState` — belongs to Annotation
- Auth, rate limiting, or request routing — belongs to the gateway (infrastructure)

---

### Core Model

**Aggregate roots:**
- [Claim](../aggregates/Claim.md): a single discrete factual assertion extracted from text, with risk classification and a search query

**Value objects (context-level):**
- `RiskLevel`: high / medium / low — immutable classification of how likely a claim is to be contested or misleading
- `AIModel`: provider + modelId pair representing the LLM selected for extraction — immutable per request

**Domain events produced:**
- [REQUIRED if this context publishes events — to be completed by Architect]

**Domain events consumed:**
- [IF APPLICABLE — to be completed by Architect]

---

### Context Map

| Adjacent Context | Relationship Type | Integration Mechanism | Notes |
|---|---|---|---|
| SourceEvaluation | Customer–Supplier | Sync HTTP — ClaimExtraction produces `Claim` objects; SourceEvaluation consumes them | ClaimExtraction is upstream supplier |
| Annotation | Customer–Supplier | Sync HTTP | Annotation consumes extracted claims |

---

### Ubiquitous Language (context-specific terms)

| Term | Definition within this context | Anti-patterns (do not use) |
|---|---|---|
| Claim | A discrete, checkable factual assertion extracted from text. Never an opinion, framing, or rhetorical assertion. | "statement", "fact", "assertion" (too broad) |
| RiskLevel | A probabilistic classification of how likely a claim is to be contested or verifiably incorrect. Not a verdict. | "accuracy", "truthfulness", "score" |
| SearchQuery | A web search string optimised for source lookup, derived from the claim text. Not the claim text itself. | "query", "search term" |
| Context (writer/reader) | Whether the analysis is from a writer's perspective (pre-publication, cross-document tension) or a reader's perspective (post-publication). | "mode", "role", "type" |

---

### Open Questions

- [ ] Should claim extraction be retried with a different provider on LLM failure, or fail fast? — Assigned to: Architect
- [ ] What is the maximum number of claims extracted per request? Is there a cap? — Assigned to: Architect
