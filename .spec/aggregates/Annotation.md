# Aggregate: Annotation

**Bounded context:** Annotation
**Purpose:** Represents the assembled result for a single extracted claim — combining AnnotationState, TensionRating, evaluated sources, and commentary items into the canonical output returned to the client.

---

### Aggregate Root

**Entity name:** Annotation
**Identity type:** [REQUIRED — UUID v4 generated at assembly time | composite key based on analysisId + claimOffset — to be decided by Architect]
**Description:** An Annotation is the complete fact-check result for one Claim. It is assembled by combining a Claim with its evaluated Sources. It is the primary output of the Shirajitsu analysis pipeline and the object rendered by the UI (extension sidebar, inline highlights, web dashboard).

**Invariants enforced by the root:**
- `claim` must be a valid, non-empty Claim
- `state` must be one of: `sourced`, `limited`, `unverified`
- `tensionRating` must be `null` if and only if no Tier 1 or Tier 2 sources were evaluated
- `generatedAt` must be set to the ISO timestamp of assembly — immutable after creation
- TensionRating language must always be hedged: "X of Y sources frame this differently" — never a verdict
- `state = unverified` must never be presented to the user as "false" or "debunked"

---

### Child Entities

*(none — Annotation is assembled from value objects and does not have mutable child entities)*

---

### Value Objects

| Value Object | Attributes | Validation Rules | Notes |
|---|---|---|---|
| AnnotationState | `sourced \| limited \| unverified` | Must be computed from sources via `DetermineState` | Never inferred from claim text alone |
| TensionRating | `numerator: int, denominator: int, label: string` | denominator = count of GeneratesRating sources; numerator ≤ denominator; label must use hedged language | null when denominator = 0 |
| CommentaryItem | `text, sourceUrl, anchorSourceUrl, label` | label must be `unverified-public-discussion` | Surfaced as context only, never as evidence |

---

### Domain Events

| Event Name (past tense) | Trigger Condition | Key Payload Fields | Scope |
|---|---|---|---|
| [AnnotationAssembled] | When an Annotation is fully assembled and ready for client delivery | annotationId, claimText, state, tensionRating, generatedAt | [Internal \| Published — to be decided by Architect] |

---

### Repository Interface

- `findById(id)` → `Annotation | null`
- `save(annotation: Annotation)` → `void`
- `findByAnalysisId(analysisId: string)` → `Annotation[]` — returns all annotations for a given analysis request
- [Additional finders to be defined by Architect]

---

### Lifecycle

**States:** Assembled (terminal — Annotations are immutable once created)
**Transitions:** None — Annotations are write-once
**Terminal states:** Assembled
**Invalid transitions:** An assembled Annotation must not be mutated

---

### Persistence Notes

- **Storage model:** [To be decided — currently appears stateless per-request]
- **Soft delete:** No — Annotations are immutable historical records if persisted
- **PII:** Potentially — if the claim text contains PII from the user's submitted document, the Annotation inherits it. Retention policy to be defined.

---

### Open Questions

- [ ] Are Annotations persisted for analytics, audit, or replay? If so, for how long? — Assigned to: Architect
- [ ] Does the `analysisId` exist as a domain concept, or is it only a response envelope field? — Assigned to: Architect
- [ ] How is the writer-context cross-document tension feature (comparing annotations across multiple submissions) modelled? — Assigned to: Architect
