/**
 * Palette and theme preferences. Per browser, in localStorage, because they're
 * about this screen (the table laptop vs. a desk), not about the campaign.
 *
 * Deliberately not a 'use client' module: the root layout (a server component)
 * imports PREFS_SCRIPT as a plain string.
 */
export const PALETTES = ['hyperspace', 'heroic'] as const;
export type Palette = (typeof PALETTES)[number];
export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];

export const PALETTE_KEY = 'grimlore.palette';
export const THEME_KEY = 'grimlore.theme';

export const PALETTE_LABEL: Record<Palette, string> = {
  hyperspace: 'Hyperspace',
  heroic: "World's Finest",
};

/** The two halves of each palette's swatch: its dark `--bg` and its `--spot`. */
export const PALETTE_SWATCH: Record<Palette, [string, string]> = {
  hyperspace: ['#0a0e17', '#ffcf33'],
  heroic: ['#0d1030', '#ff3b30'],
};

/**
 * Runs inline in <head>, before first paint, so the page never flashes the
 * default theme. Anything unexpected in storage falls back to the defaults,
 * and storage that throws (private mode, blocked site data) is ignored.
 */
export const PREFS_SCRIPT = `(function(){try{var d=document.documentElement;var p=localStorage.getItem('${PALETTE_KEY}');var t=localStorage.getItem('${THEME_KEY}');d.setAttribute('data-palette',p==='heroic'?'heroic':'hyperspace');d.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}})();`;
