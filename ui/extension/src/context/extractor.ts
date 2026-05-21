import type { EditorType } from './detector'

export interface CharacterMapEntry {
  /** Position in extracted text */
  textOffset: number
  /** Corresponding DOM text node */
  node: Text
  /** Offset within that text node */
  nodeOffset: number
}

export interface ExtractedText {
  text: string
  source: string
  characterMap: CharacterMapEntry[]
}

export interface ExtractedSelection {
  text: string
  characterMap: CharacterMapEntry[]
}

/**
 * Shared noise-filtering predicate.
 * Returns true when the node belongs to a noisy parent element that should be
 * skipped during text extraction (nav, footer, aside, script, style).
 */
function isNoisyNode(node: Node): boolean {
  const parent = (node as Text).parentElement
  if (!parent) return true
  const tag = parent.tagName.toLowerCase()
  return ['nav', 'footer', 'aside', 'script', 'style'].includes(tag)
}

export function extractText(mode: 'writer' | 'reader', editorType: EditorType): ExtractedText {
  const root = mode === 'writer' ? findEditorRoot(editorType) : findArticleRoot()
  if (!root) {
    return { text: '', source: 'none', characterMap: [] }
  }

  return extractFromElement(root, mode === 'writer' ? 'editor' : 'article')
}

/**
 * Extract text and a selection-relative CharacterMap from the current
 * window.getSelection() range.
 *
 * Returns { text: '', characterMap: [] } when:
 *  - window.getSelection() is null
 *  - the selection is collapsed (no range)
 *  - the selection text is empty or whitespace-only
 */
export function extractSelection(): ExtractedSelection {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) {
    return { text: '', characterMap: [] }
  }

  const selectionText = selection.toString()
  if (!selectionText.trim()) {
    return { text: '', characterMap: [] }
  }

  if (!selection.rangeCount) {
    return { text: '', characterMap: [] }
  }

  const range = selection.getRangeAt(0)
  const ancestor = range.commonAncestorContainer

  // Scope the TreeWalker to the commonAncestorContainer.
  // If the ancestor is itself a text node, wrap it in its parent element.
  const root: Node =
    ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentNode ?? document.body : ancestor

  const characterMap: CharacterMapEntry[] = []
  let text = ''
  let selectionOffset = 0

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (isNoisyNode(node)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    const nodeText = node.textContent ?? ''
    if (!nodeText) continue

    // Determine which portion of this node is inside the range.
    const isStart = node === range.startContainer
    const isEnd = node === range.endContainer

    // Both start and end may land on the same node.
    const charStart = isStart ? range.startOffset : 0
    const charEnd = isEnd ? range.endOffset : nodeText.length

    // Skip nodes that lie entirely outside the range.
    // A node is outside if its end is before the range start or its start is at/after the range end.
    if (!isStart && !isEnd) {
      // Middle node — included only if it falls between start and end containers.
      // We check by walking the selection string: the text from the selection
      // object is our ground truth; build the characterMap by accumulating until
      // we've covered selectionText.length characters.
      if (selectionOffset >= selectionText.length) continue

      for (let i = 0; i < nodeText.length && selectionOffset < selectionText.length; i++) {
        characterMap.push({ textOffset: selectionOffset, node, nodeOffset: i })
        selectionOffset++
      }
      text = selectionText.slice(0, selectionOffset)
    } else {
      // Start or end node (or both) — slice to the relevant portion.
      const slice = nodeText.slice(charStart, charEnd)
      for (let i = 0; i < slice.length && selectionOffset < selectionText.length; i++) {
        characterMap.push({ textOffset: selectionOffset, node, nodeOffset: charStart + i })
        selectionOffset++
      }
      text = selectionText.slice(0, selectionOffset)
    }

    if (selectionOffset >= selectionText.length) break
  }

  return { text, characterMap }
}

function findEditorRoot(editorType: EditorType): Element | null {
  switch (editorType) {
    case 'substack': return document.querySelector('.public-DraftEditor-content')
    case 'ghost': return document.querySelector('[data-lexical-editor]') ?? document.querySelector('.kg-prose')
    case 'google-docs': return document.querySelector('#docs-editor')
    case 'generic-contenteditable': return document.querySelector('[contenteditable="true"]')
    case 'textarea': return document.querySelector('textarea')
    default: return null
  }
}

function findArticleRoot(): Element | null {
  // Prefer semantic <article>, fall back to main content heuristics
  return (
    document.querySelector('article') ??
    document.querySelector('main') ??
    document.querySelector('[role="main"]') ??
    document.body
  )
}

function extractFromElement(root: Element, source: string): ExtractedText {
  const characterMap: CharacterMapEntry[] = []
  let text = ''

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (isNoisyNode(node)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    const nodeText = node.textContent ?? ''
    if (!nodeText.trim()) continue

    for (let i = 0; i < nodeText.length; i++) {
      characterMap.push({ textOffset: text.length + i, node, nodeOffset: i })
    }
    text += nodeText
  }

  return { text, source, characterMap }
}
