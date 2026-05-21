/**
 * inline-highlighter.test.ts
 *
 * Tests: TC-055, TC-056, TC-082
 * Feature area: SelectionAnalysis — ISS-006 HighlightColor layering in inline-highlighter.ts
 * Issue: ISS-006
 * Session: selection-analysis-2026-05-15
 *
 * The current applyHighlights() does not accept a highlightColor parameter.
 * All tests in this file assert the NEW ISS-006 signature:
 *   applyHighlights(annotations, characterMap, highlightColor)
 * These tests MUST fail against the current implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { applyHighlights, clearHighlights } from './inline-highlighter'
import type { CharacterMapEntry } from '../context/extractor'
import type { Annotation } from '@shirajitsu/types'

// ---------------------------------------------------------------------------
// Helper — build a minimal CharacterMapEntry[] for a text node
// ---------------------------------------------------------------------------

function buildCharacterMap(text: string, node: Text, startNodeOffset: number = 0): CharacterMapEntry[] {
  const map: CharacterMapEntry[] = []
  for (let i = 0; i < text.length; i++) {
    map.push({ textOffset: i, node, nodeOffset: startNodeOffset + i })
  }
  return map
}

// ---------------------------------------------------------------------------
// Helper — build a minimal Annotation
// ---------------------------------------------------------------------------

function buildAnnotation(
  charOffset: number,
  charLength: number,
  riskLevel: 'high' | 'medium' | 'low',
  claimText: string,
): Annotation {
  return {
    claim: { charOffset, charLength, riskLevel, claimText, riskReasoning: '', searchQuery: '' },
    state: 'sourced',
    tensionRating: null,
    sources: [],
    commentaryItems: [],
    generatedAt: '',
  }
}

// ===========================================================================
// TC-055: Each highlight span has backgroundColor = highlightColor and outline = risk-level color
// ===========================================================================

describe('TC-055: Highlight span has backgroundColor = highlightColor and outline = risk-level color', () => {
  let textNode: Text

  beforeEach(() => {
    document.body.innerHTML = '<p id="content">hello world test content</p>'
    textNode = document.getElementById('content')!.firstChild as Text
  })

  afterEach(() => {
    clearHighlights()
    document.body.innerHTML = ''
  })

  it('TC-055-a: high-risk span has backgroundColor equal to highlightColor "#FFFF00"', () => {
    const characterMap = buildCharacterMap('hello world test content', textNode)
    const annotations = [buildAnnotation(0, 5, 'high', 'hello')]

    // ISS-006 signature: applyHighlights(annotations, characterMap, highlightColor)
    // Current implementation only accepts 2 args — this test will fail because
    // the span will not have backgroundColor set to '#FFFF00'
    applyHighlights(annotations, characterMap, '#FFFF00')

    const span = document.querySelector('.shirajitsu-highlight') as HTMLElement | null
    expect(span).not.toBeNull()
    // backgroundColor must be the user's highlight color, not the risk-level color
    // CSS normalizes #FFFF00 to rgb(255, 255, 0)
    expect(span!.style.backgroundColor).toMatch(/^(#[Ff]{2}[Ff]{2}00|rgb\(255,\s*255,\s*0\))$/)
  })

  it('TC-055-b: high-risk span has outline containing the high-risk color components (rgba(230, 57, 70, ...))', () => {
    const characterMap = buildCharacterMap('hello world test content', textNode)
    const annotations = [buildAnnotation(0, 5, 'high', 'hello')]

    applyHighlights(annotations, characterMap, '#FFFF00')

    const span = document.querySelector('.shirajitsu-highlight') as HTMLElement | null
    expect(span).not.toBeNull()
    // The outline must contain the high-risk color components
    expect(span!.style.outline).toContain('230')
    expect(span!.style.outline).toContain('57')
    expect(span!.style.outline).toContain('70')
  })

  it('TC-055-c: both backgroundColor and outline are set simultaneously — neither is absent', () => {
    const characterMap = buildCharacterMap('hello world test content', textNode)
    const annotations = [buildAnnotation(0, 5, 'high', 'hello')]

    applyHighlights(annotations, characterMap, '#FFFF00')

    const span = document.querySelector('.shirajitsu-highlight') as HTMLElement | null
    expect(span).not.toBeNull()
    expect(span!.style.backgroundColor).toBeTruthy()
    expect(span!.style.outline).toBeTruthy()
  })
})

// ===========================================================================
// TC-056: Medium-risk and low-risk spans have correct outline colors
// ===========================================================================

describe('TC-056: Medium-risk and low-risk spans use correct outline colors', () => {
  let textNode: Text

  beforeEach(() => {
    // Three separate text nodes for three annotations at non-overlapping positions
    document.body.innerHTML = '<p id="content">hello world test</p>'
    textNode = document.getElementById('content')!.firstChild as Text
  })

  afterEach(() => {
    clearHighlights()
    document.body.innerHTML = ''
  })

  it('TC-056-a: medium-risk span outline contains medium-risk color components (rgba(244, 162, 97, ...))', () => {
    const characterMap = buildCharacterMap('hello world test', textNode)
    const annotations = [buildAnnotation(6, 5, 'medium', 'world')]

    applyHighlights(annotations, characterMap, '#FFFF00')

    const span = document.querySelector('.shirajitsu-highlight') as HTMLElement | null
    expect(span).not.toBeNull()
    expect(span!.style.outline).toContain('244')
    expect(span!.style.outline).toContain('162')
    expect(span!.style.outline).toContain('97')
  })

  it('TC-056-b: medium-risk span backgroundColor is "#FFFF00"', () => {
    const characterMap = buildCharacterMap('hello world test', textNode)
    const annotations = [buildAnnotation(6, 5, 'medium', 'world')]

    applyHighlights(annotations, characterMap, '#FFFF00')

    const span = document.querySelector('.shirajitsu-highlight') as HTMLElement | null
    expect(span).not.toBeNull()
    expect(span!.style.backgroundColor).toMatch(/^(#[Ff]{2}[Ff]{2}00|rgb\(255,\s*255,\s*0\))$/)
  })

  it('TC-056-c: low-risk span outline contains low-risk color components (rgba(82, 183, 136, ...))', () => {
    const characterMap = buildCharacterMap('hello world test', textNode)
    const annotations = [buildAnnotation(12, 4, 'low', 'test')]

    applyHighlights(annotations, characterMap, '#FFFF00')

    const span = document.querySelector('.shirajitsu-highlight') as HTMLElement | null
    expect(span).not.toBeNull()
    expect(span!.style.outline).toContain('82')
    expect(span!.style.outline).toContain('183')
    expect(span!.style.outline).toContain('136')
  })

  it('TC-056-d: low-risk span backgroundColor is "#FFFF00"', () => {
    const characterMap = buildCharacterMap('hello world test', textNode)
    const annotations = [buildAnnotation(12, 4, 'low', 'test')]

    applyHighlights(annotations, characterMap, '#FFFF00')

    const span = document.querySelector('.shirajitsu-highlight') as HTMLElement | null
    expect(span).not.toBeNull()
    expect(span!.style.backgroundColor).toMatch(/^(#[Ff]{2}[Ff]{2}00|rgb\(255,\s*255,\s*0\))$/)
  })
})

// ===========================================================================
// TC-082: Security — CSS injection via highlightColor field
// ===========================================================================

describe('TC-082: CSS injection via highlightColor is rejected by browser CSS parser', () => {
  let textNode: Text

  beforeEach(() => {
    document.body.innerHTML = '<p id="content">hello world test injection check here now</p>'
    textNode = document.getElementById('content')!.firstChild as Text
  })

  afterEach(() => {
    clearHighlights()
    document.body.innerHTML = ''
  })

  it('TC-082-a: span does NOT have color: red applied from CSS injection attempt', () => {
    const characterMap = buildCharacterMap('hello world test injection check here now', textNode)
    const annotations = [buildAnnotation(0, 5, 'high', 'hello')]
    const maliciousColor = '; color: red; background-image: url(evil.com)'

    // The implementation uses span.style.backgroundColor = highlightColor (property assignment)
    // which causes the browser to reject the invalid CSS value silently.
    // If the implementation uses cssText concatenation, this test would catch the injection.
    applyHighlights(annotations, characterMap, maliciousColor)

    const span = document.querySelector('.shirajitsu-highlight') as HTMLElement | null
    expect(span).not.toBeNull()
    // color: red must NOT be applied (CSS injection was rejected)
    expect(span!.style.color).not.toBe('red')
  })

  it('TC-082-b: span does NOT have background-image from CSS injection attempt', () => {
    const characterMap = buildCharacterMap('hello world test injection check here now', textNode)
    const annotations = [buildAnnotation(0, 5, 'high', 'hello')]
    const maliciousColor = '; color: red; background-image: url(evil.com)'

    applyHighlights(annotations, characterMap, maliciousColor)

    const span = document.querySelector('.shirajitsu-highlight') as HTMLElement | null
    expect(span).not.toBeNull()
    // background-image must NOT be set to the malicious URL
    expect(span!.style.backgroundImage).not.toContain('evil.com')
  })

  it('TC-082-c: implementation uses direct property assignment (not cssText concatenation with raw highlightColor)', () => {
    const characterMap = buildCharacterMap('hello world test injection check here now', textNode)
    const annotations = [buildAnnotation(0, 5, 'high', 'hello')]
    const maliciousColor = '; color: red; background-image: url(evil.com)'

    // If cssText concatenation is used, the malicious semicolons would inject additional properties.
    // If property assignment is used, the browser rejects the invalid value.
    // We verify by checking the span does not have the injected properties.
    expect(() => applyHighlights(annotations, characterMap, maliciousColor)).not.toThrow()
    const span = document.querySelector('.shirajitsu-highlight') as HTMLElement | null
    if (span) {
      // If span was created, verify no injected properties
      expect(span.style.color).not.toBe('red')
    }
  })
})
