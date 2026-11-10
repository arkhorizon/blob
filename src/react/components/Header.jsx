import { useState, useRef, useEffect } from 'react';
import ThemePanel from './ThemePanel';
import { TIME_RANGES } from '../lib/search';

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
  timeRange = 'all',
  onTimeRangeChange,
  onReset,
  onSwitchTheme,
  allTags,
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showTimeOptions, setShowTimeOptions] = useState(false);
  const [randomTags, setRandomTags] = useState([]);
  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);
  const selectedTimeRange = TIME_RANGES.find((range) => range.value === timeRange);

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
        setShowTimeOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className={`header${hidden ? ' header-hidden' : ''}`}>
      <div className="headerLeft">
        <div className="logo" onClick={onReset}>
          <span>Ark<em>拾页</em></span>
        </div>
      </div>
      <div className="headerCenter">
        <div className={`searchBox${selectedTimeRange ? ' hasTimeRange' : ''}`} ref={wrapperRef}>
          <button
            type="button"
            className={`searchFilterTrigger${timeRange !== 'all' ? ' active' : ''}`}
            aria-expanded={showTimeOptions}
            aria-controls="searchTimeOptions"
            aria-label={selectedTimeRange ? `高级搜索：${selectedTimeRange.label}` : '高级搜索'}
            title={selectedTimeRange ? `高级搜索：${selectedTimeRange.label}` : '高级搜索'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setShowTimeOptions((current) => !current);
              setShowSuggestions(false);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            {selectedTimeRange && (
              <span className="searchFilterBadge">{selectedTimeRange.value.charAt(0)}</span>
            )}
          </button>
          {showTimeOptions && (
            <div className="timeOptions" id="searchTimeOptions" role="menu">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={timeRange === 'all'}
                className={`timeOption${timeRange === 'all' ? ' active' : ''}`}
                onClick={() => {
                  onTimeRangeChange?.('all');
                  setShowTimeOptions(false);
                }}
              >
                全部时间
              </button>
              {TIME_RANGES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={timeRange === value}
                  className={`timeOption${timeRange === value ? ' active' : ''}`}
                  onClick={() => {
                    onTimeRangeChange?.(value);
                    setShowTimeOptions(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <input
            ref={searchInputRef}
            type="text"
            placeholder="搜索标题、摘要、作者或标签…"
            value={searchQuery}
            onChange={(e) => {
              onSearch(e.target.value);
              setShowSuggestions(true);
              setShowTimeOptions(false);
            }}
            onFocus={() => {
              setRandomTags(pickRandom(allTags, 5));
              setShowSuggestions(true);
              setShowTimeOptions(false);
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className="searchClear"
              aria-label="清除搜索内容"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSearch('');
                searchInputRef.current?.focus();
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
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
                    setShowTimeOptions(false);
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
