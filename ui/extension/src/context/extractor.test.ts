/**
 * extractor.test.ts
 *
 * Tests: TC-030, TC-031
 * Feature area: SelectionAnalysis — extractSelection() in extractor.ts
 * Issue: ISS-004
 * Session: selection-analysis-2026-05-15
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// TC-030: extractSelection() returns { text: '', characterMap: [] } for null selection
// ---------------------------------------------------------------------------

describe('TC-030: extractSelection() returns empty result when selection is null or collapsed', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'getSelection', {
      value: vi.fn().mockReturnValue(null),
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('TC-030-a: returns { text: "", characterMap: [] } when window.getSelection() is null', async () => {
    // Import after mock — extractSelection does not exist yet (ISS-004 not implemented)
    const { extractSelection } = await import('./extractor')
    const result = extractSelection()
    expect(result).toEqual({ text: '', characterMap: [] })
  })

  it('TC-030-b: does not throw when window.getSelection() is null', async () => {
    const { extractSelection } = await import('./extractor')
    expect(() => extractSelection()).not.toThrow()
  })
})

describe('TC-030-c: extractSelection() returns empty result when selection is collapsed', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'getSelection', {
      value: vi.fn().mockReturnValue({ isCollapsed: true, toString: () => '' }),
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('TC-030-c: returns { text: "", characterMap: [] } for collapsed selection', async () => {
    const { extractSelection } = await import('./extractor')
    const result = extractSelection()
    expect(result).toEqual({ text: '', characterMap: [] })
  })
})

// ---------------------------------------------------------------------------
// TC-031: extractSelection() returns characterMap with selection-relative offsets
// ---------------------------------------------------------------------------

describe('TC-031: extractSelection() returns characterMap where [0].textOffset is 0 (selection-relative)', () => {
  beforeEach(() => {
    // Set up a DOM with a text node to represent the selection range
    document.body.innerHTML = '<p id="mid">claim text</p>'
    const textNode = document.getElementById('mid')!.firstChild as Text

    // Mock getSelection with a non-collapsed range containing the text node
    const mockRange = {
      commonAncestorContainer: document.getElementById('mid')!,
      startOffset: 0,
      endOffset: 10,
      startContainer: textNode,
      endContainer: textNode,
    }

    Object.defineProperty(window, 'getSelection', {
      value: vi.fn().mockReturnValue({
        isCollapsed: false,
        toString: () => 'claim text',
        getRangeAt: vi.fn().mockReturnValue(mockRange),
        rangeCount: 1,
      }),
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('TC-031-a: returns text equal to the selection content', async () => {
    const { extractSelection } = await import('./extractor')
    const result = extractSelection()
    expect(result.text).toBe('claim text')
  })

  it('TC-031-b: characterMap[0].textOffset is 0 (not page-relative)', async () => {
    const { extractSelection } = await import('./extractor')
    const result = extractSelection()
    expect(result.characterMap.length).toBeGreaterThan(0)
    expect(result.characterMap[0].textOffset).toBe(0)
  })

  it('TC-031-c: characterMap length equals the length of the selection text', async () => {
    const { extractSelection } = await import('./extractor')
    const result = extractSelection()
    // One CharacterMapEntry per character in the selection text
    expect(result.characterMap.length).toBe(result.text.length)
  })
})
