import { useState, useRef, useEffect } from 'react';
import ThemePanel from './ThemePanel';

function pickRandom(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default function Header({
  hidden,
  theme,
  searchQuery,
  onSearch,
  onSelectTag,
  onToggleSidebar,
  onReset,
  onSwitchTheme,
  allTags,
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [randomTags, setRandomTags] = useState([]);
  const wrapperRef = useRef(null);

  const suggestions = searchQuery.trim()
    ? allTags.filter((t) =>
        t.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : showSuggestions
      ? randomTags
      : [];

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className={`header${hidden ? ' header-hidden' : ''}`}>
      <div className="headerLeft">
        <button className="hdrBtn" onClick={onToggleSidebar} title="菜单">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="logo" onClick={onReset}>
          <svg className="logoIcon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M8 25C11 19 15 11 20 6c1 3 1.5 7.5.5 13-3.5-1-8 0-12.5 6z" style={{ fill: 'var(--ac)' }} opacity=".85"/>
            <path d="M20 6c2.5-1.5 5.5-.5 7 2" stroke="var(--ac)" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".6"/>
          </svg>
          Ark<em>拾页</em>
        </div>
      </div>
      <div className="headerCenter">
        <div className="searchBox" ref={wrapperRef}>
          <svg className="searchIcon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="搜索文章或标签…"
            value={searchQuery}
            onChange={(e) => {
              onSearch(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => {
              setRandomTags(pickRandom(allTags, 5));
              setShowSuggestions(true);
            }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="tagSuggestions">
              {suggestions.map((tag) => (
                <button
                  key={tag}
                  className="tagSuggestion"
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent blur
                    onSelectTag(tag);
                    setShowSuggestions(false);
                  }}
                >
                  <span className="tagSugIcon">#</span>
                  {tag}
                </button>
              ))}
              {!searchQuery.trim() && allTags.length > 5 && (
                <div className="tagSugMore">…</div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="headerRight">
        <ThemePanel theme={theme} onSwitch={onSwitchTheme} />
      </div>
    </header>
  );
}
