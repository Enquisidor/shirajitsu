import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnnotationCard } from './AnnotationCard.js'
import type { Annotation } from '@shirajitsu/types'

const baseAnnotation: Annotation = {
  claim: {
    claimText: 'The Earth is approximately 4.5 billion years old.',
    charOffset: 0,
    charLength: 49,
    riskLevel: 'low',
    riskReasoning: 'Well-established scientific consensus.',
    searchQuery: 'age of the Earth billion years',
  },
  state: 'sourced',
  tensionRating: {
    numerator: 0,
    denominator: 4,
    label: '0 of 4 sources frame this differently',
  },
  sources: [
    {
      url: 'https://www.nature.com/example',
      title: 'Age of the Earth — Nature',
      tier: 'tier1',
      tierLabel: 'Institutional',
      summary: 'Consistent with the claim.',
      accessible: true,
    },
  ],
  commentaryItems: [],
  generatedAt: '2025-01-01T00:00:00Z',
}

describe('AnnotationCard', () => {
  it('renders claim text', () => {
    render(<AnnotationCard annotation={baseAnnotation} />)
    expect(screen.getByText(/4\.5 billion years old/)).toBeTruthy()
  })

  it('renders risk badge', () => {
    render(<AnnotationCard annotation={baseAnnotation} />)
    expect(screen.getByText('Low risk')).toBeTruthy()
  })

  it('renders state badge', () => {
    render(<AnnotationCard annotation={baseAnnotation} />)
    expect(screen.getByText('Sourced')).toBeTruthy()
  })

  it('renders tension rating when present', () => {
    render(<AnnotationCard annotation={baseAnnotation} />)
    expect(screen.getByText('0 of 4 sources frame this differently')).toBeTruthy()
  })

  it('truncates long claim text and expands on click', async () => {
    const longClaim = 'a'.repeat(150)
    const annotation: Annotation = {
      ...baseAnnotation,
      claim: { ...baseAnnotation.claim, claimText: longClaim },
    }
    const { rerender } = render(<AnnotationCard annotation={annotation} expanded={false} onToggleExpand={() => rerender(<AnnotationCard annotation={annotation} expanded={true} onToggleExpand={() => {}} />)} />)
    expect(screen.getByText('Show more')).toBeTruthy()
    await userEvent.click(screen.getByText('Show more'))
    expect(screen.getByText('Show less')).toBeTruthy()
  })

  it('does not render tension rating when null', () => {
    const annotation: Annotation = { ...baseAnnotation, tensionRating: null }
    render(<AnnotationCard annotation={annotation} />)
    expect(screen.queryByText(/sources frame this/)).toBeNull()
  })

  it('never uses language implying falsehood', () => {
    render(<AnnotationCard annotation={baseAnnotation} />)
    const text = document.body.textContent ?? ''
    const forbidden = ['contradiction', 'false', 'incorrect', 'wrong', 'misleading']
    forbidden.forEach((word) => {
      expect(text.toLowerCase()).not.toContain(word)
    })
  })
})
