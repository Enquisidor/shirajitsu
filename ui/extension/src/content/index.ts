import type { AIModel, AnalyzeRequest, AnalyzeResponse, UserSettings } from '@shirajitsu/types'
import { detectContext } from '../context/detector'
import { extractText } from '../context/extractor'
import { applyHighlights, clearHighlights } from '../highlight/inline-highlighter'

const context = detectContext()

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_CONTEXT') {
    sendResponse({ context })
    return false
  }

  if (message.type === 'RUN_ANALYSIS') {
    runAnalysis().then(sendResponse).catch((err: unknown) => {
      sendResponse({ error: String(err) })
    })
    return true
  }

  if (message.type === 'SHOW_ANNOTATIONS') {
    const { annotations, settings } = message.payload as {
      annotations: AnalyzeResponse['annotations']
      settings: UserSettings
    }
    if (settings.displayMode === 'inline') {
      const { characterMap } = extractText(context.mode, context.editorType)
      applyHighlights(annotations, characterMap)
    }
    return false
  }

  if (message.type === 'CLEAR_ANNOTATIONS') {
    clearHighlights()
    return false
  }

  return false
})

async function runAnalysis(): Promise<{ error: string } | AnalyzeResponse> {
  const { text } = extractText(context.mode, context.editorType)
  if (!text.trim()) return { error: 'No text found to analyze.' }

  const settings = await chrome.storage.sync.get(['selectedModel'])
  const request: AnalyzeRequest = {
    text,
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
      resolve(response as AnalyzeResponse | { error: string })
    })
  })
}
