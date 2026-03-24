import { useEffect, useState } from 'react'
import type { Annotation } from '@shirajitsu/types'
import { AnnotationCard } from '@shirajitsu/react'

export function Sidebar() {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'done'>('idle')

  useEffect(() => {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SHOW_ANNOTATIONS') {
        setAnnotations(message.payload.annotations as Annotation[])
        setStatus('done')
      }
      if (message.type === 'ANALYSIS_STARTED') {
        setStatus('analyzing')
      }
    })
  }, [])

  function toggleExpand(offset: number) {
    setExpanded((prev) => ({ ...prev, [offset]: !prev[offset] }))
  }

  return (
    <div className="sidebar">
      <header className="sidebar__header">
        <span className="sidebar__logo">真実</span>
        <h1 className="sidebar__title">Shirajitsu</h1>
      </header>

      <div className="sidebar__body">
        {status === 'idle' && (
          <p className="sidebar__empty">
            Run an analysis from the extension popup to see annotations here.
          </p>
        )}

        {status === 'analyzing' && (
          <p className="sidebar__loading">Analyzing claims…</p>
        )}

        {status === 'done' && annotations.length === 0 && (
          <p className="sidebar__empty">No checkable factual claims found.</p>
        )}

        {annotations.map((annotation) => (
          <AnnotationCard
            key={annotation.claim.charOffset}
            annotation={annotation}
            expanded={!!expanded[annotation.claim.charOffset]}
            onToggleExpand={() => toggleExpand(annotation.claim.charOffset)}
          />
        ))}
      </div>

      <footer className="sidebar__footer">
        <p className="sidebar__disclaimer">
          Shirajitsu surfaces tension, not verdicts. A human is always in the loop.
        </p>
        <a href="#" className="sidebar__registry-link">View source registry</a>
      </footer>
    </div>
  )
}
