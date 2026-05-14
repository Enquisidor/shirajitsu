import { handleAnalyze } from './handler'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ANALYZE_TEXT') {
    handleAnalyze(message.payload)
      .then(sendResponse)
      .catch((err: unknown) => sendResponse({ error: String(err) }))
    return true // keep channel open for async response
  }
  return false
})
