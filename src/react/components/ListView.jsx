import { useState } from 'react';
import CardGrid from './CardGrid';

export default function ListView({
  title,
  subtitle,
  showClear,
  onClear,
  essays,
  onSelectEssay,
  activeTags,
  onRemoveTag,
  onTagClick,
  onOpenMobileSearch,
  searchQuery,
  viewsMap,
  animate = true,
}) {
  return (
    <div className="listView">
      <div className="listHdr">
        <div className="listHdrRow">
          <h2>{title}</h2>
          <div className="listHdrActions">
            {/* Search icon button — opens full-screen search on mobile */}
            {!showClear && (
              <button
                className="listSearchToggle"
                onClick={onOpenMobileSearch}
                title="搜索"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </button>
            )}
            {/* Clear filter button */}
            <button
              className={`clearBtn${showClear ? ' vis' : ''}`}
              onClick={onClear}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              清除筛选
            </button>
          </div>
        </div>
        <div className="listHdrSub">
          <p>{subtitle}</p>
        </div>
        {activeTags && activeTags.size > 0 && (
          <div className="activeTags">
            {[...activeTags].map((tag) => (
              <span key={tag} className="activeTagChip">
                {tag}
                <button
                  className="chipX"
                  onClick={() => onRemoveTag(tag)}
                  aria-label={`移除话题 ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <CardGrid
        essays={essays}
        onSelectEssay={onSelectEssay}
        onTagClick={onTagClick}
        searchQuery={searchQuery}
        viewsMap={viewsMap}
        animate={animate}
      />
    </div>
  );
}
