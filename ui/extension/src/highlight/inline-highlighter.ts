import type { Annotation } from '@shirajitsu/types'
import type { CharacterMapEntry } from '@/context/extractor'

const HIGHLIGHT_CLASS = 'shirajitsu-highlight'
const TOOLTIP_CLASS = 'shirajitsu-tooltip'

const RISK_COLORS: Record<string, string> = {
  high: 'rgba(230, 57, 70, 0.25)',
  medium: 'rgba(244, 162, 97, 0.25)',
  low: 'rgba(82, 183, 136, 0.25)',
}

export function applyHighlights(annotations: Annotation[], characterMap: CharacterMapEntry[]) {
  clearHighlights()

  for (const annotation of annotations) {
    highlightAnnotation(annotation, characterMap)
  }
}

export function clearHighlights() {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
    // Unwrap: replace span with its text content
    const parent = el.parentNode
    if (parent) {
      while (el.firstChild) parent.insertBefore(el.firstChild, el)
      parent.removeChild(el)
    }
  })
  document.querySelectorAll(`.${TOOLTIP_CLASS}`).forEach((el) => el.remove())
}

function highlightAnnotation(annotation: Annotation, characterMap: CharacterMapEntry[]) {
  const { charOffset, charLength, riskLevel } = annotation.claim
  const end = charOffset + charLength

  // Find the text nodes that span this range
  const startEntry = characterMap[charOffset]
  const endEntry = characterMap[Math.min(end - 1, characterMap.length - 1)]
  if (!startEntry || !endEntry) return

  const color = RISK_COLORS[riskLevel] ?? RISK_COLORS.medium

  if (startEntry.node === endEntry.node) {
    wrapRange(startEntry.node, startEntry.nodeOffset, endEntry.nodeOffset + 1, color, annotation)
  } else {
    // Multi-node range: wrap each node's segment separately
    wrapRange(startEntry.node, startEntry.nodeOffset, startEntry.node.length, color, annotation)
    wrapRange(endEntry.node, 0, endEntry.nodeOffset + 1, color, annotation)
  }
}

function wrapRange(node: Text, start: number, end: number, color: string, annotation: Annotation) {
  const range = document.createRange()
  range.setStart(node, start)
  range.setEnd(node, end)

  const span = document.createElement('span')
  span.className = HIGHLIGHT_CLASS
  span.style.backgroundColor = color
  span.style.cursor = 'pointer'
  span.dataset.annotationId = annotation.claim.charOffset.toString()

  range.surroundContents(span)
  attachTooltip(span, annotation)
}

function attachTooltip(span: HTMLElement, annotation: Annotation) {
  let tooltip: HTMLElement | null = null

  span.addEventListener('mouseenter', () => {
    tooltip = buildTooltip(annotation)
    document.body.appendChild(tooltip)
    positionTooltip(tooltip, span)
  })

  span.addEventListener('mouseleave', () => {
    tooltip?.remove()
    tooltip = null
  })
}

function buildTooltip(annotation: Annotation): HTMLElement {
  const el = document.createElement('div')
  el.className = TOOLTIP_CLASS
  el.style.cssText = `
    position: fixed; z-index: 2147483647;
    background: #1a1a2e; color: #e0e0e0;
    padding: 12px; border-radius: 8px;
    max-width: 320px; font-size: 13px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    pointer-events: none;
  `

  const state = annotation.state === 'sourced' ? 'Sourced'
    : annotation.state === 'limited' ? 'Limited visibility'
    : 'Unverified'

  el.innerHTML = `
    <div style="font-weight:600;margin-bottom:6px">${annotation.claim.riskLevel.toUpperCase()} RISK · ${state}</div>
    ${annotation.tensionRating ? `<div style="margin-bottom:6px;color:#52B788">${annotation.tensionRating.label}</div>` : ''}
    <div style="font-size:12px;opacity:0.8">${annotation.claim.claimText.slice(0, 120)}${annotation.claim.claimText.length > 120 ? '…' : ''}</div>
  `
  return el
}

function positionTooltip(tooltip: HTMLElement, anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect()
  const above = rect.top > 160
  tooltip.style.left = `${Math.min(rect.left, window.innerWidth - 340)}px`
  tooltip.style.top = above
    ? `${rect.top - 10}px`
    : `${rect.bottom + 10}px`
  if (above) tooltip.style.transform = 'translateY(-100%)'
}
