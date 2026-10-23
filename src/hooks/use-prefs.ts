'use client';

import * as React from 'react';
import {
  PALETTE_KEY, PALETTES, THEME_KEY, THEMES, type Palette, type Theme,
} from '@/lib/prefs';

function readAttr<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  if (typeof document === 'undefined') return fallback;
  const v = document.documentElement.getAttribute(name);
  return (allowed as readonly string[]).includes(v ?? '') ? (v as T) : fallback;
}

function store(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* preference only */ }
}

/**
 * The current palette or theme, read from <html> (where the pre-paint script
 * put it) rather than from storage, so the UI always agrees with what's on
 * screen. Setting one writes the attribute and remembers it.
 */
export function usePalette(): [Palette, (p: Palette) => void] {
  const [palette, setState] = React.useState<Palette>('hyperspace');
  React.useEffect(() => { setState(readAttr('data-palette', PALETTES, 'hyperspace')); }, []);
  const set = React.useCallback((p: Palette) => {
    document.documentElement.setAttribute('data-palette', p);
    store(PALETTE_KEY, p);
    setState(p);
  }, []);
  return [palette, set];
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setState] = React.useState<Theme>('dark');
  React.useEffect(() => { setState(readAttr('data-theme', THEMES, 'dark')); }, []);
  const set = React.useCallback((t: Theme) => {
    document.documentElement.setAttribute('data-theme', t);
    store(THEME_KEY, t);
    setState(t);
  }, []);
  return [theme, set];
}
