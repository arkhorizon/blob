import { formatCount } from '../lib/api';

/** Highlight occurrences of `query` inside `text` with <mark> tags. */
function HighlightText({ text, query }) {
  if (!query || !query.trim()) return text;
  const esc = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const splitRe = new RegExp(`(${esc})`, 'gi');
  const testRe = new RegExp(`^${esc}$`, 'i'); // no 'g' flag — avoids lastIndex bug
  const parts = text.split(splitRe);
  if (parts.length === 1) return text;
  return parts.filter(Boolean).map((part, i) =>
    testRe.test(part)
      ? <mark key={i} className="searchHL">{part}</mark>
      : part
  );
}

export default function CardGrid({ essays, onSelectEssay, onTagClick, searchQuery, viewsMap }) {
  if (!essays.length) {
    return (
      <div className="listView">
        <p className="emptyState">没有找到匹配的短文</p>
      </div>
    );
  }

  return (
    <div className="grid">
      {essays.map((e, i) => {
        const viewsCount = viewsMap?.[e.id] || 0;
        return (
          <div
            key={e.id}
            className="card"
            style={{ animationDelay: `${i * 0.06}s` }}
            onClick={() => onSelectEssay(e.id)}
          >
            <div className="cardImgW">
              {e.cover ? (
                <img
                  className="cardImg"
                  src={e.cover}
                  alt={e.title}
                  loading="lazy"
                  decoding="async"
                  ref={(image) => {
                    if (image?.complete && image.naturalWidth > 0) image.classList.add("loaded");
                  }}
                  onLoad={(event) => event.currentTarget.classList.add("loaded")}
                />
              ) : (
                <div className="cardImg cardImgPlaceholder" />
              )}
            </div>
            <div className="cardBody">
              <div className="cardTitle">
                <HighlightText text={e.title} query={searchQuery} />
              </div>
              <div className="cardMeta">
                {e.author && <span className="cardAuthor">{e.author}</span>}
                <span className="cardDate">{e.date}</span>
                <span className="cardCat">{e.category}</span>
                <span className="cardTime">{e.time}</span>
              </div>
              <div className="cardSum">
                <HighlightText text={e.summary} query={searchQuery} />
              </div>
              <div className="cardFt">
                <div className="cardTags">
                  {e.tags.map((t) => (
                    <span
                      key={t}
                      className={`cardTag${searchQuery && t.toLowerCase().includes(searchQuery.toLowerCase()) ? ' cardTagHL' : ''}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onTagClick?.(t);
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="cardFtR">
                  <span className="cardViews" title={`${viewsCount} 次阅读`}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    {formatCount(viewsCount)}
                  </span>
                  <span className="cardRead">阅读 →</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
