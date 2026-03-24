import type { AnalyzeRequest, AnalyzeResponse } from '@shirajitsu/types'

export async function handleAnalyze(
  request: AnalyzeRequest,
): Promise<AnalyzeResponse | { error: string }> {
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
