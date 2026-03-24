import type { AnnotationState } from '@shirajitsu/types'

const LABELS: Record<AnnotationState, string> = {
  sourced: 'Sourced',
  limited: 'Limited visibility',
  unverified: 'Unverified',
}

export function StateBadge({ state }: { state: AnnotationState }) {
  return (
    <span className={`state-badge state-badge--${state}`} aria-label={LABELS[state]}>
      {LABELS[state]}
    </span>
  )
}
