import { useState, useEffect, useRef } from 'react';

const themes = [
  {
    key: 'oriental',
    name: '东方书卷',
    desc: '纸色温黄，墨香如故',
    swatch: '#F5EFE4',
    swatchBorder: false,
  },
  {
    key: 'magazine',
    name: '现代杂志',
    desc: '干净利落，独立编辑',
    swatch: '#FFF',
    swatchBorder: true,
  },
  {
    key: 'night',
    name: '暗夜护眼',
    desc: '暖棕柔光，静心夜读',
    swatch: '#262220',
    swatchBorder: false,
  },
];

const themeIconPaths = {
  oriental: (
    <>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <path d="M9 7h6M9 11h4" />
    </>
  ),
  magazine: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18" />
    </>
  ),
  night: <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />,
};

export default function ThemePanel({ theme, onSwitch }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSwitch = (key) => {
    onSwitch(key);
    setOpen(false);
  };

  return (
    <div className="themeDrop" ref={ref}>
      <button className="hdrBtn" onClick={() => setOpen((o) => !o)} title="阅读模式">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          {themeIconPaths[theme] || themeIconPaths.oriental}
        </svg>
      </button>
      <div className={`themePanel ${open ? 'open' : ''}`}>
        {themes.map((t) => (
          <button
            key={t.key}
            className={`themeOpt ${theme === t.key ? 'active' : ''}`}
            onClick={() => handleSwitch(t.key)}
          >
            <div
              className="themeSwatch"
              style={{
                background: t.swatch,
                ...(t.swatchBorder ? { border: '1px solid #E5E7EB' } : {}),
              }}
            >
              {theme === t.key && '✓'}
            </div>
            <div className="themeInfo">
              <span className="themeName">{t.name}</span>
              <span className="themeDesc">{t.desc}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
