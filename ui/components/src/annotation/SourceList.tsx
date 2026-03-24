import type { SourceResult } from '@shirajitsu/types'

export function SourceList({ sources }: { sources: SourceResult[] }) {
  return (
    <ul className="source-list">
      {sources.map((source) => (
        <li key={source.url} className="source-list__item">
          <span className={`source-list__tier source-list__tier--${source.tier}`}>
            {source.tierLabel}
          </span>
          {source.accessible ? (
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="source-list__link">
              {source.title}
            </a>
          ) : (
            <span className="source-list__restricted">{source.title} (restricted)</span>
          )}
          {source.summary && (
            <p className="source-list__summary">{source.summary}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
