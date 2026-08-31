'use client';

/**
 * A summoning circle seen edge-on. Entirely decorative: `pointer-events: none`
 * and `z-index: 0`, with content explicitly at `z-index: 1` — relying on `auto`
 * vs `2` renders inconsistently.
 *
 * Every layer animates only `transform` or `opacity`, so all of it stays on the
 * compositor. Parallax is driven by two CSS custom properties written from a
 * single rAF (see use-parallax), never from React state — the fallbacks in
 * `var(--px, 0)` keep it correct before the first pointer event.
 *
 * Nothing here uses `backdrop-filter`, and neither should anything layered over
 * it: it forces a full-surface repaint every frame.
 */
export function Backdrop({ ambient = true }: { ambient?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
      style={{ perspective: '540px', perspectiveOrigin: '50% 34%' }}
    >
      {/* 1 — lattice */}
      <div
        className="absolute"
        style={{
          left: '-60%', right: '-60%', top: '34%', height: '190%',
          transform: 'rotateX(74deg) translate3d(calc(var(--px, 0) * 8px), 0, 0)',
          transformOrigin: '50% 0%',
        }}
      >
        <div
          className={ambient ? 'animate-gridDrift' : undefined}
          style={{
            position: 'absolute', inset: '-100px 0',
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(143,45,36,0.16) 0px, rgba(143,45,36,0.16) 1px, transparent 1px, transparent 72px),' +
              'repeating-linear-gradient(90deg, rgba(242,237,228,0.055) 0px, rgba(242,237,228,0.055) 1px, transparent 1px, transparent 72px)',
          }}
        />
      </div>

      {/* 2 — rings */}
      <div
        className="absolute"
        style={{
          left: '50%', top: '44%', width: 1100, height: 1100, marginLeft: -550,
          transform: 'rotateX(76deg) translate3d(calc(var(--px, 0) * 6px), 0, 0)',
          transformOrigin: '50% 50%',
        }}
      >
        <div
          className="absolute inset-0 rounded-full border border-[rgba(143,45,36,0.3)]"
          style={ambient ? { animation: 'circleSpin 220s linear infinite' } : undefined}
        />
        <div
          className="absolute rounded-full border border-[rgba(242,237,228,0.075)]"
          style={{ inset: 150, ...(ambient ? { animation: 'circleSpinR 160s linear infinite' } : {}) }}
        />
        <div
          className="absolute rounded-full border border-[rgba(143,45,36,0.22)]"
          style={{ inset: 330, ...(ambient ? { animation: 'circleSpin 100s linear infinite' } : {}) }}
        />
      </div>

      {/* 3 — ember, drifting opposite the content */}
      <div
        className={ambient ? 'absolute animate-emberBreathe' : 'absolute'}
        style={{
          left: '-10%', bottom: '-24%', width: '70%', height: '64%', borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(143,45,36,0.3) 0%, transparent 66%)',
          filter: 'blur(46px)',
          transform: 'translate3d(calc(var(--px, 0) * -16px), calc(var(--py, 0) * -10px), 0)',
        }}
      />

      {/* 4 — vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 78% 68% at 50% 46%, transparent 0%, rgba(6,5,7,0.6) 100%)' }}
      />

      {/* 5 — grain */}
      <div
        className="absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(242,237,228,0.016) 0px, rgba(242,237,228,0.016) 1px, transparent 1px, transparent 3px)',
        }}
      />
    </div>
  );
}
