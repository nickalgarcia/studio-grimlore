'use client';

import * as React from 'react';

/**
 * Pointer parallax as two CSS custom properties on one element.
 *
 * Deliberately not React state: routing pointer position through a setState
 * re-renders the whole tree on every mousemove. This writes `--px` / `--py`
 * inside a single rAF, so it never reads layout and only ever drives
 * compositor transforms.
 *
 * Consumers read them with a fallback — `calc(var(--px, 0) * 10px)` — so they
 * are correct before the first pointer event ever fires.
 */
export function useParallax(enabled = true) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    // Respect the same preference the stylesheet does.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let queued = false;
    let nx = 0;
    let ny = 0;

    const onMove = (e: PointerEvent) => {
      nx = (e.clientX / window.innerWidth) * 2 - 1;
      ny = (e.clientY / window.innerHeight) * 2 - 1;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const el = ref.current;
        if (!el) return;
        el.style.setProperty('--px', nx.toFixed(3));
        el.style.setProperty('--py', ny.toFixed(3));
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [enabled]);

  return ref;
}
