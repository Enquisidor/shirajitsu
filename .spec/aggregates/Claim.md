# Aggregate: Claim

**Bounded context:** ClaimExtraction
**Purpose:** Represents a single discrete, checkable factual assertion extracted from a body of text, with a risk classification and a search query optimised for source verification.

---

### Aggregate Root

**Entity name:** Claim
**Identity type:** [REQUIRED — UUID v4 | composite key based on charOffset + charLength within an analysis request — to be decided by Architect]
**Description:** A Claim is a factual assertion that can in principle be verified against external sources. It is never an opinion, framing, or rhetorical assertion. The LLM extraction step is responsible for making this distinction. A Claim carries the character offset within the original text so that the UI can highlight the relevant passage.

**Invariants enforced by the root:**
- `claimText` must not be empty
- `charOffset` must be ≥ 0; `charLength` must be > 0
- `riskLevel` must be one of: `high`, `medium`, `low`
- `searchQuery` must not be empty — every claim must have a usable search query
- A Claim must not be an opinion or rhetorical assertion — [enforcement mechanism to be defined by Architect]

---

### Child Entities

*(none — Claim is a leaf aggregate)*

---

### Value Objects

| Value Object | Attributes | Validation Rules | Notes |
|---|---|---|---|
| RiskLevel | `high \| medium \| low` | Must be one of the three enum values | Immutable once assigned by LLM extraction |

---

### Domain Events

| Event Name (past tense) | Trigger Condition | Key Payload Fields | Scope |
|---|---|---|---|
| [ClaimExtracted] | When a Claim is successfully extracted from text | claimText, charOffset, charLength, riskLevel, searchQuery | [Internal \| Published — to be decided by Architect] |

---

### Repository Interface

- `findById(id)` → `Claim | null`
- `save(claim: Claim)` → `void`
- [Additional finders to be defined by Architect based on query patterns]

---

### Lifecycle

**States:** [To be completed by Architect — e.g., Extracted → Evaluated → Annotated]
**Transitions:** [To be completed by Architect]
**Terminal states:** [To be completed by Architect]
**Invalid transitions:** [To be completed by Architect]

---

### Persistence Notes

- **Storage model:** [To be decided — currently the services appear stateless per-request; no persistent store detected]
- **Soft delete:** [To be decided]
- **Optimistic concurrency:** [To be decided]
- **PII:** No — claim text is derived from user-submitted text but is not itself PII; however, the original text submission may be PII depending on content

---

### Open Questions

- [ ] Are Claims persisted between requests, or computed fresh on every analysis? — Assigned to: Architect
- [ ] Does each Claim have a stable identity across re-analyses of the same text? — Assigned to: Architect
