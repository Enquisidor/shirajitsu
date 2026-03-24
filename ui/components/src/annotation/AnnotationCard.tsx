import type { Annotation } from '@shirajitsu/types'
import { RiskBadge } from './RiskBadge.js'
import { StateBadge } from './StateBadge.js'
import { SourceList } from './SourceList.js'
import { CommentaryList } from './CommentaryList.js'

interface AnnotationCardProps {
  annotation: Annotation
  expanded?: boolean
  onToggleExpand?: () => void
}

export function AnnotationCard({ annotation, expanded = false, onToggleExpand }: AnnotationCardProps) {
  const { claim, state, tensionRating, sources, commentaryItems } = annotation
  const truncated = claim.claimText.length > 100
  const displayText = expanded ? claim.claimText : claim.claimText.slice(0, 100)

  return (
    <div className="annotation-card" data-state={state} data-risk={claim.riskLevel}>
      <div className="annotation-card__header">
        <RiskBadge level={claim.riskLevel} />
        <StateBadge state={state} />
      </div>

      <p className="annotation-card__claim">
        {displayText}
        {truncated && !expanded && <span>…</span>}
        {truncated && (
          <button className="annotation-card__expand" onClick={onToggleExpand}>
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </p>

      {tensionRating && (
        <p className="annotation-card__tension">{tensionRating.label}</p>
      )}

      {sources.length > 0 && <SourceList sources={sources} />}

      {commentaryItems.length > 0 && (
        <CommentaryList items={commentaryItems} />
      )}
    </div>
  )
}
