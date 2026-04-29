# Ubiquitous Language Glossary — Shirajitsu

The Architect owns and maintains this file. All agents must use the canonical term from this file in code, API fields, comments, log messages, and inter-agent communication.

**This is a living document.** Update it whenever a new concept is introduced or an existing term's meaning is refined. Any agent that encounters an undefined term or a term used inconsistently must add it to the Contested Terms section and request Architect resolution before proceeding.

---

## How to use this glossary

- Every term used in `.spec/api-contracts.md`, `.spec/bounded-contexts/`, `.spec/aggregates/`, or any implementation issue must have an entry here.
- When writing code: use the canonical identifier exactly (PascalCase for types, camelCase for fields in Go/TS). No abbreviations, synonyms, or informal variations.
- When in doubt about a term: check this file before inventing a name.

---

## Core Terms (All Contexts)

Terms with consistent meaning across all bounded contexts.

---

### Claim · All Contexts

**Definition:** A discrete, checkable factual assertion extracted from a body of text. A Claim is something that can in principle be verified against external sources. It is never an opinion, a framing choice, or a rhetorical assertion.

**Canonical identifier in code:** `Claim` (type), `claim` (field), `claimText` (the assertion string)

**Related terms:**
- Annotation: contains a Claim as its root fact
- RiskLevel: classified per Claim

**Synonyms (DO NOT USE in code or communication):**
- "statement": too broad — includes opinions and rhetoric
- "fact": prejudges verifiability
- "assertion": acceptable in documentation but not in code identifiers

**Anti-patterns:**
- "fact-check item": informal; not a domain term

**Example in a domain sentence:**
"The claim-extractor identified three Claims in the article, each with a searchQuery optimised for source lookup."

---

### Annotation · All Contexts

**Definition:** The assembled result for a single Claim — comprising the AnnotationState, TensionRating (if applicable), evaluated Sources, and any CommentaryItems. An Annotation is the primary output unit of the Shirajitsu analysis pipeline.

**Canonical identifier in code:** `Annotation` (type), `annotation` (field)

**Related terms:**
- Claim: the factual assertion the Annotation describes
- AnnotationState: the confidence classification within an Annotation
- TensionRating: the probabilistic framing divergence within an Annotation

**Synonyms (DO NOT USE):**
- "result": too generic
- "fact-check": prejudges; use Annotation

---

### AnnotationState · All Contexts

**Definition:** A three-value classification of the confidence level of an Annotation given the sources found: `sourced` (accessible Tier 1 or Tier 2 source found), `limited` (only inaccessible Tier 1/2 sources found), `unverified` (no Tier 1/2 sources found).

**Canonical identifier in code:** `AnnotationState` (type), `state` (field on Annotation)

**Anti-patterns (terms that must never be used for this concept):**
- "verified" / "unverified" as truth judgements: `unverified` means we couldn't find sources, not that the claim is false
- "true" / "false": Shirajitsu never makes truth verdicts

---

### TensionRating · All Contexts

**Definition:** A probabilistic measure of how many Tier 1 and Tier 2 sources frame a given Claim differently from each other. Always expressed as a fraction (numerator / denominator) with hedged language: "X of Y sources frame this differently." Never a truth verdict.

**Canonical identifier in code:** `TensionRating` (type), `tensionRating` (field)

**Anti-patterns:**
- "contradiction score": implies a verdict
- "accuracy rating": implies a verdict
- "credibility score": implies a verdict

---

### Source · All Contexts

**Definition:** A web resource that has been evaluated against the Shirajitsu source registry for a given Claim. Carries a Tier, accessibility status, and a summary of how it relates to the claim.

**Canonical identifier in code:** `Source` (type), `source` (field), `sources` (collection)

**Related terms:**
- Tier: the registry classification of a Source
- Accessible: whether the Source can be surfaced to the user

---

### Tier · All Contexts

**Definition:** The registry classification of a Source's reliability. Four values: `tier1` (Institutional — peer-reviewed, government data, academic bodies), `tier2` (Reputable — established journalism, named subject-matter experts), `community-verified` (crowd-sourced editing, e.g. Wikipedia), `tier3` (Unrated — no registry classification).

**Canonical identifier in code:** `Tier` (type), `tier` (field). String values: `"tier1"`, `"tier2"`, `"community-verified"`, `"tier3"`.

**Anti-patterns:**
- "rank": use Tier
- "credibility level": not a domain term
- "source score": not a domain term

---

## Context-Specific Terms

### ClaimExtraction

---

#### RiskLevel · ClaimExtraction

**Definition:** A probabilistic classification of how likely a Claim is to be contested or verifiably incorrect, assigned by the LLM during extraction. Three values: `high`, `medium`, `low`. Not a truth judgement — a triage signal for prioritising verification effort.

**Canonical identifier in code:** `RiskLevel` (type), `riskLevel` (field)

**Synonyms (DO NOT USE):**
- "severity": implies a known harm
- "confidence": ambiguous direction

---

#### SearchQuery · ClaimExtraction

**Definition:** A web search string derived from a Claim's text and optimised for source lookup. Not the claim text verbatim — the LLM rewrites it for search effectiveness.

**Canonical identifier in code:** `searchQuery` (field on Claim)

**Synonyms (DO NOT USE):**
- "query": acceptable in comments, not in code fields
- "search term": not the canonical form

---

### SourceEvaluation

---

#### GeneratesRating · SourceEvaluation

**Definition:** A boolean property of a Tier — true if the tier contributes to a TensionRating computation. Only `tier1` and `tier2` generate ratings; `community-verified` and `tier3` do not.

**Canonical identifier in code:** `GeneratesRating()` (method on Tier in Go), checked in TensionRating computation

**Synonyms (DO NOT USE):**
- "countable": informal
- "included in rating": not a domain term

---

#### Accessible · SourceEvaluation

**Definition:** Whether the full content of a Source can be surfaced directly to the user. False for paywalled, geo-restricted, or otherwise inaccessible sources.

**Canonical identifier in code:** `accessible` (field on Source, boolean)

**Synonyms (DO NOT USE):**
- "available": too broad
- "open": ambiguous (open source vs. open access)
- "reachable": implies network reachability, not content access

---

### Annotation

---

#### CommentaryItem · Annotation

**Definition:** An item of unverified public discussion (e.g., forum thread, social media post) surfaced as context alongside an Annotation. Always labelled `unverified-public-discussion`. Never counted in the TensionRating and never presented as evidence.

**Canonical identifier in code:** `CommentaryItem` (type), `commentaryItems` (field on Annotation)

**Synonyms (DO NOT USE):**
- "source": a CommentaryItem is not a Source
- "reference": too broad

---

## Contested Terms

*(None at initial scaffolding — add entries here when agents encounter ambiguity)*

---

## Retired Terms

*(None at initial scaffolding)*
