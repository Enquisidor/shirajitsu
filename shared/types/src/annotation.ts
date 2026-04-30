import type { SourceResult, CommentaryItem } from './source.js'

export type RiskLevel = 'high' | 'medium' | 'low'

export type AnnotationState = 'sourced' | 'limited' | 'unverified'

export interface TensionRating {
  /**
   * Weighted mean of (divergenceScore × relevanceScore) across all Tier 1/2 sources,
   * normalised to 0.0–1.0.
   * 0.0 = sources frame the claim consistently; 1.0 = sources diverge substantially.
   * Maps to a blue→red gradient in the UI. Never treated as a binary verdict.
   */
  score: number
  /** Number of Tier 1/2 sources the score is based on — shown as context ("based on N sources") */
  sourceCount: number
  /**
   * Accessibility label describing the score range without a verdict.
   * Shown on hover / for screen readers. Ranges:
   *   0.00–0.25 → "Sources largely frame this consistently"
   *   0.25–0.50 → "Sources show some variation in framing"
   *   0.50–0.75 → "Sources show notable framing differences"
   *   0.75–1.00 → "Sources show substantial framing differences"
   */
  label: string
}

export interface Claim {
  claimText: string
  charOffset: number
  charLength: number
  riskLevel: RiskLevel
  riskReasoning: string
  /** Optimised query for web search verification */
  searchQuery: string
}

export interface Annotation {
  claim: Claim
  state: AnnotationState
  /**
   * null when no Tier 1/2 sources were found, or when evaluationFailed is true.
   * If evaluationFailed is true, the user can retry via POST /v1/evaluate-claim.
   */
  tensionRating: TensionRating | null
  sources: SourceResult[]
  commentaryItems: CommentaryItem[]
  /** ISO timestamp of when this annotation was generated */
  generatedAt: string
  /**
   * True if source evaluation or framing analysis failed for this claim.
   * The UI shows a retry affordance; the claim can be re-run via POST /v1/evaluate-claim.
   * Other fields are still populated from claim extraction (claimText, riskLevel, etc.).
   */
  evaluationFailed?: boolean
}
