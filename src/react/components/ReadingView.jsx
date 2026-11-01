import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { navigate } from "astro:transitions/client";
import { formatCount, postView, saveProgress } from "../lib/api";
import BackToTop from "./BackToTop";
import GiscusComments from "./GiscusComments";
import ImageLightbox from "./ImageLightbox";
import MermaidDiagram from "./MermaidDiagram";
import ProgressBar from "./ProgressBar";
import SiteFooter from "./SiteFooter";
import TOC from "./TOC";

const FONT_KEY = "sy-font-level";
const FONT_LEVELS = [
  { cls: "font-sm", title: "小" },
  { cls: "font-md", title: "中" },
  { cls: "font-lg", title: "大" }
];

const READING_THEMES = [
  { key: "oriental", name: "书卷", swatch: "#F5EFE4" },
  { key: "magazine", name: "杂志", swatch: "#FFF" },
  { key: "night", name: "暗夜", swatch: "#262220" }
];

const themeIconPaths = {
  oriental: (
    <>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </>
  ),
  magazine: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18" />
    </>
  ),
  night: <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
};

export default function ReadingView({
  essay,
  essays,
  essayOrder,
  contentData,
  giscus,
  theme,
  onThemeChange,
  onBack
}) {
  const essayId = essay.id;
  const containerRef = useRef(null);
  const articleRef = useRef(null);
  const topRef = useRef(null);
  const fontBtnRef = useRef(null);
  const viewedRef = useRef(null);
  const chapterIdxRef = useRef(0);
  const isRestoringRef = useRef(true);
  const progressReadyRef = useRef(false);
  const pendingRestoreRef = useRef(null);
  const lastSaveRef = useRef(0);
  const [topScrolled, setTopScrolled] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showBackTop, setShowBackTop] = useState(false);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [fontLevel, setFontLevel] = useState(1);
  const [fontToast, setFontToast] = useState(false);
  const [lightbox, setLightbox] = useState({ src: null, alt: null });
  const [viewCount, setViewCount] = useState(null);
  const [titleTooltip, setTitleTooltip] = useState(null);
  const [diagramSources, setDiagramSources] = useState([]);

  const readingTheme = theme || "oriental";
  const chapters = contentData?.chapters ?? [];
  const hasChapters = chapters.length > 0;
  const currentChapter = chapters[chapterIdx];
  const displayContent = currentChapter?.content ?? contentData?.content ?? "";
  const chapterLabel = hasChapters ? `${chapterIdx + 1} / ${chapters.length}` : "";
  chapterIdxRef.current = chapterIdx;

  useEffect(() => {
    const saved = parseInt(window.localStorage.getItem(FONT_KEY), 10);
    setFontLevel(saved >= 0 && saved <= 2 ? saved : 1);
  }, []);

  const restoreScroll = useCallback(() => {
    const container = containerRef.current;
    const progress = pendingRestoreRef.current;
    pendingRestoreRef.current = null;
    if (!container) {
      progressReadyRef.current = true;
      isRestoringRef.current = false;
      return;
    }

    if (progress == null) container.scrollTo(0, 0);
    else {
      const distance = container.scrollHeight - container.clientHeight;
      container.scrollTo(0, distance > 0 ? Math.min(Math.round((progress / 100) * distance), distance) : 0);
    }
    progressReadyRef.current = true;
    isRestoringRef.current = false;
  }, []);

  const showTitleTooltip = useCallback((event) => {
    const element = event.currentTarget;
    if (element.scrollWidth <= element.clientWidth + 1) return;

    const rect = element.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 24);
    const center = rect.left + rect.width / 2;
    const left = Math.min(
      Math.max(center, 12 + width / 2),
      window.innerWidth - 12 - width / 2
    );
    const text = element.dataset.fullTitle || element.textContent || "";

    setTitleTooltip({ text, left, arrowLeft: center - left, top: rect.bottom + 9, width });
  }, []);

  const hideTitleTooltip = useCallback(() => setTitleTooltip(null), []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    isRestoringRef.current = true;
    progressReadyRef.current = false;
    lastSaveRef.current = 0;

    if (viewedRef.current !== essayId) {
      viewedRef.current = essayId;
      postView(essayId).then((count) => {
        if (count != null) setViewCount(count);
      });
    }

    const hashMatch = window.location.hash.match(/^#c-(\d+)$/);
    let nextChapter = 0;
    if (hashMatch) {
      const hashChapter = parseInt(hashMatch[1], 10) - 1;
      if (hashChapter >= 0 && hashChapter < chapters.length) nextChapter = hashChapter;
    }
    chapterIdxRef.current = nextChapter;
    setChapterIdx(nextChapter);
    pendingRestoreRef.current = null;
    requestAnimationFrame(() => requestAnimationFrame(restoreScroll));

    return () => {
    };
  }, [chapters.length, essayId, restoreScroll]);

  useEffect(() => {
    const element = articleRef.current;
    if (!element) return;

    const handleClick = (event) => {
      const copyButton = event.target.closest(".codeCopy");
      if (copyButton) {
        const code = copyButton.closest(".codeBlock")?.querySelector("pre code");
        if (!code) return;

        const originalText = copyButton.textContent;
        navigator.clipboard.writeText(code.textContent || "").then(() => {
          copyButton.textContent = "已复制";
          copyButton.classList.add("copied");
          setTimeout(() => {
            copyButton.textContent = originalText;
            copyButton.classList.remove("copied");
          }, 1200);
        }).catch(() => {});
        return;
      }

      const image = event.target.closest("img");
      if (!image) return;
      setLightbox({ src: image.src, alt: image.alt || "" });
    };
    element.addEventListener("click", handleClick);
    return () => element.removeEventListener("click", handleClick);
  }, [chapterIdx, displayContent, essayId]);

  useEffect(() => {
    const element = articleRef.current;
    if (!element) return;

    const diagrams = Array.from(element.querySelectorAll(".mermaidFig"));
    setDiagramSources(diagrams.map((diagram) => decodeURIComponent(diagram.dataset.mermaid || "")));
  }, [chapterIdx, displayContent, essayId]);

  const diagramNodes = articleRef.current?.querySelectorAll(".mermaidFig");

  useLayoutEffect(() => {
    if (isRestoringRef.current) return;
    containerRef.current?.scrollTo(0, 0);
  }, [chapterIdx]);

  useEffect(() => {
    const onHashChange = () => {
      const match = window.location.hash.match(/^#c-(\d+)$/);
      if (!match) return;
      const nextChapter = parseInt(match[1], 10) - 1;
      if (nextChapter >= 0 && nextChapter < chapters.length && nextChapter !== chapterIdxRef.current) {
        setChapterIdx(nextChapter);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [chapters.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let raf = 0;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      raf = requestAnimationFrame(() => {
        const scrollTop = container.scrollTop;
        const distance = container.scrollHeight - container.clientHeight;
        const ratio = distance > 0 ? Math.min((scrollTop / distance) * 100, 100) : 0;

        setTopScrolled(scrollTop > 80);
        setShowBackTop(scrollTop > 400 && scrollTop < distance - 40);
        setReadingProgress(ratio);
        setTitleTooltip(null);

        const now = Date.now();
        if (progressReadyRef.current && now - lastSaveRef.current >= 2000) {
          lastSaveRef.current = now;
          saveProgress(essayId, chapterIdxRef.current, ratio);
        }
        ticking = false;
      });
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [essayId]);

  useEffect(() => {
    setTitleTooltip(null);
  }, [chapterIdx, essayId]);

  useEffect(() => {
    const flush = () => {
      const container = containerRef.current;
      if (!container || !progressReadyRef.current) return;
      const distance = container.scrollHeight - container.clientHeight;
      const ratio = distance > 0 ? Math.min((container.scrollTop / distance) * 100, 100) : 0;
      saveProgress(essayId, chapterIdxRef.current, ratio);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [essayId]);

  const idx = essayOrder.indexOf(essayId);
  const prevEssay = idx > 0 ? essays[essayOrder[idx - 1]] : null;
  const nextEssay = idx >= 0 && idx < essayOrder.length - 1 ? essays[essayOrder[idx + 1]] : null;

  const handleNav = useCallback((id) => {
    navigate(`/articles/${encodeURIComponent(id)}`);
  }, []);

  const handleChapterNav = useCallback((nextIdx) => {
    setChapterIdx(nextIdx);
    const nextState = window.history.state;
    if (nextIdx > 0) window.history.replaceState(nextState, "", `#c-${nextIdx + 1}`);
    else window.history.replaceState(nextState, "", window.location.pathname);
  }, []);

  const buildChapterPills = () => {
    const total = chapters.length;
    if (total <= 5) return Array.from({ length: total }, (_, index) => ({ idx: index, type: "pill" }));

    const items = [];
    const add = (index) => items.push({ idx: index, type: "pill" });
    const dots = () => items.push({ idx: -1, type: "dots" });

    add(0);
    if (chapterIdx <= 2) {
      add(1);
      add(2);
      if (chapterIdx === 2) add(3);
      dots();
    } else if (chapterIdx >= total - 3) {
      dots();
      if (chapterIdx === total - 3) add(total - 4);
      add(total - 3);
      add(total - 2);
    } else {
      dots();
      add(chapterIdx - 1);
      add(chapterIdx);
      add(chapterIdx + 1);
      dots();
    }

    const lastItem = items.at(-1);
    if (lastItem.type === "dots" || lastItem.idx !== total - 1) {
      if (lastItem.type === "dots" && items.length > 1 && items.at(-2).idx === total - 1) items.pop();
      else add(total - 1);
    }
    if (items.length > 1 && items[0].idx === items[1].idx) items.splice(0, 1);
    return items;
  };

  const renderNav = () => {
    if (!hasChapters) {
      return (
        <div className="nav">
          {prevEssay && (
            <div className="navBtn" onClick={() => handleNav(essayOrder[idx - 1])}>
              <span className="nl">← 上一篇</span>
              <span className="nt">{prevEssay.title}</span>
            </div>
          )}
          {nextEssay && (
            <div className="navBtn next" onClick={() => handleNav(essayOrder[idx + 1])}>
              <span className="nl">下一篇 →</span>
              <span className="nt">{nextEssay.title}</span>
            </div>
          )}
        </div>
      );
    }

    const isFirstChapter = chapterIdx === 0;
    const isLastChapter = chapterIdx === chapters.length - 1;
    return (
      <div className="nav">
        {isFirstChapter ? (
          prevEssay ? (
            <div className="navBtn" onClick={() => handleNav(essayOrder[idx - 1])}>
              <span className="nl">← 上一篇</span>
              <span className="nt">{prevEssay.title}</span>
            </div>
          ) : (
            <div />
          )
        ) : (
          <div className="navBtn" onClick={() => handleChapterNav(chapterIdx - 1)}>
            <span className="nl">← 上一章</span>
            <span className="nt">{chapters[chapterIdx - 1].title}</span>
          </div>
        )}

        {isLastChapter ? (
          nextEssay ? (
            <div className="navBtn next" onClick={() => handleNav(essayOrder[idx + 1])}>
              <span className="nl">下一篇 →</span>
              <span className="nt">{nextEssay.title}</span>
            </div>
          ) : (
            <div />
          )
        ) : (
          <div className="navBtn next" onClick={() => handleChapterNav(chapterIdx + 1)}>
            <span className="nl">下一章 →</span>
            <span className="nt">{chapters[chapterIdx + 1].title}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="reading vis" ref={containerRef}>
      <ProgressBar progress={readingProgress} />
      <BackToTop visible={showBackTop} scrollContainer={containerRef} />
      <TOC
        contentRef={articleRef}
        essayId={essayId}
        chapterIdx={chapterIdx}
        scrollContainerRef={containerRef}
      />
      <div className="readingWrap">
        <div className="readingInner">
          <div className={`rdTop${topScrolled ? " scrolled" : ""}`} ref={topRef}>
            <div className="rdTopLeft">
              <button className="rdBack" onClick={onBack} title="返回首页" aria-label="返回首页">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" />
                  <path d="m12 19-7-7 7-7" />
                </svg>
              </button>
              <div className={`rdStickyTitle${topScrolled ? " vis" : ""}`}>
                <span
                  className="rdStickyTitleText"
                  data-full-title={essay.title}
                  onMouseEnter={showTitleTooltip}
                  onMouseLeave={hideTitleTooltip}
                >
                  {essay.title}
                </span>
                {hasChapters && currentChapter && (
                  <span
                    className="rdStickyChapter"
                    data-full-title={currentChapter.title}
                    onMouseEnter={showTitleTooltip}
                    onMouseLeave={hideTitleTooltip}
                  >
                    · {currentChapter.title}
                  </span>
                )}
              </div>
            </div>
            <div className="rdTopR">
              <div className="fontToggleWrap">
                <button
                  ref={fontBtnRef}
                  className="fontToggle"
                  onClick={() => {
                    const next = (fontLevel + 1) % 3;
                    setFontLevel(next);
                    window.localStorage.setItem(FONT_KEY, String(next));
                    setFontToast(true);
                    setTimeout(() => setFontToast(false), 1000);
                    fontBtnRef.current?.blur();
                  }}
                  title="切换字号"
                >
                  {FONT_LEVELS.map((level, index) => (
                    <span key={level.cls} className={`ftDot${index === fontLevel ? " active" : ""}`} />
                  ))}
                </button>
                <span className={`fontHint${fontToast ? " show" : ""}`}>
                  字号：{FONT_LEVELS[fontLevel].title}
                </span>
              </div>
              <button
                className="rdThemeBtn"
                onClick={() => {
                  const keys = READING_THEMES.map((item) => item.key);
                  const themeIdx = keys.indexOf(readingTheme);
                  onThemeChange?.(keys[(themeIdx + 1) % keys.length]);
                }}
                title="切换主题"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  {themeIconPaths[readingTheme] || themeIconPaths.oriental}
                </svg>
              </button>
            </div>
          </div>

          <h1 className="rdTitle">{essay.title}</h1>
          <div className="rdMeta">
            <span className="rdDate">
              {essay.date} · {essay.category}
              {essay.author ? ` · ${essay.author}` : ""}
              {essay.time ? ` · ${essay.time}` : ""}
            </span>
            {viewCount != null && (
              <span className="rdViews">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {formatCount(viewCount)} 次阅读
              </span>
            )}
            <div className="rdTags">
              {essay.tags.map((tag) => (
                <span key={tag} className="rdTag">{tag}</span>
              ))}
            </div>
          </div>

          {essay.cover && chapterIdx === 0 && (
            <div className="rdCover" onClick={() => setLightbox({ src: essay.cover, alt: essay.title })}>
              <img src={essay.cover} alt={essay.title} />
            </div>
          )}

          {hasChapters && (
            <div className="rdChapterBar">
              <div className="rdChapterHeading">
                <span className="rdChapterEyebrow">—— {chapterLabel} ——</span>
                <h2 className="rdChapterTitle">{currentChapter?.title || ""}</h2>
              </div>
              <div className="rdChapterPills">
                {buildChapterPills().map((item, index) =>
                  item.type === "dots" ? (
                    <span key={`dots-${index}`} className="rdChDots">…</span>
                  ) : (
                    <button
                      key={item.idx}
                      className={`rdChPill${item.idx === chapterIdx ? " active" : ""}`}
                      onClick={() => handleChapterNav(item.idx)}
                    >
                      {item.idx + 1}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          <div
            ref={articleRef}
            className={`article ${FONT_LEVELS[fontLevel].cls}`}
            dangerouslySetInnerHTML={{ __html: displayContent }}
          />
          {diagramSources.map((source, index) => {
            const target = diagramNodes?.[index];
            return target && source
              ? createPortal(
                  <MermaidDiagram
                    source={source}
                    index={index}
                    theme={readingTheme}
                  />,
                  target
                )
              : null;
          })}
          {renderNav()}
          <GiscusComments config={giscus} theme={readingTheme} />
          <SiteFooter />
        </div>
      </div>
      {lightbox.src && (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox({ src: null, alt: null })}
        />
      )}
      {titleTooltip && (
        <div
          className="rdTitleTooltip"
          role="tooltip"
          style={{
            left: `${titleTooltip.left}px`,
            "--arrow-left": `${titleTooltip.arrowLeft}px`,
            top: `${titleTooltip.top}px`,
            width: `${titleTooltip.width}px`
          }}
        >
          {titleTooltip.text}
        </div>
      )}
    </div>
  );
}
