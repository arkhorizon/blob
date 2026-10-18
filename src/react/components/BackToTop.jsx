import { useCallback } from 'react';

export default function BackToTop({ visible, scrollContainer }) {
  const handleClick = useCallback(() => {
    const target = scrollContainer?.current || window;
    target.scrollTo({ top: 0, behavior: 'smooth' });
  }, [scrollContainer]);

  return (
    <button
      className={`backTop ${visible ? 'vis' : ''}`}
      onClick={handleClick}
      aria-label="回到顶部"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>
  );
}
