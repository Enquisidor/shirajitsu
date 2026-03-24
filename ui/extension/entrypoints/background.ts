import type { AnalyzeRequest, AnalyzeResponse } from '@shirajitsu/types'

export default defineBackground(() => {
  // Open side panel when extension icon is clicked
  chrome.action.onClicked.addListener((tab) => {
    if (tab.id) {
      chrome.sidePanel.open({ tabId: tab.id })
    }
  })

  // Route messages from content scripts and popup to the API gateway
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'ANALYZE_TEXT') {
      handleAnalyze(message.payload as AnalyzeRequest)
        .then(sendResponse)
        .catch((err: unknown) => sendResponse({ error: String(err) }))
      return true // keep channel open for async response
    }
  })
})

async function handleAnalyze(request: AnalyzeRequest): Promise<AnalyzeResponse | { error: string }> {
  const settings = await chrome.storage.sync.get(['gatewayUrl', 'userToken'])
  const gatewayUrl = (settings.gatewayUrl as string | undefined) ?? 'https://api.shirajitsu.com'
  const token = settings.userToken as string | undefined

  if (!token) {
    return { error: 'Not authenticated. Please sign in.' }
  }

  const res = await fetch(`${gatewayUrl}/v1/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  })

  if (!res.ok) {
    return { error: `Gateway error: ${res.status}` }
  }

  return res.json() as Promise<AnalyzeResponse>
}
