import { cn } from '@/lib/utils';

/**
 * The app's mark: a "Previously…" narration box. Same drawing as
 * app/icon.svg (keep the two in step), inline so it needs no request.
 *
 * Fixed colours on purpose: it's the logo, not UI, so it doesn't follow the
 * palette. The cyan is --holo's Hyperspace value, the one place it appears
 * outside the co-pilot.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('flex-none', className)}>
      <g transform="rotate(-3 32 32)">
        <rect x="8" y="14" width="54" height="44" fill="#000" />
        <rect x="2" y="8" width="54" height="44" fill="#4fd6ff" stroke="#0a0e17" strokeWidth="4" />
        <rect x="11" y="26" width="9" height="9" fill="#0a0e17" />
        <rect x="24.5" y="26" width="9" height="9" fill="#0a0e17" />
        <rect x="38" y="26" width="9" height="9" fill="#0a0e17" />
      </g>
    </svg>
  );
}
