import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ShirajitsuClient, ShirajitsuError } from './client'
import type { AnalyzeResponse } from '@shirajitsu/types'

const mockResponse: AnalyzeResponse = {
  analysisId: 'test-123',
  registryVersion: '1.0.0',
  annotations: [],
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ShirajitsuClient', () => {
  it('sends API key in request header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )
    const client = new ShirajitsuClient({ apiKey: 'sk-test', gatewayUrl: 'https://test.api' })
    await client.analyze('Some text')

    const [, init] = fetchSpy.mock.calls[0]!
    const headers = init?.headers as Record<string, string>
    expect(headers['X-API-Key']).toBe('sk-test')
  })

  it('includes platformUserId when set', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )
    const client = new ShirajitsuClient({ apiKey: 'sk-test', platformUserId: 'user-abc', gatewayUrl: 'https://test.api' })
    await client.analyze('Some text')

    const [, init] = fetchSpy.mock.calls[0]!
    const body = JSON.parse(init?.body as string)
    expect(body.platformUserId).toBe('user-abc')
  })

  it('throws ShirajitsuError on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'RATE_LIMITED', message: 'Too many requests', retryable: true }), { status: 429 }),
    )
    const client = new ShirajitsuClient({ apiKey: 'sk-test', gatewayUrl: 'https://test.api' })
    await expect(client.analyze('text')).rejects.toThrow(ShirajitsuError)
  })

  it('forUser returns client scoped to that user', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )
    const client = new ShirajitsuClient({ apiKey: 'sk-test', gatewayUrl: 'https://test.api' })
    await client.forUser('user-xyz').analyze('text')

    const [, init] = fetchSpy.mock.calls[0]!
    const body = JSON.parse(init?.body as string)
    expect(body.platformUserId).toBe('user-xyz')
  })
})
