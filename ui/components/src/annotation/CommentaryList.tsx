import type { CommentaryItem } from '@shirajitsu/types'

export function CommentaryList({ items }: { items: CommentaryItem[] }) {
  return (
    <ul className="commentary-list">
      {items.map((item, i) => (
        <li key={i} className="commentary-list__item">
          <span className="commentary-list__label">
            A participant in public discussion adds context — unverified
          </span>
          <p className="commentary-list__text">{item.text}</p>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="commentary-list__link"
          >
            View source
          </a>
        </li>
      ))}
    </ul>
  )
}
