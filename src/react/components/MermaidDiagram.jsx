import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;

const icons = {
  minus: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </>
  ),
  plus: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  expand: (
    <>
      <path d="M15 4h5v5" />
      <path d="M20 4l-6 6" />
      <path d="M9 20H4v-5" />
      <path d="m4 20 6-6" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  )
};

function ActionButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      className="mermaidAction"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

export default function MermaidDiagram({ source, index, theme }) {
  const rawId = useId();
  const diagramId = `mermaid-${rawId.replace(/[^a-zA-Z0-9]/g, "")}-${index}`;
  const chartRef = useRef(null);
  const fullscreenChartRef = useRef(null);
  const [view, setView] = useState("chart");
  const [zoom, setZoom] = useState(1);
  const [chart, setChart] = useState("");
  const [status, setStatus] = useState("loading");
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const render = async () => {
      setStatus("loading");
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: theme === "night" ? "dark" : "neutral",
          fontFamily: "'Noto Sans SC', system-ui, sans-serif"
        });

        const renderId = `${diagramId}-${Date.now()}`;
        const { svg, bindFunctions } = await mermaid.render(renderId, source);
        if (!mounted) return;

        setChart(svg);
        setStatus("ready");
      } catch (error) {
        console.error("[mermaid]", error);
        if (!mounted) return;
        setStatus("error");
      }
    };

    render();
    return () => {
      mounted = false;
    };
  }, [diagramId, source, theme]);

  useEffect(() => {
    if (chartRef.current && chart) chartRef.current.innerHTML = chart;
  }, [chart]);

  useEffect(() => {
    if (!fullscreen) return;
    if (fullscreenChartRef.current) {
      fullscreenChartRef.current.innerHTML = chartRef.current?.innerHTML || "";
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [chart, fullscreen]);

  useEffect(() => {
    for (const element of [chartRef.current, fullscreenChartRef.current]) {
      const svg = element?.querySelector("svg");
      if (!svg) continue;
      svg.style.width = `${zoom * 100}%`;
      svg.style.maxWidth = zoom > 1 ? "none" : "100%";
      svg.style.height = "auto";
    }
  }, [chart, fullscreen, zoom]);

  const download = () => {
    const svg = chartRef.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg.outerHTML}`], {
      type: "image/svg+xml;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mermaid-${diagramId}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mermaidToolbar">
        <div className="mermaidTabs" role="tablist" aria-label="图表视图">
          <button
            type="button"
            className={`mermaidTab${view === "chart" ? " active" : ""}`}
            role="tab"
            aria-selected={view === "chart"}
            onClick={() => setView("chart")}
          >
            图表
          </button>
          <button
            type="button"
            className={`mermaidTab${view === "code" ? " active" : ""}`}
            role="tab"
            aria-selected={view === "code"}
            onClick={() => setView("code")}
          >
            代码
          </button>
        </div>

        <div className="mermaidActions">
          <ActionButton label="缩小" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - 0.2))}>
            {icons.minus}
          </ActionButton>
          <ActionButton label="放大" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + 0.2))}>
            {icons.plus}
          </ActionButton>
          <span className="mermaidDivider" aria-hidden="true" />
          <ActionButton label="下载图表" onClick={download}>
            {icons.download}
          </ActionButton>
          <ActionButton label="全屏查看" onClick={() => setFullscreen(true)}>
            {icons.expand}
          </ActionButton>
        </div>
      </div>

      <div className={`mermaidStage${view === "code" ? " code" : ""}`}>
        {view === "chart" ? (
          status === "ready" ? (
            <div ref={chartRef} className="mermaidCanvas" />
          ) : (
            <p className={`mermaidNotice${status === "error" ? " error" : ""}`}>
              {status === "error" ? "图表渲染失败，请检查 Mermaid 语法" : "图表生成中…"}
            </p>
          )
        ) : (
          <pre className="mermaidCode"><code>{source}</code></pre>
        )}
      </div>

      {fullscreen &&
        createPortal(
          <div className="mermaidFullscreen" role="dialog" aria-modal="true" aria-label="Mermaid 图表全屏预览" onClick={() => setFullscreen(false)}>
            <button
              type="button"
              className="mermaidClose"
              onClick={() => setFullscreen(false)}
              title="关闭"
              aria-label="关闭全屏预览"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                {icons.close}
              </svg>
            </button>
            <div className="mermaidFullscreenStage" onClick={(event) => event.stopPropagation()}>
              <div ref={fullscreenChartRef} className="mermaidCanvas" />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
