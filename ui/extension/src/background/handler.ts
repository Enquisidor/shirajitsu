import { __unstable__createClerkClient } from '@clerk/chrome-extension/background'
import type { AnalyzeRequest, AnalyzeResponse } from '@shirajitsu/types'

// Initialize the Clerk instance once for the background service worker context.
// Session state is shared via Chrome storage APIs managed by the Clerk SDK —
// the background instance and the popup ClerkProvider share the same underlying session.
const clerkPromise = __unstable__createClerkClient({
  publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
})

export async function handleAnalyze(
  message: Record<string, unknown>,
  sendResponse: (result: AnalyzeResponse | { error: string }) => void,
): Promise<void> {
  const settings = await new Promise<Record<string, unknown>>((resolve) => {
    chrome.storage.sync.get(['gatewayUrl'], (items) => resolve(items))
  })
  const gatewayUrl = (settings.gatewayUrl as string | undefined) ?? 'https://api.shirajitsu.com'

  const clerk = await clerkPromise
  const token = (await clerk.session?.getToken()) ?? null

  if (!token) {
    sendResponse({ error: 'Not authenticated. Please sign in.' })
    return
  }

  const payload = (message.payload ?? {}) as AnalyzeRequest

  const res = await fetch(`${gatewayUrl}/v1/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    sendResponse({ error: `Gateway error: ${res.status}` })
    return
  }

  sendResponse((await res.json()) as AnalyzeResponse)
}
