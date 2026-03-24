import type { RiskLevel } from '@shirajitsu/types'

const LABELS: Record<RiskLevel, string> = {
  high: 'High risk',
  medium: 'Medium risk',
  low: 'Low risk',
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`risk-badge risk-badge--${level}`} aria-label={LABELS[level]}>
      {LABELS[level]}
    </span>
  )
}
