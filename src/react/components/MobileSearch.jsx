import { useState, useRef, useEffect, useMemo } from 'react';
import { matchesEssaySearch } from '../lib/search';

function pickRandom(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default function MobileSearch({
  open,
  searchQuery,
  onSearch,
  onSelectTag,
  onClose,
  onSelectEssay,
  allTags,
  allEssays,
  essayOrder,
}) {
  const [localQuery, setLocalQuery] = useState(searchQuery || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [randomTags, setRandomTags] = useState([]);
  const inputRef = useRef(null);

  const tagSuggestions = localQuery.trim()
    ? (allTags || []).filter((t) =>
        t.toLowerCase().includes(localQuery.trim().toLowerCase())
      )
    : showSuggestions
      ? randomTags
      : [];

  // Real-time preview: filter essays matching localQuery
  const previewResults = useMemo(() => {
    const q = localQuery.trim().toLowerCase();
    if (!q) return [];
    let list = (essayOrder || []).map((id) => allEssays?.[id]).filter(Boolean);
    return list.filter((essay) => matchesEssaySearch(essay, q)).slice(0, 20);
  }, [localQuery, allEssays, essayOrder]);

  // Focus input when search page opens.
  // iOS Safari requires the input to be VISIBLE (not visibility:hidden, not display:none,
  // not off-screen) at the time focus() is called, otherwise it silently ignores the call.
  //
  // The previous approach used animationend + setTimeout which had two issues:
  // 1. animationend might not fire if the animation was skipped
  // 2. The focus() was too far from the user gesture call stack
  //
  // New approach: the CSS animation (slideUp) starts from translateY(30%) not from
  // display:none, so the input IS in the viewport immediately. We just need a short
  // delay for React to commit the DOM, then focus.
  useEffect(() => {
    if (!open) return;

    setLocalQuery(searchQuery || '');
    setRandomTags(pickRandom(allTags || [], 8));
    setShowSuggestions(false);

    // Use a simple two-stage focus:
    // 1. requestAnimationFrame: ensures React has committed the DOM
    // 2. setTimeout(50): small grace period for layout/paint
    let cancelled = false;
    requestAnimationFrame(() => {
      if (cancelled) return;
      setTimeout(() => {
        if (cancelled) return;
        inputRef.current?.focus({ preventScroll: true });
      }, 50);
    });
    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    const q = localQuery.trim();
    if (q) {
      onSearch(q);
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelectTag = (tag) => {
    onSelectTag(tag);
    onClose();
  };

  const handleSelectEssay = (id) => {
    onClose();
    setTimeout(() => onSelectEssay(id), 50);
  };

  const handlePageClick = (e) => {
    if (!e.target.closest('.mobileSearchBar') && !e.target.closest('button')) {
      onClose();
    }
  };

  // Prevent body scroll when search page is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const hasQuery = localQuery.trim().length > 0;

  return (
    <div className="mobileSearchPage" onClick={handlePageClick}>
      <div className="mobileSearchBar" onClick={(e) => e.stopPropagation()}>
        <button className="mobileSearchBack" onClick={onClose} aria-label="返回">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="mobileSearchInputWrap">
          <svg className="mobileSearchInputIcon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="搜索标题、摘要、作者或标签…"
            value={localQuery}
            onChange={(e) => {
              setLocalQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => {
              setRandomTags(pickRandom(allTags || [], 8));
              setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
          />
          {localQuery && (
            <button className="mobileSearchClear" onClick={() => { setLocalQuery(''); inputRef.current?.focus(); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button className="mobileSearchBtn" onClick={handleSearch}>
          搜索
        </button>
      </div>

      <div className="mobileSearchContent">
        {hasQuery && previewResults.length > 0 && (
          <div className="mobileSearchResults">
            <div className="mobileSearchResultsLabel">
              找到 {previewResults.length} 篇相关文章
            </div>
            {previewResults.map((e) => (
              <button
                key={e.id}
                className="mobileSearchResult"
                onClick={() => handleSelectEssay(e.id)}
              >
                <span className="mobileSearchResultTitle">{e.title}</span>
                <span className="mobileSearchResultMeta">
                  {e.author && <>{e.author} · </>}
                  {e.category}
                </span>
              </button>
            ))}
          </div>
        )}

        {hasQuery && previewResults.length === 0 && (
          <div className="mobileSearchHint">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" width="40" height="40" opacity="0.3">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p>未找到相关文章</p>
          </div>
        )}

        {!hasQuery && showSuggestions && tagSuggestions.length > 0 && (
          <div className="mobileSearchTags">
            <div className="mobileSearchTagsLabel">热门标签</div>
            <div className="mobileSearchTagsList">
              {tagSuggestions.map((tag) => (
                <button
                  key={tag}
                  className="mobileSearchTag"
                  onClick={() => handleSelectTag(tag)}
                >
                  <span className="tagSugIcon">#</span>
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {!hasQuery && !showSuggestions && (
          <div className="mobileSearchHint">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" width="40" height="40" opacity="0.3">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p>输入关键词搜索文章标题、摘要、作者、译者或标签</p>
          </div>
        )}
      </div>
    </div>
  );
}
