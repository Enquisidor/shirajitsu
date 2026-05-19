/**
 * Popup.test.tsx
 *
 * Tests: TC-001 through TC-013
 * Feature area: ExtensionAuth — Clerk OAuth sign-in/sign-out and conditional rendering
 * Issues: ISS-001, ISS-002
 * Session: ext-auth-2026-05-11
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock @clerk/chrome-extension
// The Popup component (after ISS-001/ISS-002 implementation) must call
// useAuth() and useUser() from this package. We control the returned values
// per-test via the mockAuthState and mockUserState variables below.
// ---------------------------------------------------------------------------

const mockAuthState: {
  isSignedIn: boolean | undefined
  signOut: ReturnType<typeof vi.fn>
  openSignIn: ReturnType<typeof vi.fn>
} = {
  isSignedIn: false,
  signOut: vi.fn(),
  openSignIn: vi.fn(),
}

const mockUserState: {
  user: { fullName: string | null; primaryEmailAddress: { emailAddress: string } | null } | null
} = {
  user: null,
}

vi.mock('@clerk/chrome-extension', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    isSignedIn: mockAuthState.isSignedIn,
    signOut: mockAuthState.signOut,
    openSignIn: mockAuthState.openSignIn,
  }),
  useUser: () => ({
    user: mockUserState.user,
  }),
}))

// ---------------------------------------------------------------------------
// Mock chrome APIs — chrome is not available in jsdom
// ---------------------------------------------------------------------------

const mockStorageGet = vi.fn()
const mockStorageSet = vi.fn()
const mockStorageSessionSet = vi.fn()
const mockTabsQuery = vi.fn()
const mockTabsSendMessage = vi.fn()
const mockRuntimeSendMessage = vi.fn()
const mockSidePanelOpen = vi.fn()

vi.stubGlobal('chrome', {
  storage: {
    sync: {
      get: mockStorageGet,
      set: mockStorageSet,
    },
    session: {
      set: mockStorageSessionSet,
    },
  },
  tabs: {
    query: mockTabsQuery,
    sendMessage: mockTabsSendMessage,
  },
  runtime: {
    sendMessage: mockRuntimeSendMessage,
    lastError: undefined,
  },
  sidePanel: {
    open: mockSidePanelOpen,
  },
})

// ---------------------------------------------------------------------------
// Mock @shirajitsu/react — ModelSelector is rendered inside AnalyseView
// ---------------------------------------------------------------------------

vi.mock('@shirajitsu/react', () => ({
  ModelSelector: ({ value, onChange }: { value: string; onChange: (m: string) => void }) => (
    <select data-testid="model-selector" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
    </select>
  ),
}))

// ---------------------------------------------------------------------------
// Import the component under test AFTER mocks are established
// ---------------------------------------------------------------------------

import { Popup } from './Popup'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function setAuthState(
  isSignedIn: boolean | undefined,
  opts: {
    signOut?: ReturnType<typeof vi.fn>
    openSignIn?: ReturnType<typeof vi.fn>
  } = {},
) {
  mockAuthState.isSignedIn = isSignedIn
  if (opts.signOut) mockAuthState.signOut = opts.signOut
  if (opts.openSignIn) mockAuthState.openSignIn = opts.openSignIn
}

function setUserState(
  user: { fullName: string | null; primaryEmailAddress: { emailAddress: string } | null } | null,
) {
  mockUserState.user = user
}

// ---------------------------------------------------------------------------
// TC-001: ClerkProvider wraps popup — useAuth() and useUser() are available within <Popup />
// ---------------------------------------------------------------------------

describe('TC-001: ClerkProvider wraps popup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    setAuthState(false)
    setUserState(null)
  })

  it('TC-001: renders without throwing AND renders SignInPrompt (sign-in button present) when isSignedIn is false', () => {
    // After ISS-001 + ISS-002: Popup must call useAuth() and render conditionally.
    // The current implementation does not call useAuth() at all, so it renders
    // the analyse controls unconditionally regardless of auth state.
    // This test fails today because the sign-in button is never rendered.
    expect(() => render(<Popup />)).not.toThrow()
    // This assertion requires ISS-002 implementation — will fail against current Popup
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// TC-004: SignInPrompt shown when no ClerkSession is active
// ---------------------------------------------------------------------------

describe('TC-004: SignInPrompt shown when isSignedIn is false', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    setAuthState(false)
    setUserState(null)
  })

  it('TC-004-a: renders a "Sign in" button when isSignedIn is false', () => {
    render(<Popup />)
    // Fails today: current Popup does not render a Sign in button
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('TC-004-b: does NOT render the analyse CTA button when isSignedIn is false', () => {
    render(<Popup />)
    // The CTA button labels are "Analyze this article" or "Analyze my draft"
    // Fails today: current Popup renders the CTA unconditionally
    expect(screen.queryByRole('button', { name: /analyze this article|analyze my draft/i })).toBeNull()
  })

  it('TC-004-c: does NOT render the mode selector when isSignedIn is false', () => {
    render(<Popup />)
    // Mode selector buttons "Reader" / "Writer" must be absent in SignInPrompt
    // Fails today: current Popup renders mode buttons unconditionally
    expect(screen.queryByRole('button', { name: /^reader$/i })).toBeNull()
  })

  it('TC-004-d: does NOT render the model selector when isSignedIn is false', () => {
    render(<Popup />)
    // Fails today: current Popup renders model selector unconditionally
    expect(screen.queryByTestId('model-selector')).toBeNull()
  })

  it('TC-004-e: does NOT render the sidebar button when isSignedIn is false', () => {
    render(<Popup />)
    // "Open Sidebar" button must be absent in SignInPrompt
    // Fails today: current Popup renders it unconditionally
    expect(screen.queryByRole('button', { name: /open sidebar/i })).toBeNull()
  })

  it('TC-004-f: does NOT render the display toggle when isSignedIn is false', () => {
    render(<Popup />)
    // Display toggle has "Sidebar" and "Inline" buttons — must be absent in SignInPrompt
    // Fails today: current Popup renders them unconditionally
    expect(screen.queryByRole('button', { name: /^inline$/i })).toBeNull()
  })

  it('TC-004-g: does NOT render a "Sign out" button AND renders a "Sign in" button when isSignedIn is false', () => {
    render(<Popup />)
    // No sign out button (already true) PLUS sign-in button must be present (not true today)
    // The positive assertion about sign-in ensures this test fails pre-implementation
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// TC-005: AnalyseView not rendered when isSignedIn is undefined (loading state)
// ---------------------------------------------------------------------------

describe('TC-005: Loading state — analyse controls absent when isSignedIn is undefined', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    setAuthState(undefined)
    setUserState(null)
  })

  it('TC-005-a: does NOT render analyse CTA button when isSignedIn is undefined', () => {
    render(<Popup />)
    // Fails today: current Popup renders the CTA unconditionally (no auth gate)
    expect(screen.queryByRole('button', { name: /analyze this article|analyze my draft/i })).toBeNull()
  })

  it('TC-005-b: does NOT render mode selector when isSignedIn is undefined', () => {
    render(<Popup />)
    // Fails today: current Popup renders mode buttons unconditionally
    expect(screen.queryByRole('button', { name: /^reader$/i })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// TC-006: Clicking "Sign in" launches Clerk OAuth popup
// ---------------------------------------------------------------------------

describe('TC-006: Clicking "Sign in" calls openSignIn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    setAuthState(false, { openSignIn: vi.fn() })
    setUserState(null)
  })

  it('TC-006-a: clicking "Sign in" calls openSignIn exactly once', () => {
    render(<Popup />)
    // This test will fail at getByRole because the sign-in button doesn't exist yet.
    const signInButton = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(signInButton)
    expect(mockAuthState.openSignIn).toHaveBeenCalledTimes(1)
  })

  it('TC-006-b: clicking "Sign in" does NOT navigate away (window.location unchanged)', () => {
    const originalHref = window.location.href
    render(<Popup />)
    // This test will fail at getByRole because the sign-in button doesn't exist yet.
    const signInButton = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(signInButton)
    expect(window.location.href).toBe(originalHref)
  })
})

// ---------------------------------------------------------------------------
// TC-007: Popup transitions to AnalyseView after successful Clerk OAuth flow
// ---------------------------------------------------------------------------

describe('TC-007: Popup transitions to AnalyseView after sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
  })

  it('TC-007-a: AnalyseView rendered with CTA button after isSignedIn transitions to true', () => {
    setAuthState(false)
    setUserState(null)
    const { rerender } = render(<Popup />)

    // Before sign-in: no CTA
    expect(screen.queryByRole('button', { name: /analyze this article|analyze my draft/i })).toBeNull()

    // Simulate sign-in success: update mock state and re-render
    act(() => {
      setAuthState(true)
      setUserState({
        fullName: 'Test User',
        primaryEmailAddress: { emailAddress: 'test@example.com' },
      })
    })
    rerender(<Popup />)

    // After sign-in: CTA must be present (fails today: CTA was always present)
    expect(
      screen.getByRole('button', { name: /analyze this article|analyze my draft/i }),
    ).toBeInTheDocument()
  })

  it('TC-007-b: "Sign in" button absent AND "Sign out" button present after isSignedIn transitions to true', () => {
    // The second assertion (sign-out button present) requires ISS-002 — fails today
    setAuthState(false)
    setUserState(null)
    const { rerender } = render(<Popup />)

    act(() => {
      setAuthState(true)
      setUserState({
        fullName: 'Test User',
        primaryEmailAddress: { emailAddress: 'test@example.com' },
      })
    })
    rerender(<Popup />)

    // After sign-in: no sign-in button (was already absent in current impl, but combined with:)
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull()
    // Sign-out button must be present in AnalyseView — fails today
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// TC-008: SignedInIdentity displays user.fullName when set
// ---------------------------------------------------------------------------

describe('TC-008: SignedInIdentity shows fullName when available', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    setAuthState(true)
    setUserState({
      fullName: 'Alex Weinstein',
      primaryEmailAddress: { emailAddress: 'alex@example.com' },
    })
  })

  it('TC-008-a: renders fullName "Alex Weinstein" in AnalyseView', () => {
    render(<Popup />)
    // Fails today: current Popup renders no identity at all
    expect(screen.getByText('Alex Weinstein')).toBeInTheDocument()
  })

  it('TC-008-b: does NOT display email as primary identity when fullName is set AND fullName IS displayed', () => {
    render(<Popup />)
    // fullName must be shown (fails today — not rendered at all)
    expect(screen.getByText('Alex Weinstein')).toBeInTheDocument()
    // Email must NOT be the primary identity — verified after confirming fullName is shown
    expect(screen.queryByText('alex@example.com')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// TC-009: SignedInIdentity falls back to primaryEmailAddress when fullName is empty
// ---------------------------------------------------------------------------

describe('TC-009: SignedInIdentity falls back to email when fullName is empty string', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    setAuthState(true)
    setUserState({
      fullName: '',
      primaryEmailAddress: { emailAddress: 'alex@example.com' },
    })
  })

  it('TC-009: renders primaryEmailAddress when fullName is empty string', () => {
    render(<Popup />)
    // Fails today: current Popup renders no identity
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// TC-010: SignedInIdentity falls back to primaryEmailAddress when fullName is null
// ---------------------------------------------------------------------------

describe('TC-010: SignedInIdentity falls back to email when fullName is null', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    setAuthState(true)
    setUserState({
      fullName: null,
      primaryEmailAddress: { emailAddress: 'alex@example.com' },
    })
  })

  it('TC-010: renders primaryEmailAddress when fullName is null', () => {
    render(<Popup />)
    // Fails today: current Popup renders no identity
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// TC-011: Signed-in state shown on popup open when a prior Clerk session exists
// ---------------------------------------------------------------------------

describe('TC-011: AnalyseView rendered immediately when session already active on mount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    // Simulate persisted session: isSignedIn is true on initial mount
    setAuthState(true)
    setUserState({
      fullName: 'Returning User',
      primaryEmailAddress: { emailAddress: 'user@example.com' },
    })
  })

  it('TC-011-a: AnalyseView rendered immediately on mount when isSignedIn is already true', () => {
    render(<Popup />)
    // Fails today: the "Analyse this article" label appears in current Popup but not via AnalyseView auth gate
    // More specifically: current Popup doesn't check auth, so the CTA shows for wrong reason.
    // The test also asserts the signed-in identity is displayed — which does NOT exist today.
    expect(screen.getByText('Returning User')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /analyze this article|analyze my draft/i }),
    ).toBeInTheDocument()
  })

  it('TC-011-b: SignInPrompt is NOT rendered AND user identity IS displayed when session is active', () => {
    render(<Popup />)
    // The positive assertion about user identity requires ISS-002 — fails today
    expect(screen.getByText('Returning User')).toBeInTheDocument()
    // No sign-in button (was already absent, but combined with above positive assertion)
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// TC-012: "Sign out" button is visible in AnalyseView
// ---------------------------------------------------------------------------

describe('TC-012: Sign out button visible in AnalyseView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    setAuthState(true)
    setUserState({
      fullName: 'Test User',
      primaryEmailAddress: { emailAddress: 'test@example.com' },
    })
  })

  it('TC-012: "Sign out" button is present in AnalyseView', () => {
    render(<Popup />)
    // Fails today: current Popup never renders a Sign out button
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// TC-013: Clicking "Sign out" calls Clerk signOut() and popup returns to SignInPrompt
// ---------------------------------------------------------------------------

describe('TC-013: Clicking "Sign out" calls signOut() and returns to SignInPrompt', () => {
  it('TC-013-a: clicking "Sign out" calls Clerk signOut() exactly once', async () => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    const mockSignOut = vi.fn().mockResolvedValue(undefined)
    setAuthState(true, { signOut: mockSignOut })
    setUserState({ fullName: 'Test User', primaryEmailAddress: { emailAddress: 'test@example.com' } })

    render(<Popup />)
    // Fails today: no sign-out button exists
    const signOutButton = screen.getByRole('button', { name: /sign out/i })
    await act(async () => {
      fireEvent.click(signOutButton)
    })

    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('TC-013-b: popup shows SignInPrompt after signOut resolves and isSignedIn becomes false', async () => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    const mockSignOut = vi.fn().mockResolvedValue(undefined)
    setAuthState(true, { signOut: mockSignOut })
    setUserState({ fullName: 'Test User', primaryEmailAddress: { emailAddress: 'test@example.com' } })

    const { rerender } = render(<Popup />)

    // Fails today: no sign-out button exists
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    })

    // Simulate Clerk resolving signOut and setting isSignedIn: false
    act(() => {
      setAuthState(false)
      setUserState(null)
    })
    rerender(<Popup />)

    // Should now show SignInPrompt
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('TC-013-c: "Sign out" button absent after state transitions to signed-out', async () => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    const mockSignOut = vi.fn().mockResolvedValue(undefined)
    setAuthState(true, { signOut: mockSignOut })
    setUserState({ fullName: 'Test User', primaryEmailAddress: { emailAddress: 'test@example.com' } })

    const { rerender } = render(<Popup />)

    // Fails today: no sign-out button exists to click
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    })

    act(() => {
      setAuthState(false)
      setUserState(null)
    })
    rerender(<Popup />)

    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
  })
})
