import { useMemo } from 'react';

export default function Sidebar({
  activeCategory,
  collapsed,
  mobileOpen,
  onToggleCategory,
  onToggleSidebar,
  essays,
  categories,
  reading,
}) {
  const categoryCounts = useMemo(() => {
    const counts = {};
    const all = Object.values(essays);
    categories.forEach((cat) => {
      counts[cat] = all.filter((e) => e.category === cat).length;
    });
    return counts;
  }, [essays, categories]);

  const sidebarClass = `sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' open' : ''}`;

  // In reading view, hide the collapse toggle — sidebar stays collapsed
  if (reading) {
    return (
      <aside className="sidebar collapsed">
        <div className="sidebarInner" />
      </aside>
    );
  }

  return (
    <aside className={sidebarClass}>
      <button
        className="sideToggle"
        onClick={onToggleSidebar}
        title={collapsed ? '展开菜单' : '收起菜单'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18" />
          <path d={collapsed ? 'M16 9l3 3-3 3' : 'M19 9l-3 3 3 3'} />
        </svg>
      </button>
      <div className="sidebarInner">
        <div className="sidebarSection">
          <div className="sidebarLabel">分类目录</div>
          {categories.map((cat) => (
            <div key={cat}>
              <div
                className={`catHdr${activeCategory === cat ? ' activeCat' : ''}`}
                onClick={() => onToggleCategory(cat)}
              >
                {cat}
                <span className="cnt">{categoryCounts[cat]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
