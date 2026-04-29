# Bounded Context: Annotation

**Purpose:** Responsible for assembling the final annotation for each extracted claim by combining evaluated sources into an `AnnotationState` and a `TensionRating`, producing the canonical `Annotation` objects returned to the client.

**Owner:** Architect owns all contexts.

---

### Responsibility Boundary

**This context owns:**
- Computing `AnnotationState` (sourced / limited / unverified) from a set of evaluated `Source` objects
- Computing `TensionRating` (numerator / denominator / label) from Tier 1 and Tier 2 sources
- Assembling the final `Annotation` domain object (claim + state + tension + sources + commentary)
- Ensuring tension language is always hedged and probabilistic — never a verdict

**This context explicitly does not own:**
- Extracting claims — belongs to ClaimExtraction
- Source tier classification — belongs to SourceEvaluation
- Auth, rate limiting — belongs to the gateway (infrastructure)

---

### Core Model

**Aggregate roots:**
- [Annotation](../aggregates/Annotation.md): the assembled result for a single claim — state, tension rating, sources, and commentary items

**Value objects (context-level):**
- `AnnotationState`: sourced / limited / unverified — immutable result of applying source evaluation rules
- `TensionRating`: numerator + denominator + hedged label string — immutable per annotation
- `CommentaryItem`: a piece of unverified public discussion, labelled as such — immutable

**Domain events produced:**
- [REQUIRED if this context publishes events — to be completed by Architect]

**Domain events consumed:**
- [IF APPLICABLE — to be completed by Architect]

---

### Context Map

| Adjacent Context | Relationship Type | Integration Mechanism | Notes |
|---|---|---|---|
| SourceEvaluation | Customer–Supplier | Sync HTTP | Annotation receives Source objects from SourceEvaluation |
| ClaimExtraction | Customer–Supplier | Sync HTTP | Annotation receives Claim objects from ClaimExtraction |

---

### Ubiquitous Language (context-specific terms)

| Term | Definition within this context | Anti-patterns (do not use) |
|---|---|---|
| AnnotationState | The confidence level of an annotation given available sources: `sourced` (accessible tier1/2 found), `limited` (inaccessible tier1/2 only), `unverified` (no tier1/2 sources). | "status", "result", "verdict", "truth level" |
| TensionRating | A probabilistic measure of how many rated sources frame a claim differently. Always expressed as a fraction with hedged language. Never a truth verdict. | "contradiction score", "fact-check rating", "accuracy" |
| Sourced | AnnotationState: at least one accessible Tier 1 or Tier 2 source was found. | "verified", "confirmed", "true" |
| Limited | AnnotationState: only inaccessible (paywalled/restricted) Tier 1 or Tier 2 sources were found. | "partial", "soft-verified" |
| Unverified | AnnotationState: no Tier 1 or Tier 2 sources found. Does not mean the claim is false. | "false", "unsupported", "debunked" |
| CommentaryItem | An item of unverified public discussion (e.g. forum thread, social post) surfaced as context, always labelled `unverified-public-discussion`. | "source", "reference" |

---

### Open Questions

- [x] Are CommentaryItems fetched by the annotator directly, or passed in from source-evaluator? — source-evaluator discovers them during search and passes them to annotator. Annotator receives them passively and assembles them into the Annotation. — Resolved 2026-04-29
- [ ] Is writer-context tension computation (cross-document) handled in this context or a future one? — Assigned to: Architect
- [ ] How is `tensionRating.numerator` determined? Does annotator call an LLM to compare each source against the claim, or use a simpler signal? — Assigned to: Architect
