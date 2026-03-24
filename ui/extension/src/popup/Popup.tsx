import React, { useEffect, useState } from 'react'
import type { DetectedContext } from '@/context/detector'
import type { UserSettings } from '@shirajitsu/types'
import { DEFAULT_USER_SETTINGS } from '@shirajitsu/types'

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
        if (res?.context) setContext(res.context as DetectedContext)
      })
    })
  }, [])

  const effectiveMode = settings.manualModeOverride ?? context?.mode ?? 'reader'
  const ctaLabel = effectiveMode === 'writer' ? 'Analyze my draft' : 'Analyze this article'

  async function handleAnalyze() {
    setStatus('analyzing')
    setErrorMsg('')
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    chrome.tabs.sendMessage(tab.id, { type: 'RUN_ANALYSIS' }, (res) => {
      if (res?.error) {
        setStatus('error')
        setErrorMsg(res.error as string)
      } else {
        setStatus('done')
        // Forward annotations to sidebar
        chrome.tabs.sendMessage(tab.id!, {
          type: 'SHOW_ANNOTATIONS',
          payload: { annotations: res.annotations, settings },
        })
        chrome.sidePanel.open({ tabId: tab.id! })
      }
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
