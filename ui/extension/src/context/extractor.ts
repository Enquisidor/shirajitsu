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

export function extractText(mode: 'writer' | 'reader', editorType: EditorType): ExtractedText {
  const root = mode === 'writer' ? findEditorRoot(editorType) : findArticleRoot()
  if (!root) {
    return { text: '', source: 'none', characterMap: [] }
  }

  return extractFromElement(root, mode === 'writer' ? 'editor' : 'article')
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
      // Skip nav, footer, aside — likely noise
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName.toLowerCase()
      if (['nav', 'footer', 'aside', 'script', 'style'].includes(tag)) {
        return NodeFilter.FILTER_REJECT
      }
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
