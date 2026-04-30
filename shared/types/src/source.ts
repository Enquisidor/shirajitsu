export type SourceTier = 'tier1' | 'tier2' | 'community-verified' | 'tier3'

export interface SourceResult {
  url: string
  title: string
  tier: SourceTier
  tierLabel: string
  /**
   * Raw search snippet / quote from the search API.
   * Shown verbatim in the UI. An AI-generated summary may replace this
   * in a future iteration if the user opts in or the platform supports it.
   */
  summary: string
  /** Whether we can surface the source directly (false = paywalled / restricted).
   *  Determined by a static paywall domain list; domains not on the list are
   *  checked live and re-validated weekly by a background job. */
  accessible: boolean
  /**
   * LLM-rated relevance of this source to the claim (0.0–1.0).
   * Computed by the annotator in the same call that determines tension.
   * Used for display ordering and filtering — not for tier classification.
   */
  relevanceScore: number
  /**
   * LLM-rated divergence: how differently this source frames the claim (0.0–1.0).
   * Sources with divergenceScore >= 0.5 count toward tensionRating.numerator.
   * Only present on Tier 1 and Tier 2 sources (GeneratesRating = true).
   */
  divergenceScore: number | null
}

export interface CommentaryItem {
  text: string
  sourceUrl: string
  anchorSourceUrl: string
  label: 'unverified-public-discussion'
}
