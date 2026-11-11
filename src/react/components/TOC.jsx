import { useEffect, useRef, useState, useCallback } from 'react';

export default function TOC({ contentRef, essayId, chapterIdx, scrollContainerRef }) {
  const [headings, setHeadings] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const navRef = useRef(null);
  const [progress, setProgress] = useState({ top: 0, height: 0 });

  useEffect(() => {
    setHeadings([]);
    setActiveId(null);
    const raf = requestAnimationFrame(() => {
      if (!contentRef.current) return;
      const hs = contentRef.current.querySelectorAll('h2[id], h3[id]');
      const items = [...hs].map((h) => ({
        id: h.id,
        text: h.textContent,
        level: h.tagName,
      }));
      setHeadings(items);
    });
    return () => cancelAnimationFrame(raf);
  }, [contentRef, essayId, chapterIdx]);

  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!headings.length || !container) return;

    let frame = 0;

    const updateActiveId = () => {
      const containerRect = container.getBoundingClientRect();
      const threshold = containerRect.top + 120;
      let current = null;

      for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (!element) continue;
        if (element.getBoundingClientRect().top <= threshold) current = heading.id;
        else break;
      }

      const isAtBottom = container.scrollTop + container.clientHeight
        >= container.scrollHeight - 4;
      if (isAtBottom && headings.length) current = headings.at(-1).id;

      setActiveId(current);
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateActiveId);
    };

    updateActiveId();
    container.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    const articleObserver = contentRef.current
      ? new ResizeObserver(scheduleUpdate)
      : null;
    articleObserver?.observe(contentRef.current);

    return () => {
      container.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      articleObserver?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [chapterIdx, essayId, headings, scrollContainerRef]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const measureProgress = () => {
      const activeItem = activeId
        ? nav.querySelector(`[data-heading-id="${CSS.escape(activeId)}"]`)
        : null;

      if (!activeItem) {
        setProgress({ top: 0, height: 0 });
        return;
      }

      const firstItem = nav.querySelector('.tocLnk');
      const top = firstItem.offsetTop;
      setProgress({
        top,
        height: Math.max(0, activeItem.offsetTop + activeItem.offsetHeight - top),
      });
    };

    measureProgress();
    const navObserver = new ResizeObserver(measureProgress);
    navObserver.observe(nav);

    return () => navObserver.disconnect();
  }, [activeId, headings]);

  const handleClick = useCallback((id) => {
    const el = document.getElementById(id);
    const container = scrollContainerRef?.current;
    if (el && container) {
      const headerOffset = 80;
      const top = el.getBoundingClientRect().top
        - container.getBoundingClientRect().top
        + container.scrollTop
        - headerOffset;
      container.scrollTo({ top, behavior: 'smooth' });
    }
  }, [scrollContainerRef]);

  if (!headings.length) return null;

  const activeIndex = headings.findIndex((heading) => heading.id === activeId);

  return (
    <div className="toc">
      <div className="tocHeading">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M8 12h12M8 17h12" />
        </svg>
        <span>本页目录</span>
      </div>
      <nav
        ref={navRef}
        className="tocNav"
        aria-label="本页目录"
        style={{ '--toc-progress-top': `${progress.top}px`, '--toc-progress-height': `${progress.height}px` }}
      >
        {headings.map((heading, index) => {
          const isActive = heading.id === activeId;
          const isPassed = activeIndex >= 0 && index < activeIndex;
          return (
            <a
              key={heading.id}
              data-heading-id={heading.id}
              className={`tocLnk${heading.level === 'H3' ? ' sub' : ''}${isActive ? ' active' : ''}${isPassed ? ' passed' : ''}`}
              aria-current={isActive ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault();
                handleClick(heading.id);
              }}
            >
              {heading.text}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
