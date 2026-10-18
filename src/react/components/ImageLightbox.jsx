import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * 图片灯箱组件 —— 点击文章内图片后全屏放大查看，支持缩放与拖拽平移。
 * @param {string} src - 图片地址
 * @param {string} alt - 图片说明（alt 文字）
 * @param {function} onClose - 关闭回调
 */
export default function ImageLightbox({ src, alt, onClose }) {
  const overlayRef = useRef(null);
  const imgRef = useRef(null);

  // Zoom & pan state
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPoint = useRef({ x: 0, y: 0 });

  const resetTransform = useCallback(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, []);

  // Reset transform when image changes
  useEffect(() => {
    resetTransform();
  }, [src, resetTransform]);

  // Escape 关闭 + 锁定背景滚动
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // --- Zoom ---
  const MIN_SCALE = 1;
  const MAX_SCALE = 5;

  const zoomTo = useCallback((newScale, cx, cy) => {
    // cx, cy are cursor position relative to the image center (in viewport coords)
    setScale((prev) => {
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
      if (clamped === prev) return prev;
      const ratio = clamped / prev;
      setPos((p) => ({
        x: p.x * ratio + cx * (ratio - 1),
        y: p.y * ratio + cy * (ratio - 1),
      }));
      return clamped;
    });
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoomTo(scale * delta, cx, cy);
  }, [scale, zoomTo]);

  // Double-click toggle zoom
  const handleDoubleClick = useCallback((e) => {
    if (scale > 1) {
      resetTransform();
    } else {
      const rect = imgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      zoomTo(2.5, cx, cy);
    }
  }, [scale, zoomTo, resetTransform]);

  // --- Pan (mouse) ---
  const handlePointerDown = useCallback((e) => {
    if (scale <= 1) return;
    e.preventDefault();
    dragging.current = true;
    lastPoint.current = { x: e.clientX, y: e.clientY };
  }, [scale]);

  const handlePointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPoint.current.x;
    const dy = e.clientY - lastPoint.current.y;
    lastPoint.current = { x: e.clientX, y: e.clientY };
    setPos((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // --- Pinch zoom (touch) ---
  const pinchDist = useRef(0);
  const pinchScale = useRef(1);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDist.current = Math.hypot(dx, dy);
      pinchScale.current = scale;
    }
  }, [scale]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (pinchDist.current > 0) {
        const newScale = pinchScale.current * (dist / pinchDist.current);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = imgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const cx = midX - rect.left - rect.width / 2;
        const cy = midY - rect.top - rect.height / 2;
        zoomTo(newScale, cx, cy);
      }
    } else if (e.touches.length === 1 && scale > 1) {
      const dx = e.touches[0].clientX - lastPoint.current.x;
      const dy = e.touches[0].clientY - lastPoint.current.y;
      lastPoint.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setPos((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  }, [scale, zoomTo]);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) {
      pinchDist.current = 0;
    }
    if (e.touches.length === 1) {
      lastPoint.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);

  // Backdrop click to close
  const handleOverlayClick = useCallback((e) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  const transform = `translate(${pos.x}px, ${pos.y}px) scale(${scale})`;

  return (
    <div className="imgLightbox" ref={overlayRef} onClick={handleOverlayClick}>
      <button className="imgLightboxClose" onClick={onClose} aria-label="关闭">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
      <div
        className="imgLightboxBody"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt || ''}
          style={{ transform, transition: dragging.current ? 'none' : 'transform 0.2s ease', cursor: scale > 1 ? 'grab' : 'zoom-out' }}
          draggable={false}
        />
        {alt && scale <= 1 && <div className="imgLightboxCaption">{alt}</div>}
      </div>
    </div>
  );
}
