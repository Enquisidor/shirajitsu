/**
 * content/index.test.ts
 *
 * Tests: TC-021 through TC-029, TC-051, TC-054, TC-057, TC-058, TC-059, TC-060, TC-061
 * Feature area: SelectionAnalysis — content script extension
 * Issues: ISS-004, ISS-005 (selectionchange debounce), ISS-006
 * Session: selection-analysis-2026-05-15
 *
 * Infrastructure note: content/index.ts calls chrome.runtime.onMessage.addListener
 * at module load time. To avoid a "chrome is not defined" error at import time,
 * this test file uses vi.mock to intercept the module's chrome dependency before
 * the module executes. The message listener is captured from the mock and invoked
 * directly in each test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Capture the registered message listener
// We set up a mutable reference that will be populated when the content
// script registers its listener via chrome.runtime.onMessage.addListener.
// ---------------------------------------------------------------------------

let capturedMessageListener: (
  (message: Record<string, unknown>, sender: unknown, sendResponse: (r: unknown) => void) => boolean | void
) | null = null

const mockRuntimeSendMessage = vi.fn()
const mockStorageSyncGet = vi.fn()
const mockStorageSessionGet = vi.fn()
const mockStorageSessionSet = vi.fn()

// The chrome global must be stubbed BEFORE the content script module is imported.
// We use vi.stubGlobal to install it synchronously before any import.
vi.stubGlobal('chrome', {
  storage: {
    sync: { get: mockStorageSyncGet },
    session: { get: mockStorageSessionGet, set: mockStorageSessionSet },
  },
  runtime: {
    sendMessage: mockRuntimeSendMessage,
    onMessage: {
      addListener: vi.fn((fn) => {
        capturedMessageListener = fn
      }),
      removeListener: vi.fn(),
    },
    lastError: undefined,
  },
  tabs: { sendMessage: vi.fn() },
})

// ---------------------------------------------------------------------------
// Mock dependencies of content/index.ts BEFORE the import
// ---------------------------------------------------------------------------

vi.mock('../context/detector', () => ({
  detectContext: () => ({ mode: 'reader', editorType: 'none', confidence: 'high' }),
}))

const mockExtractText = vi.fn().mockReturnValue({
  text: 'full page text',
  characterMap: [],
  source: 'article',
})
const mockExtractSelection = vi.fn().mockReturnValue({
  text: '',
  characterMap: [],
})

vi.mock('../context/extractor', () => ({
  extractText: (...args: unknown[]) => mockExtractText(...args),
  extractSelection: () => mockExtractSelection(),
}))

const mockApplyHighlights = vi.fn()
const mockClearHighlights = vi.fn()

vi.mock('../highlight/inline-highlighter', () => ({
  applyHighlights: (...args: unknown[]) => mockApplyHighlights(...args),
  clearHighlights: () => mockClearHighlights(),
}))

// ---------------------------------------------------------------------------
// Import content script AFTER all mocks and stubs
// ---------------------------------------------------------------------------

import '../content/index'

// ---------------------------------------------------------------------------
// Helper to get the registered listener
// ---------------------------------------------------------------------------

function getListener() {
  if (!capturedMessageListener) {
    throw new Error('Message listener was not registered. ISS-004 changes to content/index.ts are required.')
  }
  return capturedMessageListener
}

// ===========================================================================
// ISS-004: GET_CONTEXT selection extension (TC-021 through TC-026)
// ===========================================================================

describe('TC-021: GET_CONTEXT returns selection: null when window.getSelection() is null', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'getSelection', {
      value: vi.fn().mockReturnValue(null),
      writable: true,
      configurable: true,
    })
  })

  it('TC-021-a: sendResponse includes selection: null when getSelection() returns null', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener({ type: 'GET_CONTEXT' }, {}, sendResponse)
    expect(sendResponse).toHaveBeenCalled()
    const resp = sendResponse.mock.calls[0][0] as Record<string, unknown>
    // ISS-004 not implemented: current GET_CONTEXT only returns { context },
    // not { context, selection }. This assertion fails.
    expect(resp).toHaveProperty('selection')
    expect(resp.selection).toBeNull()
  })

  it('TC-021-b: context field is still present alongside selection: null', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener({ type: 'GET_CONTEXT' }, {}, sendResponse)
    const resp = sendResponse.mock.calls[0][0] as Record<string, unknown>
    expect(resp).toHaveProperty('context')
  })
})

describe('TC-022: GET_CONTEXT returns selection: null when selection is collapsed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'getSelection', {
      value: vi.fn().mockReturnValue({ isCollapsed: true, toString: () => '' }),
      writable: true,
      configurable: true,
    })
  })

  it('TC-022: sendResponse includes selection: null and context when selection is collapsed', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener({ type: 'GET_CONTEXT' }, {}, sendResponse)
    const resp = sendResponse.mock.calls[0][0] as Record<string, unknown>
    expect(resp).toHaveProperty('selection')
    expect(resp.selection).toBeNull()
    expect(resp).toHaveProperty('context')
  })
})

describe('TC-023: GET_CONTEXT returns selection: null when selection text is whitespace-only', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'getSelection', {
      value: vi.fn().mockReturnValue({
        isCollapsed: false,
        toString: () => '   \t\n   ',
      }),
      writable: true,
      configurable: true,
    })
  })

  it('TC-023: sendResponse includes selection: null when selection.toString() is whitespace-only', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener({ type: 'GET_CONTEXT' }, {}, sendResponse)
    const resp = sendResponse.mock.calls[0][0] as Record<string, unknown>
    expect(resp).toHaveProperty('selection')
    expect(resp.selection).toBeNull()
  })
})

describe('TC-024: GET_CONTEXT returns SelectionContext with text and wordCount for valid selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'getSelection', {
      value: vi.fn().mockReturnValue({
        isCollapsed: false,
        toString: () => 'The quick brown fox jumps',
      }),
      writable: true,
      configurable: true,
    })
  })

  it('TC-024-a: selection.text equals the selection string', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener({ type: 'GET_CONTEXT' }, {}, sendResponse)
    const resp = sendResponse.mock.calls[0][0] as Record<string, unknown>
    // ISS-004 not implemented — selection field does not exist. Fails.
    expect(resp.selection).not.toBeNull()
    expect((resp.selection as Record<string, unknown>).text).toBe('The quick brown fox jumps')
  })

  it('TC-024-b: selection.wordCount is 5 for a 5-word phrase', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener({ type: 'GET_CONTEXT' }, {}, sendResponse)
    const resp = sendResponse.mock.calls[0][0] as Record<string, unknown>
    expect(resp.selection).not.toBeNull()
    expect((resp.selection as Record<string, unknown>).wordCount).toBe(5)
  })

  it('TC-024-c: selection is not null and context is present', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener({ type: 'GET_CONTEXT' }, {}, sendResponse)
    const resp = sendResponse.mock.calls[0][0] as Record<string, unknown>
    expect(resp.selection).not.toBeNull()
    expect(resp).toHaveProperty('context')
  })
})

describe('TC-025: wordCount computed by splitting on /\\s+/ — multi-space and mixed whitespace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'getSelection', {
      value: vi.fn().mockReturnValue({
        isCollapsed: false,
        toString: () => '  hello   world  ',
      }),
      writable: true,
      configurable: true,
    })
  })

  it('TC-025-a: wordCount is 2 (not 4 or 5) for "  hello   world  "', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener({ type: 'GET_CONTEXT' }, {}, sendResponse)
    const resp = sendResponse.mock.calls[0][0] as Record<string, unknown>
    // ISS-004 not implemented — will fail because selection field doesn't exist
    expect(resp.selection).not.toBeNull()
    expect((resp.selection as Record<string, unknown>).wordCount).toBe(2)
  })

  it('TC-025-b: selection.text is the raw string (not trimmed)', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener({ type: 'GET_CONTEXT' }, {}, sendResponse)
    const resp = sendResponse.mock.calls[0][0] as Record<string, unknown>
    expect(resp.selection).not.toBeNull()
    expect((resp.selection as Record<string, unknown>).text).toBe('  hello   world  ')
  })
})

describe('TC-026: GET_CONTEXT returns selection with wordCount 4 — content script does not apply guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'getSelection', {
      value: vi.fn().mockReturnValue({
        isCollapsed: false,
        toString: () => 'just four words here',
      }),
      writable: true,
      configurable: true,
    })
  })

  it('TC-026-a: selection.wordCount is 4 for a 4-word phrase', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener({ type: 'GET_CONTEXT' }, {}, sendResponse)
    const resp = sendResponse.mock.calls[0][0] as Record<string, unknown>
    expect(resp.selection).not.toBeNull()
    expect((resp.selection as Record<string, unknown>).wordCount).toBe(4)
  })

  it('TC-026-b: selection is not null — guard runs in popup, not content script', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener({ type: 'GET_CONTEXT' }, {}, sendResponse)
    const resp = sendResponse.mock.calls[0][0] as Record<string, unknown>
    // ISS-004 not implemented — selection field does not exist yet
    expect(resp.selection).not.toBeNull()
  })
})

// ===========================================================================
// ISS-004: RUN_ANALYSIS mode routing (TC-027, TC-028, TC-029)
// ===========================================================================

describe('TC-027: RUN_ANALYSIS with selectionMode "selection" uses extractSelection()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'getSelection', {
      value: vi.fn().mockReturnValue({
        isCollapsed: false,
        toString: () => 'Five words minimum here now',
        getRangeAt: vi.fn().mockReturnValue({}),
      }),
      writable: true,
      configurable: true,
    })
    mockExtractSelection.mockReturnValue({
      text: 'Five words minimum here now',
      characterMap: [],
    })
    mockExtractText.mockReturnValue({
      text: 'full page content',
      characterMap: [],
      source: 'article',
    })
    mockStorageSyncGet.mockImplementation(
      (_keys: unknown, cb: (v: Record<string, unknown>) => void) => cb({ selectedModel: undefined }),
    )
    mockRuntimeSendMessage.mockImplementation(
      (_msg: unknown, callback: (r: unknown) => void) => callback({ annotations: [] }),
    )
  })

  it('TC-027-a: extractSelection() is called when selectionMode is "selection"', async () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    const returnVal = listener({ type: 'RUN_ANALYSIS', selectionMode: 'selection' }, {}, sendResponse)
    if (returnVal === true) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    // ISS-004 not implemented — RUN_ANALYSIS always uses extractText(). This assertion fails.
    expect(mockExtractSelection).toHaveBeenCalledTimes(1)
  })

  it('TC-027-b: extractText() is NOT called when selectionMode is "selection"', async () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    const returnVal = listener({ type: 'RUN_ANALYSIS', selectionMode: 'selection' }, {}, sendResponse)
    if (returnVal === true) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    expect(mockExtractText).not.toHaveBeenCalled()
  })

  it('TC-027-c: sendResponse includes selectionAnalysisMode: "selection"', async () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    const returnVal = listener({ type: 'RUN_ANALYSIS', selectionMode: 'selection' }, {}, sendResponse)
    if (returnVal === true) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    const resp = sendResponse.mock.calls[0]?.[0] as Record<string, unknown> | undefined
    // ISS-004 not implemented — selectionAnalysisMode not present in response
    expect(resp?.selectionAnalysisMode).toBe('selection')
  })
})

describe('TC-028: RUN_ANALYSIS with selectionMode "whole-page" uses extractText()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractText.mockReturnValue({
      text: 'full page content here',
      characterMap: [],
      source: 'article',
    })
    mockExtractSelection.mockReturnValue({ text: '', characterMap: [] })
    mockStorageSyncGet.mockImplementation(
      (_keys: unknown, cb: (v: Record<string, unknown>) => void) => cb({ selectedModel: undefined }),
    )
    mockRuntimeSendMessage.mockImplementation(
      (_msg: unknown, callback: (r: unknown) => void) => callback({ annotations: [] }),
    )
  })

  it('TC-028-a: extractText() is called when selectionMode is "whole-page"', async () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    const returnVal = listener({ type: 'RUN_ANALYSIS', selectionMode: 'whole-page' }, {}, sendResponse)
    if (returnVal === true) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    expect(mockExtractText).toHaveBeenCalledTimes(1)
  })

  it('TC-028-b: extractSelection() is NOT called when selectionMode is "whole-page"', async () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    const returnVal = listener({ type: 'RUN_ANALYSIS', selectionMode: 'whole-page' }, {}, sendResponse)
    if (returnVal === true) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    expect(mockExtractSelection).not.toHaveBeenCalled()
  })

  it('TC-028-c: sendResponse includes selectionAnalysisMode: "whole-page"', async () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    const returnVal = listener({ type: 'RUN_ANALYSIS', selectionMode: 'whole-page' }, {}, sendResponse)
    if (returnVal === true) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    const resp = sendResponse.mock.calls[0]?.[0] as Record<string, unknown> | undefined
    // ISS-004 not implemented — selectionAnalysisMode not present
    expect(resp?.selectionAnalysisMode).toBe('whole-page')
  })
})

describe('TC-029: RUN_ANALYSIS with absent selectionMode defaults to whole-page behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractText.mockReturnValue({
      text: 'full page content here',
      characterMap: [],
      source: 'article',
    })
    mockExtractSelection.mockReturnValue({ text: '', characterMap: [] })
    mockStorageSyncGet.mockImplementation(
      (_keys: unknown, cb: (v: Record<string, unknown>) => void) => cb({ selectedModel: undefined }),
    )
    mockRuntimeSendMessage.mockImplementation(
      (_msg: unknown, callback: (r: unknown) => void) => callback({ annotations: [] }),
    )
  })

  it('TC-029-a: extractText() is called when selectionMode field is absent', async () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    const returnVal = listener({ type: 'RUN_ANALYSIS' }, {}, sendResponse)
    if (returnVal === true) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    expect(mockExtractText).toHaveBeenCalledTimes(1)
  })

  it('TC-029-b: extractSelection() is NOT called when selectionMode field is absent', async () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    const returnVal = listener({ type: 'RUN_ANALYSIS' }, {}, sendResponse)
    if (returnVal === true) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    expect(mockExtractSelection).not.toHaveBeenCalled()
  })

  it('TC-029-c: sendResponse includes selectionAnalysisMode: "whole-page" for backward compatibility', async () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    const returnVal = listener({ type: 'RUN_ANALYSIS' }, {}, sendResponse)
    if (returnVal === true) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    const resp = sendResponse.mock.calls[0]?.[0] as Record<string, unknown> | undefined
    // ISS-004 not implemented — selectionAnalysisMode not present
    expect(resp?.selectionAnalysisMode).toBe('whole-page')
  })
})

// ===========================================================================
// ISS-005: selectionchange debounce (TC-051)
// ===========================================================================

describe('TC-051: SELECTION_CHANGED message fired only after 150ms debounce — not on every selectionchange event', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    Object.defineProperty(window, 'getSelection', {
      value: vi.fn().mockReturnValue({
        isCollapsed: false,
        toString: () => 'newly selected text',
      }),
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('TC-051-a: sendMessage not called before 150ms debounce fires for selectionchange events', () => {
    // Fire selectionchange 5 times in rapid succession (10ms apart)
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new Event('selectionchange'))
      vi.advanceTimersByTime(10)
    }
    // 50ms elapsed — no debounce fired yet
    // ISS-004/ISS-005 not implemented — no selectionchange listener exists.
    // This assertion will pass if no listener is registered (0 calls is correct).
    // BUT the test's real assertion must be: after 200ms, exactly 1 SELECTION_CHANGED fires.
    // The combination of TC-051-a and TC-051-b checks the debounce behavior.
    const selectionChangedCallsAtT50 = mockRuntimeSendMessage.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)?.type === 'SELECTION_CHANGED',
    )
    expect(selectionChangedCallsAtT50).toHaveLength(0)
  })

  it('TC-051-b: exactly one SELECTION_CHANGED broadcast after 150ms debounce interval', () => {
    // Fire 5 selectionchange events 10ms apart
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new Event('selectionchange'))
      vi.advanceTimersByTime(10)
    }
    // Advance past the 150ms debounce window
    vi.advanceTimersByTime(200)
    const selectionChangedCalls = mockRuntimeSendMessage.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)?.type === 'SELECTION_CHANGED',
    )
    // ISS-004/ISS-005 not implemented — no selectionchange listener.
    // This asserts exactly 1 broadcast, which fails because 0 exist.
    expect(selectionChangedCalls).toHaveLength(1)
  })
})

// ===========================================================================
// ISS-006: SHOW_ANNOTATIONS routing (TC-054, TC-057, TC-058, TC-059, TC-060, TC-061)
// ===========================================================================

const baseAnnotation = {
  claim: { charOffset: 0, charLength: 5, riskLevel: 'high', claimText: 'hello' },
  state: 'sourced',
  tensionRating: null,
}

const baseSettings = {
  displayMode: 'inline' as const,
  highlightColor: '#FFFF00',
  selectedModel: { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514', label: 'test', description: 'test' },
  selectedSearchProvider: 'google-cse' as const,
  manualModeOverride: null,
  showCommentaryLayer: true,
  showUnverifiedAnnotations: true,
}

describe('TC-054: SHOW_ANNOTATIONS with selectionAnalysisMode "selection" calls extractSelection()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractSelection.mockReturnValue({
      text: 'claim text',
      characterMap: [{ textOffset: 0, node: document.createTextNode('claim'), nodeOffset: 0 }],
    })
    mockExtractText.mockReturnValue({ text: 'full page', characterMap: [], source: 'article' })
  })

  it('TC-054-a: extractSelection() is called for SHOW_ANNOTATIONS with selectionAnalysisMode "selection"', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener(
      {
        type: 'SHOW_ANNOTATIONS',
        payload: { annotations: [baseAnnotation], settings: baseSettings, selectionAnalysisMode: 'selection' },
      },
      {},
      sendResponse,
    )
    // ISS-006 not implemented — extractSelection() never called from SHOW_ANNOTATIONS handler
    expect(mockExtractSelection).toHaveBeenCalled()
  })

  it('TC-054-b: extractText() is NOT called for SHOW_ANNOTATIONS with selectionAnalysisMode "selection"', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener(
      {
        type: 'SHOW_ANNOTATIONS',
        payload: { annotations: [], settings: baseSettings, selectionAnalysisMode: 'selection' },
      },
      {},
      sendResponse,
    )
    expect(mockExtractText).not.toHaveBeenCalled()
  })
})

describe('TC-057: SHOW_ANNOTATIONS with selectionAnalysisMode "whole-page" uses extractText()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractText.mockReturnValue({ text: 'full page', characterMap: [], source: 'article' })
    mockExtractSelection.mockReturnValue({ text: '', characterMap: [] })
  })

  it('TC-057-a: extractText() is called for SHOW_ANNOTATIONS with selectionAnalysisMode "whole-page"', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener(
      {
        type: 'SHOW_ANNOTATIONS',
        payload: { annotations: [], settings: baseSettings, selectionAnalysisMode: 'whole-page' },
      },
      {},
      sendResponse,
    )
    expect(mockExtractText).toHaveBeenCalledTimes(1)
  })

  it('TC-057-b: extractSelection() is NOT called for SHOW_ANNOTATIONS with selectionAnalysisMode "whole-page"', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener(
      {
        type: 'SHOW_ANNOTATIONS',
        payload: { annotations: [], settings: baseSettings, selectionAnalysisMode: 'whole-page' },
      },
      {},
      sendResponse,
    )
    // ISS-006 not implemented — extractSelection never called from content script for SHOW_ANNOTATIONS
    // BUT the current implementation also never calls extractSelection for SHOW_ANNOTATIONS...
    // The test will pass currently (extractSelection is not called). This is an unexpected pass.
    // However, TC-054-a will fail (it asserts extractSelection IS called for 'selection' mode).
    // This specific test (TC-057-b) may pass — flagged in the Phase 1 report.
    expect(mockExtractSelection).not.toHaveBeenCalled()
  })
})

describe('TC-058: SHOW_ANNOTATIONS with absent selectionAnalysisMode defaults to whole-page behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractText.mockReturnValue({ text: 'full page', characterMap: [], source: 'article' })
    mockExtractSelection.mockReturnValue({ text: '', characterMap: [] })
  })

  it('TC-058-a: extractText() is called when selectionAnalysisMode is absent', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener(
      {
        type: 'SHOW_ANNOTATIONS',
        payload: { annotations: [], settings: baseSettings },
      },
      {},
      sendResponse,
    )
    expect(mockExtractText).toHaveBeenCalledTimes(1)
  })

  it('TC-058-b: extractSelection() is NOT called when selectionAnalysisMode is absent', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener(
      {
        type: 'SHOW_ANNOTATIONS',
        payload: { annotations: [], settings: baseSettings },
      },
      {},
      sendResponse,
    )
    expect(mockExtractSelection).not.toHaveBeenCalled()
  })
})

describe('TC-059: applyHighlights() receives highlightColor from settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractText.mockReturnValue({ text: 'full page content', characterMap: [], source: 'article' })
  })

  it('TC-059: applyHighlights is called with highlightColor "#FF6600" from settings', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener(
      {
        type: 'SHOW_ANNOTATIONS',
        payload: {
          annotations: [baseAnnotation],
          settings: { ...baseSettings, highlightColor: '#FF6600' },
          selectionAnalysisMode: 'whole-page',
        },
      },
      {},
      sendResponse,
    )
    // ISS-006 not implemented — applyHighlights is called with 2 args, not 3.
    // This assertion fails because the 3rd arg '#FF6600' is not passed.
    expect(mockApplyHighlights).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      '#FF6600',
    )
  })
})

describe('TC-060: applyHighlights() falls back to "#FFFF00" when highlightColor is absent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractText.mockReturnValue({ text: 'full page content', characterMap: [], source: 'article' })
  })

  it('TC-060: applyHighlights called with "#FFFF00" when settings has no highlightColor', () => {
    const settingsWithoutColor = {
      displayMode: 'inline' as const,
      selectedModel: { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514', label: 'test', description: 'test' },
      selectedSearchProvider: 'google-cse' as const,
      manualModeOverride: null,
      showCommentaryLayer: true,
      showUnverifiedAnnotations: true,
    }
    const listener = getListener()
    const sendResponse = vi.fn()
    listener(
      {
        type: 'SHOW_ANNOTATIONS',
        payload: {
          annotations: [baseAnnotation],
          settings: settingsWithoutColor,
          selectionAnalysisMode: 'whole-page',
        },
      },
      {},
      sendResponse,
    )
    // ISS-006 not implemented — applyHighlights called with 2 args, not 3.
    expect(mockApplyHighlights).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      '#FFFF00',
    )
  })
})

describe('TC-061: When extractSelection() returns empty characterMap, applyHighlights called with [] and no highlights created', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'getSelection', {
      value: vi.fn().mockReturnValue(null),
      writable: true,
      configurable: true,
    })
    mockExtractSelection.mockReturnValue({ text: '', characterMap: [] })
  })

  it('TC-061-a: extractSelection() is called when selectionAnalysisMode is "selection"', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener(
      {
        type: 'SHOW_ANNOTATIONS',
        payload: {
          annotations: [baseAnnotation],
          settings: baseSettings,
          selectionAnalysisMode: 'selection',
        },
      },
      {},
      sendResponse,
    )
    // ISS-006 not implemented — extractSelection not called from SHOW_ANNOTATIONS handler
    expect(mockExtractSelection).toHaveBeenCalled()
  })

  it('TC-061-b: applyHighlights is called with empty characterMap when extractSelection returns empty', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    listener(
      {
        type: 'SHOW_ANNOTATIONS',
        payload: {
          annotations: [baseAnnotation],
          settings: baseSettings,
          selectionAnalysisMode: 'selection',
        },
      },
      {},
      sendResponse,
    )
    // ISS-006 not implemented
    expect(mockApplyHighlights).toHaveBeenCalledWith(
      expect.any(Array),
      [],
      '#FFFF00',
    )
  })

  it('TC-061-c: no exception thrown when selection cleared before SHOW_ANNOTATIONS arrives', () => {
    const listener = getListener()
    const sendResponse = vi.fn()
    expect(() => {
      listener(
        {
          type: 'SHOW_ANNOTATIONS',
          payload: {
            annotations: [],
            settings: baseSettings,
            selectionAnalysisMode: 'selection',
          },
        },
        {},
        sendResponse,
      )
    }).not.toThrow()
  })
})
