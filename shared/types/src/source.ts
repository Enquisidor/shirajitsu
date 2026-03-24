export type SourceTier = 'tier1' | 'tier2' | 'community-verified' | 'tier3'

export interface SourceResult {
  url: string
  title: string
  tier: SourceTier
  tierLabel: string
  summary: string
  /** Whether we can surface the source directly (false = paywalled / restricted) */
  accessible: boolean
}

export interface CommentaryItem {
  text: string
  sourceUrl: string
  anchorSourceUrl: string
  label: 'unverified-public-discussion'
}
