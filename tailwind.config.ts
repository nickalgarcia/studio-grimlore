import type { Config } from 'tailwindcss';

/**
 * Every colour is declared as `hsl(var(--token) / <alpha-value>)`.
 *
 * The placeholder is what makes Tailwind's opacity modifiers compose —
 * `border-border/9`, `bg-card/78`. Without it Tailwind emits the bare colour
 * and silently drops the alpha, which this design would notice immediately:
 * its hairlines and panel fills are almost all fractional alpha.
 */
const hsl = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ['class'],
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
        // Archivo replaces Crimson Pro for all chrome and body copy.
        body: ['var(--font-archivo)', 'system-ui', 'sans-serif'],
        headline: ['var(--font-cinzel)', 'serif'],
        // Every number, ref, label and timestamp.
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        code: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
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
      boxShadow: {
        card: 'var(--shadow-card)',
        panel: 'var(--shadow-panel)',
        modal: 'var(--shadow-modal)',
        slab: 'var(--shadow-slab)',
        violet: 'var(--shadow-violet)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },

        // Reveal. Animates `transform` — see the note on `float*` below.
        rise: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(34px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },

        /* Ambient drift animates the independent `translate` property, NOT
           `transform`. Two animations on the same property means the later one
           silently wins — put both on `transform` and `rise` loses its
           translate while still appearing to work. */
        floatA: { '0%,100%': { translate: '0 0' }, '50%': { translate: '0 -4px' } },
        floatB: { '0%,100%': { translate: '0 -3px' }, '50%': { translate: '0 3px' } },

        /* Mode transitions alternate between two names so the animation
           actually restarts — re-rendering with the same animation-name does
           not replay it. */
        camA: {
          from: { opacity: '0', transform: 'translate3d(-26px,0,0) scale(1.012)' },
          to: { opacity: '1', transform: 'translate3d(0,0,0) scale(1)' },
        },
        camB: {
          from: { opacity: '0', transform: 'translate3d(26px,0,0) scale(1.012)' },
          to: { opacity: '1', transform: 'translate3d(0,0,0) scale(1)' },
        },

        gridDrift: { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(72px)' } },
        circleSpin: { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        circleSpinR: { from: { transform: 'rotate(360deg)' }, to: { transform: 'rotate(0deg)' } },
        emberBreathe: { '0%,100%': { opacity: '.55' }, '50%': { opacity: '1' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        rise: 'rise .55s ease-out both',
        slideIn: 'slideIn .5s ease-out both',
        camA: 'camA .5s cubic-bezier(.2,.7,.25,1) both',
        camB: 'camB .5s cubic-bezier(.2,.7,.25,1) both',
        floatA: 'floatA 11s ease-in-out infinite',
        floatB: 'floatB 13s ease-in-out infinite',
        gridDrift: 'gridDrift 26s linear infinite',
        emberBreathe: 'emberBreathe 14s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
