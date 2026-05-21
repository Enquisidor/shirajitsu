import { handleAnalyze } from './handler'

// handler.ts initialises the background Clerk instance at module load time via
// __unstable__createClerkClient. That call happens when the handler module is
// imported above — before chrome.runtime.onMessage.addListener is registered.
// This ordering satisfies the ExtensionAuth requirement (DEC-013): the Clerk
// instance must be ready before any ANALYZE_TEXT message can be processed.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ANALYZE_TEXT') {
    handleAnalyze(message as Record<string, unknown>, sendResponse)
      .catch((err: unknown) => sendResponse({ error: String(err) }))
    return true // keep channel open for async response
  }
  return false
})
