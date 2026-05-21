import type { AIModel, AnalyzeRequest, AnalyzeResponse, UserSettings } from '@shirajitsu/types'
import { detectContext } from '../context/detector'
import { extractText, extractSelection } from '../context/extractor'
import { applyHighlights, clearHighlights } from '../highlight/inline-highlighter'

const context = detectContext()

// ---------------------------------------------------------------------------
// SelectionChange debounce — fires SELECTION_CHANGED after 150ms of inactivity
// ---------------------------------------------------------------------------

let selectionDebounceTimer: ReturnType<typeof setTimeout> | null = null

window.addEventListener('selectionchange', () => {
  if (selectionDebounceTimer !== null) {
    clearTimeout(selectionDebounceTimer)
  }
  selectionDebounceTimer = setTimeout(() => {
    selectionDebounceTimer = null
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return
    const text = selection.toString()
    if (!text.trim()) return
    chrome.runtime.sendMessage({ type: 'SELECTION_CHANGED', text }, () => {
      void chrome.runtime.lastError
    })
  }, 150)
})

// ---------------------------------------------------------------------------
// Message listener
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_CONTEXT') {
    const selectionContext = buildSelectionContext()
    sendResponse({ context, selection: selectionContext })
    return false
  }

  if (message.type === 'RUN_ANALYSIS') {
    const selectionMode: 'selection' | 'whole-page' =
      message.selectionMode === 'selection' ? 'selection' : 'whole-page'
    runAnalysis(selectionMode).then(sendResponse).catch((err: unknown) => {
      sendResponse({ error: String(err) })
    })
    return true
  }

  if (message.type === 'SHOW_ANNOTATIONS') {
    const payload = message.payload as {
      annotations: AnalyzeResponse['annotations']
      settings: UserSettings & { highlightColor?: string }
      selectionAnalysisMode?: 'selection' | 'whole-page'
    }
    const { annotations, settings } = payload
    const selectionAnalysisMode = payload.selectionAnalysisMode ?? 'whole-page'
    const highlightColor = settings.highlightColor ?? '#FFFF00'

    if (settings.displayMode === 'inline') {
      let characterMap: ReturnType<typeof extractText>['characterMap']
      if (selectionAnalysisMode === 'selection') {
        const extracted = extractSelection()
        characterMap = extracted.characterMap
      } else {
        const extracted = extractText(context.mode, context.editorType)
        characterMap = extracted.characterMap
      }
      applyHighlights(annotations, characterMap, highlightColor)
    }
    return false
  }

  if (message.type === 'CLEAR_ANNOTATIONS') {
    clearHighlights()
    return false
  }

  return false
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a SelectionContext from the current window.getSelection().
 * Returns null when there is no meaningful selection.
 */
function buildSelectionContext(): { text: string; wordCount: number } | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return null

  const text = selection.toString()
  if (!text.trim()) return null

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  return { text, wordCount }
}

async function runAnalysis(
  selectionMode: 'selection' | 'whole-page',
): Promise<{ error: string; selectionAnalysisMode?: string } | (AnalyzeResponse & { selectionAnalysisMode: string })> {
  let analysisText: string

  if (selectionMode === 'selection') {
    const extracted = extractSelection()
    analysisText = extracted.text
  } else {
    const { text } = extractText(context.mode, context.editorType)
    analysisText = text
  }

  if (!analysisText.trim()) return { error: 'No text found to analyze.', selectionAnalysisMode: selectionMode }

  const settings = await chrome.storage.sync.get(['selectedModel'])
  const request: AnalyzeRequest = {
    text: analysisText,
    context: context.mode,
    model: settings.selectedModel as AIModel | undefined,
  }

  // Use the callback form of chrome.runtime.sendMessage rather than the Promise
  // form. In MV3 service-worker environments the Promise-based form can resolve
  // with undefined when the SW is cold or when sendResponse is called
  // asynchronously, silently discarding the actual response value. The callback
  // form always delivers the response exactly as sendResponse received it, and
  // populates chrome.runtime.lastError when the channel is closed without a reply.
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'ANALYZE_TEXT', payload: request }, (response) => {
      if (chrome.runtime.lastError) {
        // Consume lastError to suppress Chrome's uncaught-error console warning,
        // then reject with a user-friendly message. Never expose raw Chrome API
        // error strings (e.g. "Could not establish connection. Receiving end does
        // not exist.") — these propagate up through sendResponse to the popup's
        // broadcastError and would be displayed verbatim in the sidebar.
        void chrome.runtime.lastError.message
        reject(new Error('Could not reach the analysis service. Try reloading the tab and clicking Analyze again.'))
        return
      }
      const result = response as AnalyzeResponse | { error: string }
      resolve({ ...result, selectionAnalysisMode: selectionMode })
    })
  })
}
