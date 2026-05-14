import { useEffect, useState } from 'react'
import type { DetectedContext } from '@/context/detector'
import type { AIModel, UserSettings } from '@shirajitsu/types'
import { DEFAULT_USER_SETTINGS } from '@shirajitsu/types'
import { ModelSelector } from '@shirajitsu/react'

function safeBroadcast(message: Record<string, unknown>): void {
  chrome.runtime.sendMessage(message, () => {
    void chrome.runtime.lastError
  })
}

/**
 * Fire-and-forget chrome.tabs.sendMessage that silently swallows the
 * "Receiving end does not exist" error. Use this whenever the content script
 * may not be injected (e.g. chrome:// pages, PDF viewer, or tabs that have
 * not yet loaded the content script). The callback must always be provided to
 * chrome.tabs.sendMessage — omitting it causes Chrome to log an uncaught
 * runtime error when the receiving end is absent.
 */
function safeTabMessage(tabId: number, message: Record<string, unknown>): void {
  chrome.tabs.sendMessage(tabId, message, () => {
    void chrome.runtime.lastError
  })
}

export function Popup() {
  const [context, setContext] = useState<DetectedContext | null>(null)
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS)
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // Load settings
    chrome.storage.sync.get(Object.keys(DEFAULT_USER_SETTINGS), (stored) => {
      setSettings({ ...DEFAULT_USER_SETTINGS, ...(stored as Partial<UserSettings>) })
    })

    // Get current tab context from content script
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) return
      chrome.tabs.sendMessage(tab.id, { type: 'GET_CONTEXT' }, (res) => {
        if (chrome.runtime.lastError) return
        if (res?.context) setContext(res.context as DetectedContext)
      })
    })
  }, [])

  const effectiveMode = settings.manualModeOverride ?? context?.mode ?? 'reader'
  const ctaLabel = effectiveMode === 'writer' ? 'Analyze my draft' : 'Analyze this article'

  async function handleOpenSidebar() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) chrome.sidePanel.open({ tabId: tab.id })
  }

  function broadcastError(msg: string) {
    setStatus('error')
    setErrorMsg(msg)
    chrome.storage.session.set({ shirajitsu_state: 'error', shirajitsu_error: msg })
    safeBroadcast({ type: 'SHOW_ERROR', payload: { error: msg } })
  }

  async function handleAnalyze() {
    setStatus('analyzing')
    setErrorMsg('')

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      broadcastError('Could not determine the active tab.')
      return
    }

    // Persist pending state before opening sidepanel so the sidebar can read it
    // on mount even if it loads after the message has been sent.
    await chrome.storage.session.set({ shirajitsu_state: 'analyzing', shirajitsu_error: null, shirajitsu_annotations: null })

    // Open the sidepanel and signal it that analysis is starting, so it is
    // open and listening before any result or error message is broadcast.
    chrome.sidePanel.open({ tabId: tab.id })
    safeBroadcast({ type: 'ANALYSIS_STARTED' })

    chrome.tabs.sendMessage(tab.id, { type: 'RUN_ANALYSIS' }, (res) => {
      // Check for messaging errors first (content script not injected, chrome:// page, etc.)
      if (chrome.runtime.lastError) {
        broadcastError(
          chrome.runtime.lastError.message ??
            'Could not reach the page. Try reloading the tab and clicking Analyze again.',
        )
        return
      }

      // res may be undefined if the content script called sendResponse(undefined) or if the
      // port was closed without a response (e.g. service-worker cold-start race).
      if (res === undefined || res === null) {
        broadcastError('Could not reach the page. Try reloading the tab and clicking Analyze again.')
        return
      }

      if (res.error) {
        broadcastError(res.error as string)
        return
      }

      setStatus('done')
      // Persist completed state so sidebar can recover it on mount
      chrome.storage.session.set({ shirajitsu_state: 'done', shirajitsu_annotations: JSON.stringify(res.annotations) })
      // Forward annotations to content script (handles inline highlight mode).
      // Use safeTabMessage because the content script may not be present on
      // all page types (chrome://, PDF viewer, etc.). The sidebar receives
      // annotations via the safeBroadcast below; this send only drives the
      // inline highlight path and is non-critical.
      safeTabMessage(tab.id!, {
        type: 'SHOW_ANNOTATIONS',
        payload: { annotations: res.annotations, settings },
      })
      safeBroadcast({
        type: 'SHOW_ANNOTATIONS',
        payload: { annotations: res.annotations, settings },
      })
    })
  }

  function saveDisplayMode(mode: UserSettings['displayMode']) {
    const next = { ...settings, displayMode: mode }
    setSettings(next)
    chrome.storage.sync.set({ displayMode: mode })
  }

  function saveModeOverride(override: UserSettings['manualModeOverride']) {
    const next = { ...settings, manualModeOverride: override }
    setSettings(next)
    chrome.storage.sync.set({ manualModeOverride: override })
  }

  function saveModel(model: AIModel) {
    const next = { ...settings, selectedModel: model }
    setSettings(next)
    chrome.storage.sync.set({ selectedModel: model })
  }

  return (
    <div className="popup">
      <header className="popup__header">
        <span className="popup__logo">真実</span>
        <span className="popup__title">Shirajitsu</span>
      </header>

      <div className="popup__context">
        <span className="popup__mode-label">Mode:</span>
        <button
          className={`popup__mode-btn ${effectiveMode === 'reader' ? 'popup__mode-btn--active' : ''}`}
          onClick={() => saveModeOverride(effectiveMode === 'reader' ? null : 'reader')}
        >
          Reader
        </button>
        <button
          className={`popup__mode-btn ${effectiveMode === 'writer' ? 'popup__mode-btn--active' : ''}`}
          onClick={() => saveModeOverride(effectiveMode === 'writer' ? null : 'writer')}
        >
          Writer
        </button>
        {settings.manualModeOverride && (
          <button className="popup__mode-reset" onClick={() => saveModeOverride(null)}>
            Reset to auto
          </button>
        )}
      </div>

      <button
        className="popup__cta"
        onClick={handleAnalyze}
        disabled={status === 'analyzing'}
      >
        {status === 'analyzing' ? 'Analyzing…' : ctaLabel}
      </button>

      {status === 'error' && <p className="popup__error">{errorMsg}</p>}
      {status === 'done' && <p className="popup__success">Analysis complete — see sidebar</p>}

      <button className="popup__sidebar-btn" onClick={handleOpenSidebar}>
        Open Sidebar
      </button>

      <div className="popup__model">
        <span className="popup__section-label">Model:</span>
        <ModelSelector value={settings.selectedModel} onChange={saveModel} compact />
      </div>

      <div className="popup__display-toggle">
        <span>Display:</span>
        <button
          className={settings.displayMode === 'sidebar' ? 'active' : ''}
          onClick={() => saveDisplayMode('sidebar')}
        >
          Sidebar
        </button>
        <button
          className={settings.displayMode === 'inline' ? 'active' : ''}
          onClick={() => saveDisplayMode('inline')}
        >
          Inline
        </button>
      </div>
    </div>
  )
}
