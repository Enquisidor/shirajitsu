/**
 * handler.test.ts
 *
 * Tests: TC-014 (Part B), TC-015, TC-016, TC-018, TC-019
 * Feature area: ExtensionAuth — background handler Clerk JWT plumbing
 * Issue: ISS-003
 * Session: ext-auth-2026-05-11
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Mock chrome APIs — not available in Node/jsdom
// ---------------------------------------------------------------------------

const mockStorageGet = vi.fn()
const mockStorageSet = vi.fn()

vi.stubGlobal('chrome', {
  storage: {
    sync: {
      get: mockStorageGet,
      set: mockStorageSet,
    },
  },
  runtime: {
    lastError: undefined,
  },
})

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ---------------------------------------------------------------------------
// Mock @clerk/chrome-extension — background Clerk instance
//
// After ISS-003, handler.ts must import a Clerk instance from somewhere in
// the background context and call clerk.session?.getToken(). We mock the
// module that provides this instance.
//
// The implementation agent will create the clerk instance export. We mock
// what the spec requires: a clerk object with a session property that has
// getToken(). If the file is structured differently (e.g., exported as
// `clerkInstance`), the implementation must match these expectations.
// ---------------------------------------------------------------------------

// vi.hoisted() ensures these variables are initialized before vi.mock() factory runs.
// vi.mock() is hoisted to the top of the file by Vitest — any variables it references
// must be declared via vi.hoisted() or they'll be uninitialized when the factory executes.
const { mockGetToken, mockClerkSession, mockClerkInstance } = vi.hoisted(() => {
  const mockGetToken = vi.fn()
  const mockClerkSession = { getToken: mockGetToken }
  const mockClerkInstance: { session: { getToken: typeof mockGetToken } | null } = {
    session: mockClerkSession,
  }
  return { mockGetToken, mockClerkSession, mockClerkInstance }
})

// Mock the background clerk module (the file that will export the clerk instance)
// After ISS-003, handler.ts imports from a module that provides the clerk instance.
// We mock @clerk/chrome-extension/background to intercept __unstable__createClerkClient.
vi.mock('@clerk/chrome-extension/background', () => ({
  __unstable__createClerkClient: vi.fn().mockReturnValue(mockClerkInstance),
}))

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are established
// ---------------------------------------------------------------------------

import { handleAnalyze } from './handler'

// ---------------------------------------------------------------------------
// TC-014 (Part B): Handler returns auth error without fetching when clerk.session is null
// ---------------------------------------------------------------------------

describe('TC-014-B: Handler blocks analysis when clerk.session is null', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation(
      (_keys: string[], cb: (v: Record<string, unknown>) => void) =>
        cb({ gatewayUrl: 'https://gateway.example.com' }),
    )
    // clerk.session is null — no active session
    mockClerkInstance.session = null
  })

  afterEach(() => {
    // Restore session for other tests
    mockClerkInstance.session = mockClerkSession
  })

  it('TC-014-B-i: sendResponse called with auth error when clerk.session is null', async () => {
    const sendResponse = vi.fn()
    await handleAnalyze(
      { type: 'ANALYZE_TEXT', payload: { text: 'Test claim text', context: 'reader' } } as unknown as Parameters<typeof handleAnalyze>[0],
      sendResponse,
    )
    expect(sendResponse).toHaveBeenCalledWith({ error: 'Not authenticated. Please sign in.' })
  })

  it('TC-014-B-ii: fetch is NOT called when clerk.session is null', async () => {
    const sendResponse = vi.fn()
    await handleAnalyze(
      { type: 'ANALYZE_TEXT', payload: { text: 'Test claim text', context: 'reader' } } as unknown as Parameters<typeof handleAnalyze>[0],
      sendResponse,
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('TC-014-B-iii: no unhandled promise rejection when clerk.session is null', async () => {
    const sendResponse = vi.fn()
    // Should resolve without throwing
    await expect(
      handleAnalyze(
        { type: 'ANALYZE_TEXT', payload: { text: 'Test claim text', context: 'reader' } } as unknown as Parameters<typeof handleAnalyze>[0],
        sendResponse,
      ),
    ).resolves.not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// TC-015: Analysis request carries a valid Clerk JWT in the Authorization header
// ---------------------------------------------------------------------------

describe('TC-015: handleAnalyze places Clerk JWT in Authorization header', () => {
  const MOCK_JWT = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test-payload.signature'

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation(
      (_keys: string[], cb: (v: Record<string, unknown>) => void) =>
        cb({ gatewayUrl: 'https://gateway.example.com' }),
    )
    mockClerkInstance.session = mockClerkSession
    mockGetToken.mockResolvedValue(MOCK_JWT)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ analysisId: 'test-id', annotations: [] }),
    })
  })

  it('TC-015-a: fetch is called exactly once', async () => {
    const sendResponse = vi.fn()
    await handleAnalyze(
      { type: 'ANALYZE_TEXT', payload: { text: 'Test claim text', context: 'reader' } } as unknown as Parameters<typeof handleAnalyze>[0],
      sendResponse,
    )
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('TC-015-b: fetch URL is the gatewayUrl with /v1/analyze appended', async () => {
    const sendResponse = vi.fn()
    await handleAnalyze(
      { type: 'ANALYZE_TEXT', payload: { text: 'Test claim text', context: 'reader' } } as unknown as Parameters<typeof handleAnalyze>[0],
      sendResponse,
    )
    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('https://gateway.example.com/v1/analyze')
  })

  it('TC-015-c: Authorization header equals "Bearer <jwt>" exactly', async () => {
    const sendResponse = vi.fn()
    await handleAnalyze(
      { type: 'ANALYZE_TEXT', payload: { text: 'Test claim text', context: 'reader' } } as unknown as Parameters<typeof handleAnalyze>[0],
      sendResponse,
    )
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers['Authorization']).toBe(`Bearer ${MOCK_JWT}`)
  })

  it('TC-015-d: sendResponse called with a success payload', async () => {
    const sendResponse = vi.fn()
    await handleAnalyze(
      { type: 'ANALYZE_TEXT', payload: { text: 'Test claim text', context: 'reader' } } as unknown as Parameters<typeof handleAnalyze>[0],
      sendResponse,
    )
    const responseArg = sendResponse.mock.calls[0][0]
    expect(responseArg).not.toHaveProperty('error')
  })
})

// ---------------------------------------------------------------------------
// TC-016: chrome.storage.sync['userToken'] is NOT read in handler.ts or index.ts
// ---------------------------------------------------------------------------

describe('TC-016: userToken is not read from chrome.storage.sync', () => {
  const HANDLER_PATH = path.resolve(__dirname, 'handler.ts')
  const INDEX_PATH = path.resolve(__dirname, 'index.ts')

  it('TC-016-a: handler.ts does not access userToken as a storage key', () => {
    const source = fs.readFileSync(HANDLER_PATH, 'utf-8')
    // Must not contain userToken as a storage key access
    // Patterns: 'userToken', "userToken", ['userToken'], .userToken
    expect(source).not.toMatch(/['"`]userToken['"`]/)
    expect(source).not.toMatch(/\.userToken\b/)
  })

  it('TC-016-b: index.ts does not access userToken as a storage key', () => {
    const source = fs.readFileSync(INDEX_PATH, 'utf-8')
    expect(source).not.toMatch(/['"`]userToken['"`]/)
    expect(source).not.toMatch(/\.userToken\b/)
  })

  it('TC-016-c: gatewayUrl storage read is still present in handler.ts', () => {
    const source = fs.readFileSync(HANDLER_PATH, 'utf-8')
    expect(source).toMatch(/gatewayUrl/)
  })
})

// ---------------------------------------------------------------------------
// TC-018: handleAnalyze returns auth error without fetching when getToken() returns null
// ---------------------------------------------------------------------------

describe('TC-018: handleAnalyze blocks analysis when getToken() returns null', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation(
      (_keys: string[], cb: (v: Record<string, unknown>) => void) =>
        cb({ gatewayUrl: 'https://gateway.example.com' }),
    )
    // clerk.session exists but getToken() returns null (expired/invalid token)
    mockClerkInstance.session = mockClerkSession
    mockGetToken.mockResolvedValue(null)
  })

  it('TC-018-a: fetch is NOT called when getToken() returns null', async () => {
    const sendResponse = vi.fn()
    await handleAnalyze(
      { type: 'ANALYZE_TEXT', payload: { text: 'Test claim text', context: 'reader' } } as unknown as Parameters<typeof handleAnalyze>[0],
      sendResponse,
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('TC-018-b: sendResponse called with auth error when getToken() returns null', async () => {
    const sendResponse = vi.fn()
    await handleAnalyze(
      { type: 'ANALYZE_TEXT', payload: { text: 'Test claim text', context: 'reader' } } as unknown as Parameters<typeof handleAnalyze>[0],
      sendResponse,
    )
    expect(sendResponse).toHaveBeenCalledWith({ error: 'Not authenticated. Please sign in.' })
  })

  it('TC-018-c: no unhandled promise rejection when getToken() returns null', async () => {
    const sendResponse = vi.fn()
    await expect(
      handleAnalyze(
        { type: 'ANALYZE_TEXT', payload: { text: 'Test claim text', context: 'reader' } } as unknown as Parameters<typeof handleAnalyze>[0],
        sendResponse,
      ),
    ).resolves.not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// TC-019: gatewayUrl storage read is preserved after ISS-003 changes
// ---------------------------------------------------------------------------

describe('TC-019: gatewayUrl is still read from chrome.storage.sync after ISS-003 changes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClerkInstance.session = mockClerkSession
    mockGetToken.mockResolvedValue('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.valid-jwt.signature')
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ analysisId: 'test-id', annotations: [] }),
    })
  })

  it('TC-019: fetch is called with gatewayUrl from chrome.storage.sync', async () => {
    mockStorageGet.mockImplementation(
      (_keys: string[], cb: (v: Record<string, unknown>) => void) =>
        cb({ gatewayUrl: 'https://gateway.example.com' }),
    )
    const sendResponse = vi.fn()
    await handleAnalyze(
      { type: 'ANALYZE_TEXT', payload: { text: 'Test claim text', context: 'reader' } } as unknown as Parameters<typeof handleAnalyze>[0],
      sendResponse,
    )
    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('https://gateway.example.com/v1/analyze')
  })
})
