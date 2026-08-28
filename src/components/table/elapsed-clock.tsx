'use client';

import * as React from 'react';

function format(fromIso: string, now: number): string | null {
  const started = Date.parse(fromIso);
  if (Number.isNaN(started)) return null;
  const secs = Math.max(0, Math.floor((now - started) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * The elapsed readout, isolated on purpose.
 *
 * The interval lives in this leaf, so ticking re-renders one <span> and nothing
 * above it — the status bar sits beside a column streaming tokens, and a timer
 * held higher up would re-render that tree every tick. Resolution is minutes,
 * so it wakes twice a minute rather than sixty times.
 */
export function ElapsedClock({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return null;
  const label = format(startedAt, now);
  if (!label) return null;

  return (
    <span className="font-mono text-[10.5px] tracking-[0.12em] text-bone-faint">
      {label} ELAPSED
    </span>
  );
}
