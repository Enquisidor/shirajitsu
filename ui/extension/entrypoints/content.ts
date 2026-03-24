import type { AnalyzeRequest, AnalyzeResponse, UserSettings } from '@shirajitsu/types'
import { detectContext } from '@/context/detector'
import { extractText } from '@/context/extractor'
import { applyHighlights, clearHighlights } from '@/highlight/inline-highlighter'

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    const context = detectContext()

    // Listen for commands from the popup / sidebar
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'GET_CONTEXT') {
        sendResponse({ context })
        return
      }

      if (message.type === 'RUN_ANALYSIS') {
        runAnalysis(context.mode).then(sendResponse)
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
        return
      }

      if (message.type === 'CLEAR_ANNOTATIONS') {
        clearHighlights()
        return
      }
    })
  },
})

async function runAnalysis(mode: 'writer' | 'reader') {
  const { text } = extractText(mode, null)
  if (!text.trim()) {
    return { error: 'No text found to analyze.' }
  }

  const request: AnalyzeRequest = { text, context: mode }
  return chrome.runtime.sendMessage({ type: 'ANALYZE_TEXT', payload: request })
}
