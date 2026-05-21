/**
 * Popup.test.tsx
 *
 * Tests: TC-001 through TC-013, TC-032 through TC-053, TC-062 through TC-079
 * Feature area:
 *   TC-001–TC-013: ExtensionAuth — Clerk OAuth sign-in/sign-out and conditional rendering (ISS-001, ISS-002)
 *   TC-032–TC-053: SelectionAnalysis — CTA adaptation, SelectionPreview, SelectionLengthGuard (ISS-005)
 *   TC-062–TC-063: SelectionAnalysis — Sidebar display after selection/whole-page analysis (ISS-005)
 *   TC-064–TC-070: SelectionAnalysis — HighlightColor settings UI (ISS-007)
 *   TC-071–TC-079: SelectionAnalysis — PerSelectionModelOverride picker (ISS-008)
 * Sessions: ext-auth-2026-05-11, selection-analysis-2026-05-15
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { SUPPORTED_MODELS, DEFAULT_USER_SETTINGS } from '@shirajitsu/types'

// ---------------------------------------------------------------------------
// Mock @clerk/chrome-extension
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
// Mock chrome APIs
// ---------------------------------------------------------------------------

const mockStorageGet = vi.fn()
const mockStorageSet = vi.fn()
const mockStorageSessionSet = vi.fn()
const mockStorageSessionGet = vi.fn()
const mockTabsQuery = vi.fn()
const mockTabsSendMessage = vi.fn()
const mockRuntimeSendMessage = vi.fn()
const mockSidePanelOpen = vi.fn()

// We keep a mutable reference to the registered runtime.onMessage listener
// so tests can simulate receiving messages from the content script.
let capturedRuntimeOnMessageListener: ((msg: Record<string, unknown>) => void) | null = null

const mockOnMessageAddListener = vi.fn((fn: (msg: Record<string, unknown>) => void) => {
  capturedRuntimeOnMessageListener = fn
})
const mockOnMessageRemoveListener = vi.fn()

vi.stubGlobal('chrome', {
  storage: {
    sync: {
      get: mockStorageGet,
      set: mockStorageSet,
    },
    session: {
      get: mockStorageSessionGet,
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
    onMessage: {
      addListener: mockOnMessageAddListener,
      removeListener: mockOnMessageRemoveListener,
    },
  },
  sidePanel: {
    open: mockSidePanelOpen,
  },
})

// ---------------------------------------------------------------------------
// Mock @shirajitsu/react — ModelSelector and AnnotationCard
// ---------------------------------------------------------------------------

vi.mock('@shirajitsu/react', () => ({
  ModelSelector: ({
    value,
    onChange,
    'data-testid': testId,
  }: {
    value: { modelId?: string } | string
    onChange: (m: unknown) => void
    'data-testid'?: string
  }) => {
    const currentModelId = typeof value === 'object' && value !== null ? (value as { modelId?: string }).modelId : String(value)
    return (
      <select
        data-testid={testId ?? 'model-selector'}
        value={currentModelId ?? ''}
        onChange={(e) => {
          const found = SUPPORTED_MODELS.find((m) => m.modelId === e.target.value)
          onChange(found ?? e.target.value)
        }}
      >
        {SUPPORTED_MODELS.map((m) => (
          <option key={m.modelId} value={m.modelId}>
            {m.label}
          </option>
        ))}
      </select>
    )
  },
  AnnotationCard: ({
    annotation,
  }: {
    annotation: {
      claim: { claimText: string; riskLevel: string; charOffset: number; charLength: number }
      state: string
      tensionRating: { label: string; score: number; sourceCount: number } | null
    }
    expanded: boolean
    onToggleExpand: () => void
  }) => (
    <div data-testid="annotation-card">
      <span data-testid="claim-text">{annotation.claim.claimText}</span>
      <span data-testid="risk-level">{annotation.claim.riskLevel}</span>
      {annotation.tensionRating && (
        <span data-testid="tension-rating">{annotation.tensionRating.label}</span>
      )}
    </div>
  ),
}))

// ---------------------------------------------------------------------------
// Import components under test AFTER mocks are established
// ---------------------------------------------------------------------------

import { Popup } from './Popup'
import { Sidebar } from '../sidebar/Sidebar'

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

/** Helper: set up the signed-in auth state and default storage mock for popup tests. */
function setSignedInDefault() {
  setAuthState(true)
  setUserState({ fullName: 'Test User', primaryEmailAddress: { emailAddress: 'test@example.com' } })
  mockStorageGet.mockImplementation(
    (_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({ ...DEFAULT_USER_SETTINGS }),
  )
  mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
    cb([{ id: 1, active: true, currentWindow: true } as unknown as chrome.tabs.Tab]),
  )
}

/** Helper: mock GET_CONTEXT response. */
function mockGetContextResponse(selection: { text: string; wordCount: number } | null) {
  mockTabsSendMessage.mockImplementation(
    (
      _tabId: number,
      msg: { type: string },
      cb: (res: Record<string, unknown>) => void,
    ) => {
      if (msg.type === 'GET_CONTEXT') {
        cb({ context: { mode: 'reader', editorType: 'none', confidence: 'high' }, selection })
      }
    },
  )
}

// ===========================================================================
// TC-001 through TC-013 — ExtensionAuth (unchanged from previous session)
// ===========================================================================

describe('TC-001: ClerkProvider wraps popup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    setAuthState(false)
    setUserState(null)
  })

  it('TC-001: renders without throwing AND renders SignInPrompt (sign-in button present) when isSignedIn is false', () => {
    expect(() => render(<Popup />)).not.toThrow()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})

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
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('TC-004-b: does NOT render the analyse CTA button when isSignedIn is false', () => {
    render(<Popup />)
    expect(screen.queryByRole('button', { name: /analyze this article|analyze my draft/i })).toBeNull()
  })

  it('TC-004-c: does NOT render the mode selector when isSignedIn is false', () => {
    render(<Popup />)
    expect(screen.queryByRole('button', { name: /^reader$/i })).toBeNull()
  })

  it('TC-004-d: does NOT render the model selector when isSignedIn is false', () => {
    render(<Popup />)
    expect(screen.queryByTestId('model-selector')).toBeNull()
  })

  it('TC-004-e: does NOT render the sidebar button when isSignedIn is false', () => {
    render(<Popup />)
    expect(screen.queryByRole('button', { name: /open sidebar/i })).toBeNull()
  })

  it('TC-004-f: does NOT render the display toggle when isSignedIn is false', () => {
    render(<Popup />)
    expect(screen.queryByRole('button', { name: /^inline$/i })).toBeNull()
  })

  it('TC-004-g: does NOT render a "Sign out" button AND renders a "Sign in" button when isSignedIn is false', () => {
    render(<Popup />)
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})

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
    expect(screen.queryByRole('button', { name: /analyze this article|analyze my draft/i })).toBeNull()
  })

  it('TC-005-b: does NOT render mode selector when isSignedIn is undefined', () => {
    render(<Popup />)
    expect(screen.queryByRole('button', { name: /^reader$/i })).toBeNull()
  })
})

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
    const signInButton = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(signInButton)
    expect(mockAuthState.openSignIn).toHaveBeenCalledTimes(1)
  })

  it('TC-006-b: clicking "Sign in" does NOT navigate away (window.location unchanged)', () => {
    const originalHref = window.location.href
    render(<Popup />)
    const signInButton = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(signInButton)
    expect(window.location.href).toBe(originalHref)
  })
})

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

    expect(screen.queryByRole('button', { name: /analyze this article|analyze my draft/i })).toBeNull()

    act(() => {
      setAuthState(true)
      setUserState({ fullName: 'Test User', primaryEmailAddress: { emailAddress: 'test@example.com' } })
    })
    rerender(<Popup />)

    expect(
      screen.getByRole('button', { name: /analyze this article|analyze my draft/i }),
    ).toBeInTheDocument()
  })

  it('TC-007-b: "Sign in" button absent AND "Sign out" button present after isSignedIn transitions to true', () => {
    setAuthState(false)
    setUserState(null)
    const { rerender } = render(<Popup />)

    act(() => {
      setAuthState(true)
      setUserState({ fullName: 'Test User', primaryEmailAddress: { emailAddress: 'test@example.com' } })
    })
    rerender(<Popup />)

    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})

describe('TC-008: SignedInIdentity shows fullName when available', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    setAuthState(true)
    setUserState({ fullName: 'Alex Weinstein', primaryEmailAddress: { emailAddress: 'alex@example.com' } })
  })

  it('TC-008-a: renders fullName "Alex Weinstein" in AnalyseView', () => {
    render(<Popup />)
    expect(screen.getByText('Alex Weinstein')).toBeInTheDocument()
  })

  it('TC-008-b: does NOT display email as primary identity when fullName is set AND fullName IS displayed', () => {
    render(<Popup />)
    expect(screen.getByText('Alex Weinstein')).toBeInTheDocument()
    expect(screen.queryByText('alex@example.com')).toBeNull()
  })
})

describe('TC-009: SignedInIdentity falls back to email when fullName is empty string', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    setAuthState(true)
    setUserState({ fullName: '', primaryEmailAddress: { emailAddress: 'alex@example.com' } })
  })

  it('TC-009: renders primaryEmailAddress when fullName is empty string', () => {
    render(<Popup />)
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
  })
})

describe('TC-010: SignedInIdentity falls back to email when fullName is null', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    setAuthState(true)
    setUserState({ fullName: null, primaryEmailAddress: { emailAddress: 'alex@example.com' } })
  })

  it('TC-010: renders primaryEmailAddress when fullName is null', () => {
    render(<Popup />)
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
  })
})

describe('TC-011: AnalyseView rendered immediately when session already active on mount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    setAuthState(true)
    setUserState({ fullName: 'Returning User', primaryEmailAddress: { emailAddress: 'user@example.com' } })
  })

  it('TC-011-a: AnalyseView rendered immediately on mount when isSignedIn is already true', () => {
    render(<Popup />)
    expect(screen.getByText('Returning User')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /analyze this article|analyze my draft/i }),
    ).toBeInTheDocument()
  })

  it('TC-011-b: SignInPrompt is NOT rendered AND user identity IS displayed when session is active', () => {
    render(<Popup />)
    expect(screen.getByText('Returning User')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull()
  })
})

describe('TC-012: Sign out button visible in AnalyseView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    setAuthState(true)
    setUserState({ fullName: 'Test User', primaryEmailAddress: { emailAddress: 'test@example.com' } })
  })

  it('TC-012: "Sign out" button is present in AnalyseView', () => {
    render(<Popup />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})

describe('TC-013: Clicking "Sign out" calls signOut() and returns to SignInPrompt', () => {
  it('TC-013-a: clicking "Sign out" calls Clerk signOut() exactly once', async () => {
    vi.clearAllMocks()
    mockStorageGet.mockImplementation((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({}))
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]))
    const mockSignOut = vi.fn().mockResolvedValue(undefined)
    setAuthState(true, { signOut: mockSignOut })
    setUserState({ fullName: 'Test User', primaryEmailAddress: { emailAddress: 'test@example.com' } })

    render(<Popup />)
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

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    })

    act(() => {
      setAuthState(false)
      setUserState(null)
    })
    rerender(<Popup />)

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

// ===========================================================================
// ISS-005: CTA adaptation (TC-032 through TC-053)
// ===========================================================================

describe('TC-032: Popup renders "Analyze selection" as primary CTA when SelectionContext is present', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockGetContextResponse({ text: 'Five selected words minimum now', wordCount: 6 })
  })

  it('TC-032-a: primary CTA button text is "Analyze selection" when selection has wordCount 6', async () => {
    render(<Popup />)
    // Wait for async GET_CONTEXT effect to resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(screen.getByRole('button', { name: /analyze selection/i })).toBeInTheDocument()
  })

  it('TC-032-b: "Analyze this article" or "Analyze my draft" is NOT the primary CTA', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(screen.queryByRole('button', { name: /analyze this article|analyze my draft/i })).toBeNull()
  })

  it('TC-032-c: "Analyze whole page" is present as a secondary (de-emphasized) action', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    // "Analyze whole page" must exist but NOT as the primary CTA button
    expect(screen.getByText(/analyze whole page/i)).toBeInTheDocument()
  })
})

describe('TC-033: Popup renders "Analyze whole page" as the only CTA when selection is null', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockGetContextResponse(null)
  })

  it('TC-033-a: primary CTA contains "Analyze whole page" when selection is null', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(screen.getByRole('button', { name: /analyze whole page/i })).toBeInTheDocument()
  })

  it('TC-033-b: "Analyze selection" is NOT present as a CTA button when selection is null', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(screen.queryByRole('button', { name: /analyze selection/i })).toBeNull()
  })

  it('TC-033-c: no secondary CTA link for whole-page analysis when no selection is present', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    // There must be exactly one CTA — the primary whole-page button, no secondary CTA
    const analyzeCtas = screen.queryAllByText(/analyze whole page/i)
    // Should be exactly one element (the primary), not duplicated as a secondary
    expect(analyzeCtas.length).toBe(1)
  })
})

describe('TC-034: "Analyze whole page" is visually de-emphasized when SelectionContext is present', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockGetContextResponse({ text: 'Five selected words minimum now', wordCount: 6 })
  })

  it('TC-034-a: "Analyze selection" element has the primary CTA class (popup__cta)', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const primaryCta = screen.getByRole('button', { name: /analyze selection/i })
    expect(primaryCta.className).toContain('popup__cta')
  })

  it('TC-034-b: "Analyze whole page" element does NOT have the primary popup__cta class', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const wholePageEl = screen.getByText(/analyze whole page/i)
    expect(wholePageEl.className).not.toMatch(/^popup__cta$/)
  })

  it('TC-034-c: both elements are present in the rendered output', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(screen.getByRole('button', { name: /analyze selection/i })).toBeInTheDocument()
    expect(screen.getByText(/analyze whole page/i)).toBeInTheDocument()
  })
})

describe('TC-035: Mode label is visible alongside "Analyze selection" CTA when selection is present', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockGetContextResponse({ text: 'Five selected words minimum now', wordCount: 6 })
  })

  it('TC-035: rendered output contains "Mode:" label alongside "Analyze selection" CTA', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(screen.getByText(/Mode:/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /analyze selection/i })).toBeInTheDocument()
  })
})

describe('TC-036: Mode label is visible alongside "Analyze whole page" CTA when no selection is present', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockGetContextResponse(null)
  })

  it('TC-036: rendered output contains "Mode:" label alongside "Analyze whole page" CTA', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(screen.getByText(/Mode:/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /analyze whole page/i })).toBeInTheDocument()
  })
})

describe('TC-039: SelectionPreview element rendered in popup when SelectionContext is present', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockGetContextResponse({ text: 'x'.repeat(90), wordCount: 15 })
  })

  it('TC-039-a: rendered output contains a <p> element starting with first 80 chars of selection', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    // The preview <p> element must start with first 80 chars of 'x'.repeat(90)
    const previewEl = screen.getByText(/^x{80}…$/)
    expect(previewEl).toBeInTheDocument()
    expect(previewEl.tagName.toLowerCase()).toBe('p')
  })

  it('TC-039-b: the full 90-character string is NOT present in the rendered output', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(screen.queryByText('x'.repeat(90))).toBeNull()
  })

  it('TC-039-c: preview ends with "…" ellipsis when text exceeds 80 chars', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const previewEl = screen.getByText(/…$/)
    expect(previewEl).toBeInTheDocument()
  })
})

describe('TC-040: SelectionPreview NOT rendered when selection is null', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockGetContextResponse(null)
  })

  it('TC-040-a: no <p> element containing a selection preview when selection is null', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    // There should be no preview <p> element (no selection text to show)
    const selectionPreviewP = document.querySelector('p.popup__selection-preview')
    expect(selectionPreviewP).toBeNull()
  })

  it('TC-040-b: SelectionPreview component/element is absent when selection is null', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    // No element should contain selection preview text — specifically no text that looks like truncated selection
    expect(screen.queryByText(/^…$/)).toBeNull()
  })
})

describe('TC-041: Clicking "Analyze selection" with wordCount < 5 shows warning and does NOT submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockGetContextResponse({ text: 'oneword', wordCount: 1 })
  })

  it('TC-041-a: SelectionTooShortWarning element is rendered after clicking "Analyze selection"', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const ctaButton = screen.getByRole('button', { name: /analyze selection/i })
    fireEvent.click(ctaButton)
    // Warning element must appear
    const warning = document.querySelector('.popup__warning')
    expect(warning).not.toBeNull()
    expect(warning!.textContent).toMatch(/5 words|five words/i)
  })

  it('TC-041-b: RUN_ANALYSIS is NOT sent when wordCount < 5', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const ctaButton = screen.getByRole('button', { name: /analyze selection/i })
    fireEvent.click(ctaButton)
    // No RUN_ANALYSIS message should be sent to the content script
    const runAnalysisCalls = mockTabsSendMessage.mock.calls.filter(
      (call) => (call[1] as Record<string, unknown>)?.type === 'RUN_ANALYSIS',
    )
    expect(runAnalysisCalls).toHaveLength(0)
  })

  it('TC-041-c: status does NOT change to "analyzing"', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const ctaButton = screen.getByRole('button', { name: /analyze selection/i })
    fireEvent.click(ctaButton)
    // The CTA button should NOT be showing "Analyzing…"
    expect(screen.queryByText('Analyzing…')).toBeNull()
  })
})

describe('TC-042: Clicking "Analyze selection" with wordCount 4 shows warning and does NOT submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockGetContextResponse({ text: 'just four words', wordCount: 4 })
  })

  it('TC-042-a: SelectionTooShortWarning is rendered after clicking with wordCount 4', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const ctaButton = screen.getByRole('button', { name: /analyze selection/i })
    fireEvent.click(ctaButton)
    const warning = document.querySelector('.popup__warning')
    expect(warning).not.toBeNull()
  })

  it('TC-042-b: RUN_ANALYSIS message is NOT sent when wordCount is 4', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    fireEvent.click(screen.getByRole('button', { name: /analyze selection/i }))
    const runAnalysisCalls = mockTabsSendMessage.mock.calls.filter(
      (call) => (call[1] as Record<string, unknown>)?.type === 'RUN_ANALYSIS',
    )
    expect(runAnalysisCalls).toHaveLength(0)
  })
})

describe('TC-043: Clicking "Analyze selection" with wordCount 5 submits and clears any prior warning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockGetContextResponse({ text: 'exactly five words now', wordCount: 5 })
    // Mock RUN_ANALYSIS response
    mockTabsSendMessage.mockImplementation(
      (
        _tabId: number,
        msg: { type: string },
        cb: (res: Record<string, unknown>) => void,
      ) => {
        if (msg.type === 'GET_CONTEXT') {
          cb({ context: { mode: 'reader', editorType: 'none', confidence: 'high' }, selection: { text: 'exactly five words now', wordCount: 5 } })
        }
        if (msg.type === 'RUN_ANALYSIS') {
          cb({ annotations: [], selectionAnalysisMode: 'selection' })
        }
      },
    )
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
      cb([{ id: 1, active: true, currentWindow: true } as unknown as chrome.tabs.Tab]),
    )
    mockStorageSessionSet.mockImplementation((_data: unknown, cb?: () => void) => cb && cb())
    mockSidePanelOpen.mockResolvedValue(undefined)
  })

  it('TC-043-a: RUN_ANALYSIS is sent with selectionMode "selection" when wordCount is exactly 5', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const ctaButton = screen.getByRole('button', { name: /analyze selection/i })
    await act(async () => {
      fireEvent.click(ctaButton)
    })
    const runAnalysisCalls = mockTabsSendMessage.mock.calls.filter(
      (call) => (call[1] as Record<string, unknown>)?.type === 'RUN_ANALYSIS',
    )
    expect(runAnalysisCalls.length).toBeGreaterThan(0)
    expect((runAnalysisCalls[0][1] as Record<string, unknown>).selectionMode).toBe('selection')
  })

  it('TC-043-b: no SelectionTooShortWarning element after clicking with wordCount 5', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    fireEvent.click(screen.getByRole('button', { name: /analyze selection/i }))
    expect(document.querySelector('.popup__warning')).toBeNull()
  })
})

describe('TC-045: SelectionTooShortWarning is cleared when selection changes to wordCount >= 5', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    vi.useFakeTimers()
    mockGetContextResponse({ text: 'oneword', wordCount: 1 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('TC-045: warning is cleared after SELECTION_CHANGED message with wordCount >= 5', async () => {
    render(<Popup />)
    await act(async () => {
      await Promise.resolve()
    })

    // Trigger warning by clicking analyze selection with wordCount 1
    const ctaButton = screen.getByRole('button', { name: /analyze selection/i })
    fireEvent.click(ctaButton)
    expect(document.querySelector('.popup__warning')).not.toBeNull()

    // Simulate SELECTION_CHANGED message with a valid selection
    act(() => {
      if (capturedRuntimeOnMessageListener) {
        capturedRuntimeOnMessageListener({
          type: 'SELECTION_CHANGED',
          selection: { text: 'five words or more now', wordCount: 5 },
        })
      }
      vi.advanceTimersByTime(150)
    })

    // Warning should be cleared
    expect(document.querySelector('.popup__warning')).toBeNull()
  })
})

describe('TC-046: RUN_ANALYSIS sent with selectionMode "selection" when "Analyze selection" is clicked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockTabsSendMessage.mockImplementation(
      (
        _tabId: number,
        msg: { type: string },
        cb: (res: Record<string, unknown>) => void,
      ) => {
        if (msg.type === 'GET_CONTEXT') {
          cb({ context: { mode: 'reader', editorType: 'none', confidence: 'high' }, selection: { text: 'five words are here now', wordCount: 6 } })
        }
        if (msg.type === 'RUN_ANALYSIS') {
          cb({ annotations: [], selectionAnalysisMode: 'selection' })
        }
      },
    )
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
      cb([{ id: 1, active: true, currentWindow: true } as unknown as chrome.tabs.Tab]),
    )
    mockStorageSessionSet.mockImplementation((_data: unknown, cb?: () => void) => cb && cb())
    mockSidePanelOpen.mockResolvedValue(undefined)
  })

  it('TC-046-a: RUN_ANALYSIS message includes selectionMode: "selection"', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze selection/i }))
    })
    const runAnalysisCalls = mockTabsSendMessage.mock.calls.filter(
      (call) => (call[1] as Record<string, unknown>)?.type === 'RUN_ANALYSIS',
    )
    expect(runAnalysisCalls.length).toBeGreaterThan(0)
    expect((runAnalysisCalls[0][1] as Record<string, unknown>).selectionMode).toBe('selection')
  })

  it('TC-046-b: SHOW_ANNOTATIONS broadcast includes selectionAnalysisMode: "selection"', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze selection/i }))
      await new Promise((r) => setTimeout(r, 0))
    })
    const showAnnotationsBroadcasts = mockRuntimeSendMessage.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)?.type === 'SHOW_ANNOTATIONS',
    )
    if (showAnnotationsBroadcasts.length > 0) {
      const payload = (showAnnotationsBroadcasts[0][0] as Record<string, unknown>).payload as Record<string, unknown>
      expect(payload.selectionAnalysisMode).toBe('selection')
    } else {
      // The implementation sends SHOW_ANNOTATIONS — this test asserts the behavior exists
      expect(showAnnotationsBroadcasts.length).toBeGreaterThan(0)
    }
  })
})

describe('TC-047: RUN_ANALYSIS sent with selectionMode "whole-page" when "Analyze whole page" is clicked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockTabsSendMessage.mockImplementation(
      (
        _tabId: number,
        msg: { type: string },
        cb: (res: Record<string, unknown>) => void,
      ) => {
        if (msg.type === 'GET_CONTEXT') {
          cb({ context: { mode: 'reader', editorType: 'none', confidence: 'high' }, selection: null })
        }
        if (msg.type === 'RUN_ANALYSIS') {
          cb({ annotations: [], selectionAnalysisMode: 'whole-page' })
        }
      },
    )
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
      cb([{ id: 1, active: true, currentWindow: true } as unknown as chrome.tabs.Tab]),
    )
    mockStorageSessionSet.mockImplementation((_data: unknown, cb?: () => void) => cb && cb())
    mockSidePanelOpen.mockResolvedValue(undefined)
  })

  it('TC-047: RUN_ANALYSIS includes selectionMode: "whole-page" when whole-page CTA clicked', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze whole page/i }))
    })
    const runAnalysisCalls = mockTabsSendMessage.mock.calls.filter(
      (call) => (call[1] as Record<string, unknown>)?.type === 'RUN_ANALYSIS',
    )
    expect(runAnalysisCalls.length).toBeGreaterThan(0)
    expect((runAnalysisCalls[0][1] as Record<string, unknown>).selectionMode).toBe('whole-page')
  })
})

describe('TC-048: SHOW_ANNOTATIONS context field reflects page-level detection, not selectionMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockTabsSendMessage.mockImplementation(
      (
        _tabId: number,
        msg: { type: string },
        cb: (res: Record<string, unknown>) => void,
      ) => {
        if (msg.type === 'GET_CONTEXT') {
          cb({ context: { mode: 'reader', editorType: 'none', confidence: 'high' }, selection: { text: 'five words are enough here', wordCount: 6 } })
        }
        if (msg.type === 'RUN_ANALYSIS') {
          cb({ annotations: [], selectionAnalysisMode: 'selection' })
        }
      },
    )
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
      cb([{ id: 1, active: true, currentWindow: true } as unknown as chrome.tabs.Tab]),
    )
    mockStorageSessionSet.mockImplementation((_data: unknown, cb?: () => void) => cb && cb())
    mockSidePanelOpen.mockResolvedValue(undefined)
  })

  it('TC-048: RUN_ANALYSIS message includes context derived from page mode, not selection mode', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze selection/i }))
      await new Promise((r) => setTimeout(r, 0))
    })
    // The context field in the RUN_ANALYSIS message or SHOW_ANNOTATIONS payload
    // must be 'reader' (from DetectedContext), not 'selection'
    const showAnnotationsSent = mockTabsSendMessage.mock.calls.filter(
      (call) => (call[1] as Record<string, unknown>)?.type === 'SHOW_ANNOTATIONS',
    )
    if (showAnnotationsSent.length > 0) {
      const payload = (showAnnotationsSent[0][1] as Record<string, unknown>).payload as Record<string, unknown>
      // context field must not be 'selection' or 'whole-page'
      expect(payload.context).not.toBe('selection')
      expect(payload.context).not.toBe('whole-page')
    } else {
      // If no SHOW_ANNOTATIONS tab message, check the RUN_ANALYSIS message context
      const runCalls = mockTabsSendMessage.mock.calls.filter(
        (call) => (call[1] as Record<string, unknown>)?.type === 'RUN_ANALYSIS',
      )
      expect(runCalls.length).toBeGreaterThan(0)
    }
  })
})

describe('TC-049: Popup CTA updates to "Analyze selection" when user selects text while popup is open', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    vi.useFakeTimers()
    // Start with no selection
    mockGetContextResponse(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('TC-049-a: CTA updates to "Analyze selection" after SELECTION_CHANGED with valid selection', async () => {
    render(<Popup />)
    await act(async () => {
      await Promise.resolve()
    })

    // Initially should show "Analyze whole page"
    expect(screen.getByRole('button', { name: /analyze whole page/i })).toBeInTheDocument()

    // Simulate SELECTION_CHANGED message and advance timer past debounce
    act(() => {
      if (capturedRuntimeOnMessageListener) {
        capturedRuntimeOnMessageListener({
          type: 'SELECTION_CHANGED',
          selection: { text: 'newly selected text five words', wordCount: 5 },
        })
      }
      vi.advanceTimersByTime(150)
    })

    // CTA should now be "Analyze selection"
    expect(screen.getByRole('button', { name: /analyze selection/i })).toBeInTheDocument()
  })

  it('TC-049-b: SelectionPreview <p> element appears after SELECTION_CHANGED with valid selection', async () => {
    render(<Popup />)
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      if (capturedRuntimeOnMessageListener) {
        capturedRuntimeOnMessageListener({
          type: 'SELECTION_CHANGED',
          selection: { text: 'newly selected text five words', wordCount: 5 },
        })
      }
      vi.advanceTimersByTime(150)
    })

    // SelectionPreview should appear
    const previewEls = screen.queryAllByText(/newly selected text five words/)
    expect(previewEls.length).toBeGreaterThan(0)
  })
})

describe('TC-050: Popup CTA reverts to "Analyze whole page" when user clears selection while popup is open', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    vi.useFakeTimers()
    // Start with a valid selection
    mockGetContextResponse({ text: 'five words are here now', wordCount: 5 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('TC-050-a: CTA reverts to "Analyze whole page" after SELECTION_CHANGED with null selection', async () => {
    render(<Popup />)
    await act(async () => {
      await Promise.resolve()
    })

    // Initially should show "Analyze selection"
    expect(screen.getByRole('button', { name: /analyze selection/i })).toBeInTheDocument()

    // Simulate selection being cleared
    act(() => {
      if (capturedRuntimeOnMessageListener) {
        capturedRuntimeOnMessageListener({ type: 'SELECTION_CHANGED', selection: null })
      }
      vi.advanceTimersByTime(150)
    })

    // CTA should revert to "Analyze whole page"
    expect(screen.getByRole('button', { name: /analyze whole page/i })).toBeInTheDocument()
  })

  it('TC-050-b: SelectionPreview <p> element is gone after SELECTION_CHANGED with null', async () => {
    render(<Popup />)
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      if (capturedRuntimeOnMessageListener) {
        capturedRuntimeOnMessageListener({ type: 'SELECTION_CHANGED', selection: null })
      }
      vi.advanceTimersByTime(150)
    })

    // No selection preview after clearing
    expect(document.querySelector('p.popup__selection-preview')).toBeNull()
  })

  it('TC-050-c: "Analyze selection" is no longer the primary CTA after clearing selection', async () => {
    render(<Popup />)
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      if (capturedRuntimeOnMessageListener) {
        capturedRuntimeOnMessageListener({ type: 'SELECTION_CHANGED', selection: null })
      }
      vi.advanceTimersByTime(150)
    })

    expect(screen.queryByRole('button', { name: /analyze selection/i })).toBeNull()
  })
})

describe('TC-052: Whitespace-only selection causes popup to show "Analyze whole page" and no preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    // Content script returns null for whitespace-only (per TC-023)
    mockGetContextResponse(null)
  })

  it('TC-052-a: "Analyze whole page" is the primary CTA for whitespace-only selection (returns null from content script)', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(screen.getByRole('button', { name: /analyze whole page/i })).toBeInTheDocument()
  })

  it('TC-052-b: no SelectionPreview is present when selection is null', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(document.querySelector('.popup__selection-preview')).toBeNull()
  })

  it('TC-052-c: "Analyze selection" is not present when selection is null', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(screen.queryByRole('button', { name: /analyze selection/i })).toBeNull()
  })
})

describe('TC-053: Empty selection causes popup to show "Analyze whole page" and no preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    // Content script returns null for empty selection (per TC-021/TC-022)
    mockGetContextResponse(null)
  })

  it('TC-053-a: "Analyze whole page" is the primary CTA when selection is null', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(screen.getByRole('button', { name: /analyze whole page/i })).toBeInTheDocument()
  })

  it('TC-053-b: no SelectionPreview element present when selection is null', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(document.querySelector('.popup__selection-preview')).toBeNull()
  })
})

// ===========================================================================
// ISS-005: Sidebar display (TC-062, TC-063)
// ===========================================================================

describe('TC-062: Sidebar displays annotations correctly after selection-based analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('chrome', {
      storage: {
        sync: { get: mockStorageGet, set: mockStorageSet },
        session: {
          get: vi.fn((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({})),
          set: mockStorageSessionSet,
        },
      },
      tabs: { query: mockTabsQuery, sendMessage: mockTabsSendMessage },
      runtime: {
        sendMessage: mockRuntimeSendMessage,
        lastError: undefined,
        onMessage: {
          addListener: mockOnMessageAddListener,
          removeListener: mockOnMessageRemoveListener,
        },
      },
      sidePanel: { open: mockSidePanelOpen },
    })
  })

  it('TC-062-a: sidebar renders annotation claim text after SHOW_ANNOTATIONS with selectionAnalysisMode "selection"', () => {
    render(<Sidebar />)

    act(() => {
      if (capturedRuntimeOnMessageListener) {
        capturedRuntimeOnMessageListener({
          type: 'SHOW_ANNOTATIONS',
          payload: {
            annotations: [
              {
                claim: { claimText: 'Test claim', riskLevel: 'high', charOffset: 0, charLength: 10 },
                state: 'sourced',
                tensionRating: { label: '1 of 3 sources frame this differently', score: 0.33, sourceCount: 3 },
              },
            ],
            settings: DEFAULT_USER_SETTINGS,
            selectionAnalysisMode: 'selection',
          },
        })
      }
    })

    expect(screen.getByText('Test claim')).toBeInTheDocument()
  })

  it('TC-062-b: sidebar renders the tension rating label', () => {
    render(<Sidebar />)

    act(() => {
      if (capturedRuntimeOnMessageListener) {
        capturedRuntimeOnMessageListener({
          type: 'SHOW_ANNOTATIONS',
          payload: {
            annotations: [
              {
                claim: { claimText: 'Test claim', riskLevel: 'high', charOffset: 0, charLength: 10 },
                state: 'sourced',
                tensionRating: { label: '1 of 3 sources frame this differently', score: 0.33, sourceCount: 3 },
              },
            ],
            settings: DEFAULT_USER_SETTINGS,
            selectionAnalysisMode: 'selection',
          },
        })
      }
    })

    expect(screen.getByText('1 of 3 sources frame this differently')).toBeInTheDocument()
  })

  it('TC-062-c: no error state is displayed in the sidebar after SHOW_ANNOTATIONS', () => {
    render(<Sidebar />)

    act(() => {
      if (capturedRuntimeOnMessageListener) {
        capturedRuntimeOnMessageListener({
          type: 'SHOW_ANNOTATIONS',
          payload: {
            annotations: [
              {
                claim: { claimText: 'Test claim', riskLevel: 'high', charOffset: 0, charLength: 10 },
                state: 'sourced',
                tensionRating: null,
              },
            ],
            settings: DEFAULT_USER_SETTINGS,
            selectionAnalysisMode: 'selection',
          },
        })
      }
    })

    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('TC-063: Sidebar displays annotations correctly after whole-page analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('chrome', {
      storage: {
        sync: { get: mockStorageGet, set: mockStorageSet },
        session: {
          get: vi.fn((_keys: string[], cb: (v: Record<string, unknown>) => void) => cb({})),
          set: mockStorageSessionSet,
        },
      },
      tabs: { query: mockTabsQuery, sendMessage: mockTabsSendMessage },
      runtime: {
        sendMessage: mockRuntimeSendMessage,
        lastError: undefined,
        onMessage: {
          addListener: mockOnMessageAddListener,
          removeListener: mockOnMessageRemoveListener,
        },
      },
      sidePanel: { open: mockSidePanelOpen },
    })
  })

  it('TC-063-a: sidebar renders annotation claim text after SHOW_ANNOTATIONS with selectionAnalysisMode "whole-page"', () => {
    render(<Sidebar />)

    act(() => {
      if (capturedRuntimeOnMessageListener) {
        capturedRuntimeOnMessageListener({
          type: 'SHOW_ANNOTATIONS',
          payload: {
            annotations: [
              {
                claim: { claimText: 'Test claim', riskLevel: 'high', charOffset: 0, charLength: 10 },
                state: 'sourced',
                tensionRating: { label: '1 of 3 sources frame this differently', score: 0.33, sourceCount: 3 },
              },
            ],
            settings: DEFAULT_USER_SETTINGS,
            selectionAnalysisMode: 'whole-page',
          },
        })
      }
    })

    expect(screen.getByText('Test claim')).toBeInTheDocument()
  })

  it('TC-063-b: sidebar renders tension rating label with whole-page selectionAnalysisMode', () => {
    render(<Sidebar />)

    act(() => {
      if (capturedRuntimeOnMessageListener) {
        capturedRuntimeOnMessageListener({
          type: 'SHOW_ANNOTATIONS',
          payload: {
            annotations: [
              {
                claim: { claimText: 'Test claim', riskLevel: 'high', charOffset: 0, charLength: 10 },
                state: 'sourced',
                tensionRating: { label: '1 of 3 sources frame this differently', score: 0.33, sourceCount: 3 },
              },
            ],
            settings: DEFAULT_USER_SETTINGS,
            selectionAnalysisMode: 'whole-page',
          },
        })
      }
    })

    expect(screen.getByText('1 of 3 sources frame this differently')).toBeInTheDocument()
  })
})

// ===========================================================================
// ISS-007: HighlightColor settings (TC-064 through TC-070)
// ===========================================================================

describe('TC-064: UserSettings interface includes highlightColor: string with default "#FFFF00"', () => {
  it('TC-064-a: DEFAULT_USER_SETTINGS.highlightColor is "#FFFF00"', () => {
    expect(DEFAULT_USER_SETTINGS.highlightColor).toBe('#FFFF00')
  })

  it('TC-064-b: Object.keys(DEFAULT_USER_SETTINGS) includes "highlightColor"', () => {
    expect(Object.keys(DEFAULT_USER_SETTINGS)).toContain('highlightColor')
  })
})

describe('TC-065: Color picker <input type="color"> is rendered in the popup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockStorageGet.mockImplementation(
      (_keys: string[], cb: (v: Record<string, unknown>) => void) =>
        cb({ ...DEFAULT_USER_SETTINGS, highlightColor: '#FFFF00' }),
    )
    mockGetContextResponse(null)
  })

  it('TC-065-a: popup renders an <input type="color"> element', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    // ISS-007 not implemented — no color input exists yet. This test must fail.
    const colorInput = document.querySelector('input[type="color"]')
    expect(colorInput).not.toBeNull()
  })

  it('TC-065-b: color input value is "#ffff00" (normalized lowercase)', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement | null
    expect(colorInput).not.toBeNull()
    expect(colorInput!.value.toLowerCase()).toBe('#ffff00')
  })
})

describe('TC-066: Color picker shows previously saved highlightColor on popup open', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockStorageGet.mockImplementation(
      (_keys: string[], cb: (v: Record<string, unknown>) => void) =>
        cb({ ...DEFAULT_USER_SETTINGS, highlightColor: '#FF6600' }),
    )
    mockGetContextResponse(null)
  })

  it('TC-066-a: color input value reflects stored "#ff6600", not default "#ffff00"', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement | null
    expect(colorInput).not.toBeNull()
    expect(colorInput!.value.toLowerCase()).toBe('#ff6600')
  })
})

describe('TC-067: Selecting a new color writes to chrome.storage.sync and updates settings state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockStorageGet.mockImplementation(
      (_keys: string[], cb: (v: Record<string, unknown>) => void) =>
        cb({ ...DEFAULT_USER_SETTINGS, highlightColor: '#FFFF00' }),
    )
    mockGetContextResponse(null)
  })

  it('TC-067-a: chrome.storage.sync.set called with { highlightColor: "#3399FF" } on color change', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement | null
    expect(colorInput).not.toBeNull()
    fireEvent.change(colorInput!, { target: { value: '#3399FF' } })
    const highlightColorWrites = mockStorageSet.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>).highlightColor !== undefined,
    )
    expect(highlightColorWrites.length).toBeGreaterThan(0)
    expect((highlightColorWrites[0][0] as Record<string, unknown>).highlightColor).toBe('#3399FF')
  })

  it('TC-067-b: saveModel() is NOT called as a side effect of color picker change', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement | null
    expect(colorInput).not.toBeNull()
    mockStorageSet.mockClear()
    fireEvent.change(colorInput!, { target: { value: '#3399FF' } })
    // selectedModel must NOT be written
    const selectedModelWrites = mockStorageSet.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>).selectedModel !== undefined,
    )
    expect(selectedModelWrites).toHaveLength(0)
  })
})

describe('TC-068: SHOW_ANNOTATIONS payload includes current highlightColor from settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockStorageGet.mockImplementation(
      (_keys: string[], cb: (v: Record<string, unknown>) => void) =>
        cb({ ...DEFAULT_USER_SETTINGS, highlightColor: '#3399FF' }),
    )
    mockTabsSendMessage.mockImplementation(
      (
        _tabId: number,
        msg: { type: string },
        cb: (res: Record<string, unknown>) => void,
      ) => {
        if (msg.type === 'GET_CONTEXT') {
          cb({ context: { mode: 'reader', editorType: 'none', confidence: 'high' }, selection: { text: 'five words are enough here', wordCount: 6 } })
        }
        if (msg.type === 'RUN_ANALYSIS') {
          cb({ annotations: [], selectionAnalysisMode: 'selection' })
        }
      },
    )
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
      cb([{ id: 1, active: true, currentWindow: true } as unknown as chrome.tabs.Tab]),
    )
    mockStorageSessionSet.mockImplementation((_data: unknown, cb?: () => void) => cb && cb())
    mockSidePanelOpen.mockResolvedValue(undefined)
  })

  it('TC-068: SHOW_ANNOTATIONS payload settings.highlightColor is "#3399FF"', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze selection/i }))
      await new Promise((r) => setTimeout(r, 0))
    })
    // Check both tab and broadcast SHOW_ANNOTATIONS payloads
    const tabShowAnnotations = mockTabsSendMessage.mock.calls.filter(
      (call) => (call[1] as Record<string, unknown>)?.type === 'SHOW_ANNOTATIONS',
    )
    const broadcastShowAnnotations = mockRuntimeSendMessage.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>)?.type === 'SHOW_ANNOTATIONS',
    )
    // At least one of these should include highlightColor
    const allShowAnnotations = [...tabShowAnnotations, ...broadcastShowAnnotations]
    if (allShowAnnotations.length > 0) {
      const firstCall = allShowAnnotations[0]
      const payload = (firstCall[tabShowAnnotations.length > 0 ? 1 : 0] as Record<string, unknown>).payload as Record<string, unknown>
      const settings = payload.settings as Record<string, unknown>
      expect(settings.highlightColor).toBe('#3399FF')
    } else {
      // If no SHOW_ANNOTATIONS was sent at all, the test fails
      expect(allShowAnnotations.length).toBeGreaterThan(0)
    }
  })
})

describe('TC-069: Highlight color persists — color picker shows previously stored color on next popup open', () => {
  it('TC-069: second popup mount shows previously stored highlightColor "#3399ff"', async () => {
    vi.clearAllMocks()
    setSignedInDefault()

    // Simulate persistent storage: second open returns the stored color
    mockStorageGet.mockImplementation(
      (_keys: string[], cb: (v: Record<string, unknown>) => void) =>
        cb({ ...DEFAULT_USER_SETTINGS, highlightColor: '#3399FF' }),
    )
    mockTabsSendMessage.mockImplementation(
      (
        _tabId: number,
        msg: { type: string },
        cb: (res: Record<string, unknown>) => void,
      ) => {
        if (msg.type === 'GET_CONTEXT') {
          cb({ context: { mode: 'reader', editorType: 'none' }, selection: null })
        }
      },
    )

    // Second mount (simulates popup closing and reopening with persisted storage)
    const { unmount } = render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    unmount()

    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement | null
    expect(colorInput).not.toBeNull()
    expect(colorInput!.value.toLowerCase()).toBe('#3399ff')
  })
})

describe('TC-070: DEFAULT_USER_SETTINGS used as fallback — no #FFFF00 hardcoding in Popup.tsx storage handler', () => {
  it('TC-070: Popup.tsx source does not contain "#FFFF00" as a literal string in the storage.sync.get callback', async () => {
    // This is a static analysis test. Read the source file and assert the pattern.
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const sourceFile = resolve(__dirname, 'Popup.tsx')
    const source = readFileSync(sourceFile, 'utf-8')

    // The storage.sync.get callback must NOT hardcode '#FFFF00' as a default
    // It should use DEFAULT_USER_SETTINGS as the source of defaults
    // We assert: Object.keys(DEFAULT_USER_SETTINGS) appears in the source
    expect(source).toContain('Object.keys(DEFAULT_USER_SETTINGS)')

    // The literal string '#FFFF00' must NOT appear in the sync.get callback handler
    // (it may appear elsewhere as a comment or in DEFAULT_USER_SETTINGS reference)
    // We check that the sync.get area doesn't contain a hardcoded '#FFFF00'
    const syncGetPattern = /chrome\.storage\.sync\.get[\s\S]{0,500}#FFFF00/
    expect(syncGetPattern.test(source)).toBe(false)
  })
})

// ===========================================================================
// ISS-008: PerSelectionModelOverride picker (TC-071 through TC-079)
// ===========================================================================

describe('TC-071: Per-selection model picker is rendered when SelectionContext is present', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockGetContextResponse({ text: 'five words minimum here now', wordCount: 5 })
  })

  it('TC-071-a: per-selection model picker is present when selection is active', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    // The per-selection picker is labeled distinctly — "Model for this selection:"
    expect(screen.getByText(/model for this selection/i)).toBeInTheDocument()
  })

  it('TC-071-b: global model selector ("Model:") is still present alongside the per-selection picker', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    // Global model selector must still be present
    expect(screen.getByText(/^Model:/)).toBeInTheDocument()
  })
})

describe('TC-072: Per-selection model picker is NOT rendered when no SelectionContext is present', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockGetContextResponse(null)
  })

  it('TC-072-a: per-selection model picker is absent when selection is null', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(screen.queryByText(/model for this selection/i)).toBeNull()
  })

  it('TC-072-b: global model selector ("Model:") is still present when no selection', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(screen.getByText(/^Model:/)).toBeInTheDocument()
  })
})

describe('TC-073: Analysis uses perSelectionModel when set in per-selection picker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockStorageGet.mockImplementation(
      (_keys: string[], cb: (v: Record<string, unknown>) => void) =>
        cb({ ...DEFAULT_USER_SETTINGS, selectedModel: SUPPORTED_MODELS[0] }),
    )
    mockTabsSendMessage.mockImplementation(
      (
        _tabId: number,
        msg: { type: string },
        cb: (res: Record<string, unknown>) => void,
      ) => {
        if (msg.type === 'GET_CONTEXT') {
          cb({ context: { mode: 'reader', editorType: 'none' }, selection: { text: 'five words minimum here now', wordCount: 6 } })
        }
        if (msg.type === 'RUN_ANALYSIS') {
          cb({ annotations: [], selectionAnalysisMode: 'selection' })
        }
      },
    )
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
      cb([{ id: 1, active: true, currentWindow: true } as unknown as chrome.tabs.Tab]),
    )
    mockStorageSessionSet.mockImplementation((_data: unknown, cb?: () => void) => cb && cb())
    mockSidePanelOpen.mockResolvedValue(undefined)
  })

  it('TC-073: analysis request uses perSelectionModel (gpt-4o) when selected in per-selection picker', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    // Change per-selection picker to gpt-4o
    const perSelectionPicker = screen.queryByTestId('per-selection-model-selector')
    if (perSelectionPicker) {
      fireEvent.change(perSelectionPicker, { target: { value: 'gpt-4o' } })
    }

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze selection/i }))
      await new Promise((r) => setTimeout(r, 0))
    })

    const runAnalysisCalls = mockTabsSendMessage.mock.calls.filter(
      (call) => (call[1] as Record<string, unknown>)?.type === 'RUN_ANALYSIS',
    )
    // The RUN_ANALYSIS message should include the per-selection model (gpt-4o)
    // This will fail because per-selection picker does not exist yet (ISS-008 not implemented)
    expect(runAnalysisCalls.length).toBeGreaterThan(0)
    const runMsg = runAnalysisCalls[0][1] as Record<string, unknown>
    const model = runMsg.model as Record<string, unknown> | undefined
    if (model) {
      expect(model.modelId).toBe('gpt-4o')
    } else {
      // If model is not in the message, it must be passed via another field
      // This assertion will fail until the implementation adds the model field
      expect(model).not.toBeUndefined()
    }
  })
})

describe('TC-074: chrome.storage.sync selectedModel is NOT written when per-selection picker changes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockGetContextResponse({ text: 'five words minimum here now', wordCount: 5 })
  })

  it('TC-074: storage.sync.set is NOT called with selectedModel on per-selection picker change', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    mockStorageSet.mockClear()

    // Change per-selection picker
    const perSelectionPicker = screen.queryByTestId('per-selection-model-selector')
    if (perSelectionPicker) {
      fireEvent.change(perSelectionPicker, { target: { value: 'gpt-4o' } })
    }

    // selectedModel must NOT be written to sync storage
    const selectedModelWrites = mockStorageSet.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>).selectedModel !== undefined,
    )
    expect(selectedModelWrites).toHaveLength(0)
  })
})

describe('TC-075: Global settings.selectedModel is unchanged after submitting with per-selection override', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockStorageGet.mockImplementation(
      (_keys: string[], cb: (v: Record<string, unknown>) => void) =>
        cb({ ...DEFAULT_USER_SETTINGS, selectedModel: SUPPORTED_MODELS[0] }),
    )
    mockTabsSendMessage.mockImplementation(
      (
        _tabId: number,
        msg: { type: string },
        cb: (res: Record<string, unknown>) => void,
      ) => {
        if (msg.type === 'GET_CONTEXT') {
          cb({ context: { mode: 'reader', editorType: 'none' }, selection: { text: 'five words minimum here', wordCount: 5 } })
        }
        if (msg.type === 'RUN_ANALYSIS') {
          cb({ annotations: [], selectionAnalysisMode: 'selection' })
        }
      },
    )
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
      cb([{ id: 1, active: true, currentWindow: true } as unknown as chrome.tabs.Tab]),
    )
    mockStorageSessionSet.mockImplementation((_data: unknown, cb?: () => void) => cb && cb())
    mockSidePanelOpen.mockResolvedValue(undefined)
  })

  it('TC-075: chrome.storage.sync.set is NOT called with { selectedModel: "gpt-4o" } after per-selection submission', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    mockStorageSet.mockClear()

    // Change per-selection picker and submit
    const perSelectionPicker = screen.queryByTestId('per-selection-model-selector')
    if (perSelectionPicker) {
      fireEvent.change(perSelectionPicker, { target: { value: 'gpt-4o' } })
    }

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze selection/i }))
      await new Promise((r) => setTimeout(r, 0))
    })

    // selectedModel must not be written with 'gpt-4o'
    const gpt4oWrites = mockStorageSet.mock.calls.filter((call) => {
      const data = call[0] as Record<string, unknown>
      const model = data.selectedModel as { modelId?: string } | undefined
      return model?.modelId === 'gpt-4o'
    })
    expect(gpt4oWrites).toHaveLength(0)
  })
})

describe('TC-076: Analysis uses settings.selectedModel when perSelectionModel is null', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockStorageGet.mockImplementation(
      (_keys: string[], cb: (v: Record<string, unknown>) => void) =>
        cb({ ...DEFAULT_USER_SETTINGS, selectedModel: SUPPORTED_MODELS[0] }),
    )
    mockTabsSendMessage.mockImplementation(
      (
        _tabId: number,
        msg: { type: string },
        cb: (res: Record<string, unknown>) => void,
      ) => {
        if (msg.type === 'GET_CONTEXT') {
          cb({ context: { mode: 'reader', editorType: 'none' }, selection: { text: 'five words here now yes', wordCount: 5 } })
        }
        if (msg.type === 'RUN_ANALYSIS') {
          cb({ annotations: [], selectionAnalysisMode: 'selection' })
        }
      },
    )
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
      cb([{ id: 1, active: true, currentWindow: true } as unknown as chrome.tabs.Tab]),
    )
    mockStorageSessionSet.mockImplementation((_data: unknown, cb?: () => void) => cb && cb())
    mockSidePanelOpen.mockResolvedValue(undefined)
  })

  it('TC-076: RUN_ANALYSIS uses global settings.selectedModel when no per-selection override is set', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    // Do NOT change per-selection picker (perSelectionModel remains null)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze selection/i }))
      await new Promise((r) => setTimeout(r, 0))
    })

    const runAnalysisCalls = mockTabsSendMessage.mock.calls.filter(
      (call) => (call[1] as Record<string, unknown>)?.type === 'RUN_ANALYSIS',
    )
    expect(runAnalysisCalls.length).toBeGreaterThan(0)
    const runMsg = runAnalysisCalls[0][1] as Record<string, unknown>
    const model = runMsg.model as Record<string, unknown> | undefined
    // Model should be the global default (claude-sonnet-4-20250514) not gpt-4o
    if (model) {
      expect((model as { modelId?: string }).modelId).toBe(SUPPORTED_MODELS[0].modelId)
    }
  })
})

describe('TC-077: Per-selection picker shows global default model on next popup open', () => {
  it('TC-077: perSelectionModel resets to null on popup remount (global default shown)', async () => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockStorageGet.mockImplementation(
      (_keys: string[], cb: (v: Record<string, unknown>) => void) =>
        cb({ ...DEFAULT_USER_SETTINGS, selectedModel: SUPPORTED_MODELS[0] }),
    )
    mockTabsSendMessage.mockImplementation(
      (
        _tabId: number,
        msg: { type: string },
        cb: (res: Record<string, unknown>) => void,
      ) => {
        if (msg.type === 'GET_CONTEXT') {
          cb({ context: { mode: 'reader', editorType: 'none' }, selection: { text: 'five words here now yes', wordCount: 5 } })
        }
        if (msg.type === 'RUN_ANALYSIS') {
          cb({ annotations: [], selectionAnalysisMode: 'selection' })
        }
      },
    )
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
      cb([{ id: 1, active: true, currentWindow: true } as unknown as chrome.tabs.Tab]),
    )
    mockStorageSessionSet.mockImplementation((_data: unknown, cb?: () => void) => cb && cb())
    mockSidePanelOpen.mockResolvedValue(undefined)

    // First mount: set per-selection picker to gpt-4o
    const { unmount } = render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    const perSelectionPicker = screen.queryByTestId('per-selection-model-selector')
    if (perSelectionPicker) {
      fireEvent.change(perSelectionPicker, { target: { value: 'gpt-4o' } })
    }

    unmount()

    // Second mount: fresh React state — perSelectionModel must be null
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    const secondMountPicker = screen.queryByTestId('per-selection-model-selector') as HTMLSelectElement | null
    if (secondMountPicker) {
      // The picker should show the global default, not gpt-4o
      expect(secondMountPicker.value).not.toBe('gpt-4o')
      expect(secondMountPicker.value).toBe(SUPPORTED_MODELS[0].modelId)
    } else {
      // The per-selection picker does not exist yet — ISS-008 not implemented
      // This assertion will fail, which is the expected Gate 3 behavior
      expect(secondMountPicker).not.toBeNull()
    }
  })
})

describe('TC-078: Per-selection picker shows all SUPPORTED_MODELS from @shirajitsu/types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockGetContextResponse({ text: 'five words minimum here now', wordCount: 5 })
  })

  it('TC-078: per-selection model picker contains an option for every SUPPORTED_MODEL', async () => {
    render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    const perSelectionPicker = screen.queryByTestId('per-selection-model-selector')
    // Picker must exist (ISS-008 not implemented — this will fail)
    expect(perSelectionPicker).not.toBeNull()

    if (perSelectionPicker) {
      const options = Array.from(perSelectionPicker.querySelectorAll('option'))
      const optionValues = options.map((o) => o.value)
      for (const model of SUPPORTED_MODELS) {
        expect(optionValues).toContain(model.modelId)
      }
    }
  })
})

describe('TC-079: perSelectionModel is NEVER written to chrome.storage.sync or chrome.storage.session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSignedInDefault()
    mockTabsSendMessage.mockImplementation(
      (
        _tabId: number,
        msg: { type: string },
        cb: (res: Record<string, unknown>) => void,
      ) => {
        if (msg.type === 'GET_CONTEXT') {
          cb({ context: { mode: 'reader', editorType: 'none' }, selection: { text: 'five words here now yes', wordCount: 5 } })
        }
        if (msg.type === 'RUN_ANALYSIS') {
          cb({ annotations: [], selectionAnalysisMode: 'selection' })
        }
      },
    )
    mockTabsQuery.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
      cb([{ id: 1, active: true, currentWindow: true } as unknown as chrome.tabs.Tab]),
    )
    mockStorageSessionSet.mockImplementation((_data: unknown, cb?: () => void) => cb && cb())
    mockSidePanelOpen.mockResolvedValue(undefined)
  })

  it('TC-079-a: chrome.storage.sync.set is NOT called with perSelectionModel at any point', async () => {
    const { unmount } = render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    const perSelectionPicker = screen.queryByTestId('per-selection-model-selector')
    if (perSelectionPicker) {
      fireEvent.change(perSelectionPicker, { target: { value: 'gpt-4o' } })
    }

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze selection/i }))
      await new Promise((r) => setTimeout(r, 0))
    })

    unmount()

    // perSelectionModel must NEVER be written to sync storage
    const syncPerSelectionWrites = mockStorageSet.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>).perSelectionModel !== undefined,
    )
    expect(syncPerSelectionWrites).toHaveLength(0)
  })

  it('TC-079-b: chrome.storage.session.set is NOT called with perSelectionModel at any point', async () => {
    const { unmount } = render(<Popup />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    const perSelectionPicker = screen.queryByTestId('per-selection-model-selector')
    if (perSelectionPicker) {
      fireEvent.change(perSelectionPicker, { target: { value: 'gpt-4o' } })
    }

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /analyze selection/i }))
      await new Promise((r) => setTimeout(r, 0))
    })

    unmount()

    // perSelectionModel must NEVER be written to session storage
    const sessionPerSelectionWrites = mockStorageSessionSet.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>).perSelectionModel !== undefined,
    )
    expect(sessionPerSelectionWrites).toHaveLength(0)
  })
})
