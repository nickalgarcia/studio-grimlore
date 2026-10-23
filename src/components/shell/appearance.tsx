'use client';

import * as React from 'react';
import { usePalette, useTheme } from '@/hooks/use-prefs';
import { PALETTE_LABEL, PALETTE_SWATCH, PALETTES } from '@/lib/prefs';
import { cn } from '@/lib/utils';

/**
 * Two 24px squares, each split diagonally between that palette's dark ground
 * and its spot colour. A radio group: exactly one is always selected.
 */
export function PaletteSwitcher() {
  const [palette, setPalette] = usePalette();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    const next = (i + step + PALETTES.length) % PALETTES.length;
    setPalette(PALETTES[next]);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Palette" className="flex-none flex items-center gap-2">
      {PALETTES.map((p, i) => {
        const [ground, spot] = PALETTE_SWATCH[p];
        const on = p === palette;
        return (
          <button
            key={p}
            ref={el => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={PALETTE_LABEL[p]}
            title={PALETTE_LABEL[p]}
            tabIndex={on ? 0 : -1}
            onClick={() => setPalette(p)}
            onKeyDown={e => onKeyDown(e, i)}
            className={cn(
              'w-6 h-6 border-[1.5px] border-line2',
              on && 'outline outline-2 outline-ink outline-offset-2',
            )}
            style={{ background: `linear-gradient(135deg, ${ground} 50%, ${spot} 50%)` }}
          />
        );
      })}
    </div>
  );
}

/** Shows the current theme; pressing it switches to the other. */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${theme}. Switch to ${next}.`}
      className="flex-none h-[38px] inline-flex items-center gap-2 px-3 border border-line2 font-mono font-bold text-[12px] tracking-[0.14em] uppercase hover:bg-panel"
    >
      <span
        aria-hidden="true"
        className="w-3 h-3 rounded-full border-[1.5px] border-ink"
        style={{ background: 'linear-gradient(90deg, currentColor 50%, transparent 50%)' }}
      />
      {theme}
    </button>
  );
}
