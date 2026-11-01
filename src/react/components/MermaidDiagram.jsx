import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const INITIAL_TRANSFORM = { scale: 1, x: 0, y: 0 };

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

function clampZoom(scale, minZoom = MIN_ZOOM) {
  return Math.min(MAX_ZOOM, Math.max(minZoom, scale));
}

function clampPan(transform, canvas) {
  if (!canvas || transform.scale <= MIN_ZOOM) return INITIAL_TRANSFORM;

  const maxX = (canvas.offsetWidth * (transform.scale - 1)) / 2;
  const maxY = (canvas.offsetHeight * (transform.scale - 1)) / 2;
  return {
    scale: transform.scale,
    x: Math.min(maxX, Math.max(-maxX, transform.x)),
    y: Math.min(maxY, Math.max(-maxY, transform.y))
  };
}

function zoomAtPoint(current, stage, clientX, clientY, deltaY) {
  const rect = stage.getBoundingClientRect();
  const nextScale = clampZoom(current.scale * (deltaY < 0 ? 1.12 : 0.89));
  if (nextScale <= MIN_ZOOM) return INITIAL_TRANSFORM;

  const ratio = nextScale / current.scale;
  const offsetX = clientX - rect.left - rect.width / 2;
  const offsetY = clientY - rect.top - rect.height / 2;

  return clampPan({
    scale: nextScale,
    x: offsetX * (1 - ratio) + current.x * ratio,
    y: offsetY * (1 - ratio) + current.y * ratio
  }, stage.querySelector(".mermaidCanvas"));
}

export default function MermaidDiagram({ source, index, theme }) {
  const rawId = useId();
  const diagramId = `mermaid-${rawId.replace(/[^a-zA-Z0-9]/g, "")}-${index}`;
  const chartRef = useRef(null);
  const previewStageRef = useRef(null);
  const fullscreenChartRef = useRef(null);
  const fullscreenStageRef = useRef(null);
  const dragStateRef = useRef(null);
  const [view, setView] = useState("chart");
  const [previewTransform, setPreviewTransform] = useState(INITIAL_TRANSFORM);
  const [fullscreenTransform, setFullscreenTransform] = useState(INITIAL_TRANSFORM);
  const [chart, setChart] = useState("");
  const [status, setStatus] = useState("loading");
  const [fullscreen, setFullscreen] = useState(false);
  const [dragging, setDragging] = useState(false);

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
    if (status === "ready") {
      setPreviewTransform(INITIAL_TRANSFORM);
      setFullscreenTransform(INITIAL_TRANSFORM);
    }
  }, [status]);

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
    if (!chartRef.current) return;
    chartRef.current.style.transform = `translate3d(${previewTransform.x}px, ${previewTransform.y}px, 0) scale(${previewTransform.scale})`;
  }, [chart, previewTransform]);

  useEffect(() => {
    if (!fullscreenChartRef.current) return;
    fullscreenChartRef.current.style.transform = `translate3d(${fullscreenTransform.x}px, ${fullscreenTransform.y}px, 0) scale(${fullscreenTransform.scale})`;
  }, [chart, fullscreen, fullscreenTransform]);

  useEffect(() => {
    const stages = [previewStageRef.current, fullscreenStageRef.current].filter(Boolean);
    if (stages.length === 0 || view !== "chart" || status !== "ready") return;

    const handleWheel = (event) => {
      event.preventDefault();
      const stage = event.currentTarget;
      const isPreview = stage === previewStageRef.current;
      const update = isPreview ? setPreviewTransform : setFullscreenTransform;
      update((current) => zoomAtPoint(current, stage, event.clientX, event.clientY, event.deltaY));
    };

    stages.forEach((stage) => stage.addEventListener("wheel", handleWheel, { passive: false }));
    return () => {
      stages.forEach((stage) => stage.removeEventListener("wheel", handleWheel));
    };
  }, [fullscreen, status, view]);

  const startDrag = (event) => {
    const target = fullscreen ? "fullscreen" : "preview";
    if (event.button !== 0 || view !== "chart" || status !== "ready") return;
    const transform = target === "fullscreen" ? fullscreenTransform : previewTransform;
    if (transform.scale <= MIN_ZOOM) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      target,
      clientX: event.clientX,
      clientY: event.clientY,
      transform: target === "fullscreen" ? fullscreenTransform : previewTransform
    };
    setDragging(true);
  };

  const moveDrag = (event) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const update = state.target === "fullscreen" ? setFullscreenTransform : setPreviewTransform;
    const stage = state.target === "fullscreen" ? fullscreenStageRef.current : previewStageRef.current;
    update(clampPan({
      scale: state.transform.scale,
      x: state.transform.x + event.clientX - state.clientX,
      y: state.transform.y + event.clientY - state.clientY
    }, stage?.querySelector(".mermaidCanvas")));
  };

  const endDrag = (event) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      setDragging(false);
    }
  };

  const zoomBy = (factor) => {
    setPreviewTransform((current) => {
      const nextScale = clampZoom(current.scale * factor);
      return nextScale <= MIN_ZOOM ? INITIAL_TRANSFORM : clampPan({ ...current, scale: nextScale }, chartRef.current);
    });
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
          <ActionButton label="缩小" disabled={previewTransform.scale <= MIN_ZOOM} onClick={() => zoomBy(0.8)}>
            {icons.minus}
          </ActionButton>
          <ActionButton label="放大" disabled={previewTransform.scale >= MAX_ZOOM} onClick={() => zoomBy(1.25)}>
            {icons.plus}
          </ActionButton>
          <span className="mermaidDivider" aria-hidden="true" />
          <ActionButton label="全屏查看" onClick={() => {
            setFullscreenTransform(INITIAL_TRANSFORM);
            setFullscreen(true);
          }}>
            {icons.expand}
          </ActionButton>
        </div>
      </div>

      <div
        ref={previewStageRef}
        className={`mermaidStage${view === "code" ? " code" : ""}${previewTransform.scale > 1 ? " pannable" : ""}${dragging ? " dragging" : ""}`}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
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
            <div
              ref={fullscreenStageRef}
              className={`mermaidFullscreenStage${fullscreenTransform.scale > 1 ? " pannable" : ""}${dragging ? " dragging" : ""}`}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <div ref={fullscreenChartRef} className="mermaidCanvas" />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
