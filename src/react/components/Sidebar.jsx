import { useMemo } from 'react';

export default function Sidebar({
  activeCategory,
  collapsed,
  mobileOpen,
  pinned,
  onToggleCategory,
  onToggleSidebar,
  essays,
  categories,
}) {
  const categoryCounts = useMemo(() => {
    const counts = {};
    const all = Object.values(essays);
    categories.forEach((cat) => {
      counts[cat] = all.filter((e) => e.category === cat).length;
    });
    return counts;
  }, [essays, categories]);

  const isHidden = collapsed && !mobileOpen;
  const shellClass = `sidebarShell${collapsed ? ' collapsed' : ''}${pinned ? ' pinned' : ''}`;
  const sidebarClass = `sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' open' : ''}${
    pinned ? ' pinned' : ''
  }`;

  return (
    <div className={shellClass}>
      <button
        type="button"
        className="logoTrigger"
        onClick={onToggleSidebar}
        title={pinned ? '收起菜单' : '展开菜单'}
        aria-label={pinned ? '收起菜单' : '展开菜单'}
        aria-expanded={!isHidden}
        aria-haspopup="true"
        aria-controls="homeSidebar"
      >
        <svg className="logoTriggerMark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M8 25C11 19 15 11 20 6c1 3 1.5 7.5.5 13-3.5-1-8 0-12.5 6z" style={{ fill: 'var(--ac)' }} opacity=".85"/>
          <path d="M20 6c2.5-1.5 5.5-.5 7 2" stroke="var(--ac)" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".6"/>
        </svg>
        <svg
          className="logoTriggerExpand"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18" />
          <path d="m15.5 9 3 3-3 3" />
        </svg>
        <svg
          className="logoTriggerCollapse"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18" />
          <path d="m18.5 9-3 3 3 3" />
        </svg>
      </button>
      <aside
        id="homeSidebar"
        className={sidebarClass}
        aria-label="分类目录"
        aria-hidden={isHidden}
        inert={isHidden ? '' : undefined}
      >
        <div className="sidebarInner">
          <div className="sidebarSection">
            <div className="sidebarLabel">分类目录</div>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`catHdr${activeCategory === cat ? ' activeCat' : ''}`}
                onClick={() => onToggleCategory(cat)}
              >
                {cat}
                <span className="cnt">{categoryCounts[cat]}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
