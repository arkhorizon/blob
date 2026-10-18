import { useEffect, useState } from 'react';

/**
 * Reactively track a CSS media query.
 * Unlike reading window.innerWidth at render time, this hook
 * subscribes to matchMedia changes and triggers re-renders.
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 768px)');
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') return window.matchMedia(query).matches;
    return false;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    // Sync immediately in case the query result changed between init and effect
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** Convenience: true when viewport ≤ 768px */
export function useIsMobile() {
  return useMediaQuery('(max-width: 768px)');
}
