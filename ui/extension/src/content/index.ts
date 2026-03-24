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
    runAnalysis().then(sendResponse)
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

async function runAnalysis() {
  const { text } = extractText(context.mode, context.editorType)
  if (!text.trim()) return { error: 'No text found to analyze.' }

  const settings = await chrome.storage.sync.get(['selectedModel'])
  const request: AnalyzeRequest = {
    text,
    context: context.mode,
    model: settings.selectedModel as AIModel | undefined,
  }
  return chrome.runtime.sendMessage({ type: 'ANALYZE_TEXT', payload: request })
}
