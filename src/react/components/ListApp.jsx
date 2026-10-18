import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "astro:transitions/client";
import BackToTop from "./BackToTop";
import ErrorBoundary from "./ErrorBoundary";
import Header from "./Header";
import ListView from "./ListView";
import MobileSearch from "./MobileSearch";
import Sidebar from "./Sidebar";
import SidebarOverlay from "./SidebarOverlay";
import SiteFooter from "./SiteFooter";
import { getViews, readCachedViews } from "../lib/api";
import { useIsMobile } from "../hooks/useMediaQuery";

function getInitialTheme() {
  if (typeof window === "undefined") return "oriental";
  try {
    return window.localStorage.getItem("sy-theme") || document.documentElement.dataset.theme || "oriental";
  } catch {
    return document.documentElement.dataset.theme || "oriental";
  }
}

function restoreNavigationState() {
  const state = window.history.state;
  if (!state?.listState || !state?.listScrollY) return;
  setActiveCategory(state.listState.activeCategory ?? null);
  setActiveTags(new Set(state.listState.activeTags ?? []));
  setSearchQuery(state.listState.searchQuery ?? "");
  requestAnimationFrame(() => window.scrollTo(state.listScrollX ?? 0, state.listScrollY));
}

function saveNavigationState(activeCategory, activeTags, searchQuery) {
  const state = window.history.state;
  const { scrollX, scrollY } = window;
  window.history.replaceState(
    {
      ...state,
      listState: { activeCategory, activeTags: [...activeTags], searchQuery },
      listScrollX: scrollX,
      listScrollY: scrollY
    },
    ""
  );
}

function navigateToEssay(id) {
  navigate(`/e/${encodeURIComponent(id)}`);
}

export default function ListApp({ index: initialIndex }) {
  const isMobile = useIsMobile();
  const [theme, setTheme] = useState(getInitialTheme);
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeTags, setActiveTags] = useState(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [fullTextIds, setFullTextIds] = useState(() => new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [showBackTop, setShowBackTop] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [viewsMap, setViewsMap] = useState({});
  const searchSequence = useRef(0);

  const { essays, essayOrder, allTags, categories } = initialIndex;
  const latestDate = essayOrder.length ? essays[essayOrder[0]]?.date : "";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("sy-theme", theme);
  }, [theme]);

  useEffect(() => {
    restoreNavigationState();
    const onBeforePreparation = () => saveNavigationState(activeCategory, activeTags, searchQuery);
    document.addEventListener("astro:before-preparation", onBeforePreparation);
    return () => document.removeEventListener("astro:before-preparation", onBeforePreparation);
  }, [activeCategory, activeTags, searchQuery]);

  useEffect(() => {
    let cancelled = false;
    const cachedViews = readCachedViews(essayOrder);
    if (Object.keys(cachedViews).length) setViewsMap(cachedViews);
    getViews(essayOrder).then((views) => {
      if (!cancelled) setViewsMap(views);
    });
    return () => {
      cancelled = true;
    };
  }, [essayOrder]);

  useEffect(() => {
    let raf = 0;
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      raf = requestAnimationFrame(() => {
        setShowBackTop(window.scrollY > 400);
        ticking = false;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setFullTextIds(new Set());
      return;
    }

    const sequence = ++searchSequence.current;
    const timer = setTimeout(async () => {
      try {
        const pagefindUrl = "/pagefind/pagefind.js";
        const pagefind = await import(/* @vite-ignore */ pagefindUrl);
        const result = await pagefind.search(query);
        if (sequence !== searchSequence.current) return;
        const ids = new Set();
        for (const item of result.results) {
          const data = await item.data();
          const match = data.url.match(/\/e\/([^/?#]+)/);
          if (match) ids.add(decodeURIComponent(match[1]));
        }
        if (sequence === searchSequence.current) setFullTextIds(ids);
      } catch {
        if (sequence === searchSequence.current) setFullTextIds(new Set());
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSearchQuery("");
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        event.preventDefault();
        document.querySelector(".searchBox input")?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const closeSidebarMobile = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const handleToggleSidebar = useCallback(() => {
    if (isMobile) setSidebarOpen((open) => !open);
    else setSidebarCollapsed((collapsed) => !collapsed);
  }, [isMobile]);

  const handleReset = useCallback(() => {
    setActiveCategory(null);
    setActiveTags(new Set());
    setSearchQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    setActiveCategory(null);
    setActiveTags(new Set());
  }, []);

  const handleToggleCategory = useCallback(
    (category) => {
      setActiveCategory((current) => (current === category ? null : category));
      setActiveTags(new Set());
      setSearchQuery("");
      if (isMobile) closeSidebarMobile();
    },
    [closeSidebarMobile, isMobile]
  );

  const handleToggleTag = useCallback(
    (tag) => {
      setActiveTags((current) => {
        const next = new Set(current);
        if (next.has(tag)) next.delete(tag);
        else next.add(tag);
        return next;
      });
      setActiveCategory(null);
      setSearchQuery("");
      if (isMobile) closeSidebarMobile();
    },
    [closeSidebarMobile, isMobile]
  );

  const handleSelectTag = useCallback((tag) => {
    setSearchQuery("");
    setActiveCategory(null);
    setActiveTags(new Set([tag]));
  }, []);

  const filteredEssays = useMemo(() => {
    let list = essayOrder.map((id) => essays[id]).filter(Boolean);
    if (activeCategory) list = list.filter((essay) => essay.category === activeCategory);
    if (activeTags.size) {
      list = list.filter((essay) => [...activeTags].some((tag) => essay.tags.includes(tag)));
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (essay) =>
          fullTextIds.has(essay.id) ||
          essay.title.toLowerCase().includes(query) ||
          essay.summary.toLowerCase().includes(query) ||
          essay.author.toLowerCase().includes(query) ||
          essay.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }
    return list;
  }, [activeCategory, activeTags, essays, essayOrder, fullTextIds, searchQuery]);

  const headerInfo = useMemo(() => {
    const query = searchQuery.trim();
    const hasFilter = Boolean(activeCategory || activeTags.size || query);
    if (query) return { title: `搜索「${query}」`, subtitle: "", showClear: hasFilter };
    if (activeTags.size) return { title: "话题", subtitle: "", showClear: hasFilter };
    if (activeCategory) return { title: activeCategory, subtitle: "", showClear: hasFilter };
    return {
      title: "全部短文",
      subtitle: `共 ${essayOrder.length} 篇 · 最近更新于 ${latestDate}`,
      showClear: false
    };
  }, [activeCategory, activeTags, essayOrder.length, latestDate, searchQuery]);

  return (
    <ErrorBoundary resetLabel="重新加载" onReset={() => window.location.reload()}>
      <BackToTop visible={showBackTop} />
      <SidebarOverlay show={isMobile && sidebarOpen} onClose={closeSidebarMobile} />
      <Header
        theme={theme}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        onSelectTag={handleSelectTag}
        onToggleSidebar={handleToggleSidebar}
        onReset={handleReset}
        onSwitchTheme={setTheme}
        allTags={allTags}
      />
      <div className="app">
        <Sidebar
          activeCategory={activeCategory}
          collapsed={!isMobile && sidebarCollapsed}
          mobileOpen={isMobile && sidebarOpen}
          onToggleCategory={handleToggleCategory}
          onToggleSidebar={handleToggleSidebar}
          essays={essays}
          categories={categories}
        />
        <main className="main">
          <ListView
            title={headerInfo.title}
            subtitle={headerInfo.subtitle}
            showClear={headerInfo.showClear}
            onClear={handleReset}
            essays={filteredEssays}
            onSelectEssay={navigateToEssay}
            activeTags={activeTags}
            onRemoveTag={(tag) =>
              setActiveTags((current) => {
                const next = new Set(current);
                next.delete(tag);
                return next;
              })
            }
            onTagClick={handleToggleTag}
            onOpenMobileSearch={() => setMobileSearchOpen(true)}
            searchQuery={searchQuery}
            viewsMap={viewsMap}
          />
          <SiteFooter />
        </main>
      </div>
      <MobileSearch
        open={mobileSearchOpen}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        onSelectTag={handleSelectTag}
        onSelectEssay={navigateToEssay}
        onClose={() => setMobileSearchOpen(false)}
        allTags={allTags}
        allEssays={essays}
        essayOrder={essayOrder}
      />
    </ErrorBoundary>
  );
}
