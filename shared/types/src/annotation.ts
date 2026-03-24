import type { SourceResult, CommentaryItem } from './source.js'

export type RiskLevel = 'high' | 'medium' | 'low'

export type AnnotationState = 'sourced' | 'limited' | 'unverified'

export interface TensionRating {
  /** Number of sources that frame the claim differently */
  numerator: number
  /** Total Tier 1/2 sources evaluated */
  denominator: number
  /** Human-readable label, e.g. "4 of 5 sources frame this differently" */
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
  tensionRating: TensionRating | null
  sources: SourceResult[]
  commentaryItems: CommentaryItem[]
  /** ISO timestamp of when this annotation was generated */
  generatedAt: string
}
