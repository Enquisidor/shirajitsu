import { describe, it, expect, beforeEach } from 'vitest'
import { detectContext } from './detector'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('detectContext', () => {
  it('detects Substack editor', () => {
    document.body.innerHTML = '<div class="public-DraftEditor-content"></div>'
    const ctx = detectContext()
    expect(ctx.mode).toBe('writer')
    expect(ctx.editorType).toBe('substack')
    expect(ctx.confidence).toBe('high')
  })

  it('detects Ghost editor via lexical', () => {
    document.body.innerHTML = '<div data-lexical-editor="true"></div>'
    const ctx = detectContext()
    expect(ctx.mode).toBe('writer')
    expect(ctx.editorType).toBe('ghost')
  })

  it('detects Google Docs', () => {
    document.body.innerHTML = '<div id="docs-editor"></div>'
    const ctx = detectContext()
    expect(ctx.mode).toBe('writer')
    expect(ctx.editorType).toBe('google-docs')
  })

  it('detects generic contenteditable with sufficient content', () => {
    document.body.innerHTML = `<div contenteditable="true">${'x'.repeat(100)}</div>`
    const ctx = detectContext()
    expect(ctx.mode).toBe('writer')
    expect(ctx.editorType).toBe('generic-contenteditable')
  })

  it('falls back to reader mode when no editor present', () => {
    document.body.innerHTML = '<article><p>Some article content.</p></article>'
    const ctx = detectContext()
    expect(ctx.mode).toBe('reader')
    expect(ctx.confidence).toBe('high')
  })

  it('reader mode with low confidence when no article structure', () => {
    document.body.innerHTML = '<div><p>Some content.</p></div>'
    const ctx = detectContext()
    expect(ctx.mode).toBe('reader')
    expect(ctx.confidence).toBe('medium')
  })
})
