export type EditorType =
  | 'substack'
  | 'ghost'
  | 'google-docs'
  | 'generic-contenteditable'
  | 'textarea'
  | null

export interface DetectedContext {
  mode: 'writer' | 'reader'
  editorType: EditorType
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

export function detectContext(): DetectedContext {
  if (isSubstack()) {
    return { mode: 'writer', editorType: 'substack', confidence: 'high', reasoning: 'Substack editor detected.' }
  }
  if (isGhost()) {
    return { mode: 'writer', editorType: 'ghost', confidence: 'high', reasoning: 'Ghost editor detected.' }
  }
  if (isGoogleDocs()) {
    return { mode: 'writer', editorType: 'google-docs', confidence: 'high', reasoning: 'Google Docs detected.' }
  }
  if (hasContentEditable()) {
    return { mode: 'writer', editorType: 'generic-contenteditable', confidence: 'medium', reasoning: 'Editable content area found.' }
  }
  if (hasTextarea()) {
    return { mode: 'writer', editorType: 'textarea', confidence: 'low', reasoning: 'Textarea element found.' }
  }

  const readerConfidence = hasArticleStructure() ? 'high' : 'medium'
  return {
    mode: 'reader',
    editorType: null,
    confidence: readerConfidence,
    reasoning: readerConfidence === 'high' ? 'Article structure detected.' : 'No editor found; defaulting to reader mode.',
  }
}

function isSubstack() {
  return !!document.querySelector('.public-DraftEditor-content')
}

function isGhost() {
  return !!(document.querySelector('.kg-prose') || document.querySelector('[data-lexical-editor]'))
}

function isGoogleDocs() {
  return !!(document.querySelector('#docs-editor') || document.querySelector('.docs-texteventtarget-iframe'))
}

function hasContentEditable() {
  const el = document.querySelector('[contenteditable="true"]')
  return !!(el && (el.textContent?.length ?? 0) > 50)
}

function hasTextarea() {
  return !!document.querySelector('textarea')
}

function hasArticleStructure() {
  return !!(
    document.querySelector('article') ||
    document.querySelector('[class*="article"]') ||
    document.querySelector('meta[property="og:type"][content="article"]')
  )
}
