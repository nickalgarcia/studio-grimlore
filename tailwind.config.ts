import type { Config } from 'tailwindcss';

/**
 * Every triplet colour is declared as `hsl(var(--token) / <alpha-value>)`.
 *
 * The placeholder is what makes Tailwind's opacity modifiers compose
 * (`border-border/10`, `bg-spot/20`). `line`, `line2` and `scrim` already carry
 * their alpha in the token, so they are plain `var()` and take no modifier.
 */
const hsl = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  // Themes are driven by `data-theme` on <html>; the `dark:` variant follows it.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        // Big Shoulders: headlines, names, buttons, nav. Always uppercase.
        headline: ['var(--font-display)', 'Arial Narrow', 'sans-serif'],
        // Newsreader: prose, ledes, list titles, inputs.
        body: ['var(--font-reading)', 'Georgia', 'serif'],
        // JetBrains Mono: labels, meta, counts, chips, kbd.
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        code: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // shadcn names (mapped onto the design tokens in globals.css)
        background: hsl('background'),
        foreground: hsl('foreground'),
        card: { DEFAULT: hsl('card'), foreground: hsl('card-foreground') },
        popover: { DEFAULT: hsl('popover'), foreground: hsl('popover-foreground') },
        primary: { DEFAULT: hsl('primary'), foreground: hsl('primary-foreground') },
        secondary: { DEFAULT: hsl('secondary'), foreground: hsl('secondary-foreground') },
        muted: { DEFAULT: hsl('muted'), foreground: hsl('muted-foreground') },
        accent: { DEFAULT: hsl('accent'), foreground: hsl('accent-foreground') },
        destructive: { DEFAULT: hsl('destructive'), foreground: hsl('destructive-foreground') },
        border: hsl('border'),
        input: hsl('input'),
        ring: hsl('ring'),

        // Design-token names, as the README uses them. Prefer these in new code.
        bg: hsl('bg'),
        panel: hsl('panel'),
        ink: hsl('ink'),
        mute: hsl('mute'),
        spot: { DEFAULT: hsl('spot'), on: hsl('spot-on') },
        sand: hsl('sand'),
        cap: { DEFAULT: hsl('cap'), ink: hsl('cap-ink') },
        /** AI co-pilot UI only. */
        holo: hsl('holo'),
        line: 'var(--line)',
        line2: 'var(--line2)',
        scrim: 'var(--scrim)',

        // Temporary v3 names, aliased in globals.css. Removed in Stage 6.
        bone: {
          DEFAULT: hsl('bone'),
          body: hsl('bone-body'),
          soft: hsl('bone-soft'),
          dim: hsl('bone-dim'),
          faint: hsl('bone-faint'),
          faintest: hsl('bone-faintest'),
        },
        oxblood: {
          DEFAULT: hsl('oxblood'),
          bright: hsl('oxblood-bright'),
          pale: hsl('oxblood-pale'),
        },
        violet: {
          DEFAULT: hsl('violet'),
          bright: hsl('violet-bright'),
          text: hsl('violet-text'),
          dim: hsl('violet-dim'),
        },
        brass: hsl('brass'),
        kind: {
          npc: hsl('kind-npc'),
          place: hsl('kind-place'),
          faction: hsl('kind-faction'),
          item: hsl('kind-item'),
          session: hsl('kind-session'),
        },
      },
      // Radius is 0 by design; the scale is kept so primitives referencing
      // rounded-lg/md/sm resolve to a hard edge rather than a stale default.
      borderRadius: {
        lg: 'var(--radius)',
        md: 'var(--radius)',
        sm: 'var(--radius)',
      },
      // The only shadow in the design is a hard offset "print" shadow in spot.
      // The v3 names resolve to none so stand-in screens drop their blur.
      boxShadow: {
        'print-sm': '6px 6px 0 hsl(var(--spot))',
        print: '8px 8px 0 hsl(var(--spot))',
        'print-lg': '10px 10px 0 hsl(var(--spot))',
        card: 'none',
        panel: 'none',
        modal: 'none',
        slab: 'none',
        violet: 'none',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
