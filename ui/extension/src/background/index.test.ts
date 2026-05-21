/**
 * index.test.ts
 *
 * Tests: TC-017, TC-020
 * Feature area: ExtensionAuth — background service worker Clerk initialisation
 * Issue: ISS-003
 * Session: ext-auth-2026-05-11
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock chrome APIs
// ---------------------------------------------------------------------------

const mockOnMessageAddListener = vi.fn()
const mockStorageGet = vi.fn()
const mockStorageSet = vi.fn()

vi.stubGlobal('chrome', {
  runtime: {
    onMessage: {
      addListener: mockOnMessageAddListener,
    },
    lastError: undefined,
  },
  storage: {
    sync: {
      get: mockStorageGet,
      set: mockStorageSet,
    },
  },
})

// ---------------------------------------------------------------------------
// Mock @clerk/chrome-extension/background
//
// After ISS-003, background/index.ts must call __unstable__createClerkClient
// (or equivalent background Clerk API) with the publishableKey before
// registering the onMessage listener. We capture the call order here.
// ---------------------------------------------------------------------------

const callOrder: string[] = []
const mockCreateClerkClient = vi.fn().mockImplementation(() => {
  callOrder.push('createClerkClient')
  return {
    session: {
      getToken: vi.fn().mockResolvedValue('mock-token'),
    },
  }
})

vi.mock('@clerk/chrome-extension/background', () => ({
  __unstable__createClerkClient: mockCreateClerkClient,
}))

// ---------------------------------------------------------------------------
// Intercept chrome.runtime.onMessage.addListener to capture call order
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset module cache so each test re-executes index.ts (and handler.ts) from
  // scratch — otherwise ES module caching means __unstable__createClerkClient
  // and addListener only run on the first import, making callOrder empty in
  // subsequent tests. vi.mock() registrations persist across resets.
  vi.resetModules()
  callOrder.length = 0
  vi.clearAllMocks()
  mockOnMessageAddListener.mockImplementation(() => {
    callOrder.push('onMessage.addListener')
  })
  mockStorageGet.mockImplementation(
    (_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}),
  )
})

// ---------------------------------------------------------------------------
// TC-017: Background Clerk instance initialised with VITE_CLERK_PUBLISHABLE_KEY
// ---------------------------------------------------------------------------

describe('TC-017: Background Clerk instance initialised with VITE_CLERK_PUBLISHABLE_KEY', () => {
  it('TC-017-a: Clerk initialisation call receives publishableKey from VITE_CLERK_PUBLISHABLE_KEY', async () => {
    // Import the background index module. After ISS-003 this must call
    // __unstable__createClerkClient with the publishable key.
    // We use a dynamic import with a cache-busting trick to re-execute the module.
    await import('./index')

    // The Clerk init must have been called with the publishable key
    expect(mockCreateClerkClient).toHaveBeenCalled()
    const callArgs = mockCreateClerkClient.mock.calls[0][0]
    expect(callArgs).toMatchObject({ publishableKey: expect.stringMatching(/^pk_/) })
  })

  it('TC-017-b: Clerk instance is initialised before onMessage listener is registered', async () => {
    // Re-import to re-execute the module initialization
    // The callOrder array captures the sequence
    await import('./index')

    const clerkInitIdx = callOrder.indexOf('createClerkClient')
    const listenerIdx = callOrder.indexOf('onMessage.addListener')

    // Both must appear (Clerk init before listener)
    expect(clerkInitIdx).toBeGreaterThanOrEqual(0)
    expect(listenerIdx).toBeGreaterThanOrEqual(0)
    expect(clerkInitIdx).toBeLessThan(listenerIdx)
  })
})

// ---------------------------------------------------------------------------
// TC-020: ISS-003 changes do not break existing ui/extension Vitest tests
//
// This test is a meta-regression guard. It verifies that the background
// index module can be loaded without throwing — which confirms the Clerk
// mock is appropriately configured for the test suite. If this module
// throws on import (due to an uncaught error in background init), all
// other tests in this suite would also fail, which would be a test setup
// regression rather than an implementation regression.
// ---------------------------------------------------------------------------

describe('TC-020: Background index module loads without throwing', () => {
  it('TC-020: importing background/index does not throw', async () => {
    await expect(import('./index')).resolves.not.toThrow()
  })

  it('TC-020-b: chrome.runtime.onMessage.addListener is called on module load', async () => {
    await import('./index')
    // After ISS-003, the background must register a message listener
    expect(mockOnMessageAddListener).toHaveBeenCalled()
  })
})
