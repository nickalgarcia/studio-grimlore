'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { Character } from '@/lib/types';

/** Plate accents. No violet — that belongs to the co-pilot alone. */
const PLATE_ACCENTS = ['#8f2d24', '#5a5a5a', '#c9a45c', '#8b847b', '#3a3a3a'];

/** Five across is the designed layout; beyond that the dock scrolls. */
const FITS_WITHOUT_SCROLL = 5;

function Stat({ label, value, strong }: { label: string; value?: number; strong?: boolean }) {
  return (
    <span
      className={cn(
        'font-mono text-[10.5px] whitespace-nowrap',
        strong ? 'font-bold text-oxblood-bright' : 'text-bone-dim',
      )}
    >
      {label} {value ?? '—'}
    </span>
  );
}

/**
 * The single most useful element during a session, pinned to the bottom of the
 * stage column so it never scrolls away.
 *
 * Every party member is shown. The design draws five plates across, so up to
 * five share the width equally; past that the row keeps a legible plate width
 * and scrolls horizontally rather than silently dropping members — a sixth
 * character you cannot see is worse than a dock you have to scroll.
 *
 * HP gets its own row above the four stats. A character with no HP recorded
 * omits the row rather than inventing 0/0.
 */
export function PartyDock({
  characters, onSelect,
}: {
  characters: Character[];
  /** Opens the character in the Codex. */
  onSelect?: (character: Character) => void;
}) {
  if (characters.length === 0) return null;

  const overflows = characters.length > FITS_WITHOUT_SCROLL;

  return (
    <div className="flex-shrink-0 px-[26px] pb-[18px] animate-rise">
      <div
        // No ambient drift here on purpose. Every other panel may breathe, but
        // this one is a click target — the plates are the most-used control on
        // the screen, and a button that oscillates under the cursor is a worse
        // trade than a slightly stiller dock.
        className="bg-[hsl(264_17%_6%/0.95)] border border-border/[0.09] border-t-4 border-t-oxblood
                   shadow-[0_-6px_40px_-14px_hsl(var(--oxblood)/0.5),0_22px_50px_-18px_rgba(0,0,0,0.95)]"
      >
        <div className="flex items-center gap-3 px-4 pt-[7px] pb-[5px]">
          <span className="font-mono text-[9px] font-extrabold tracking-[0.26em] text-bone-faint">
            THE PARTY
          </span>
          <span className="font-mono text-[9.5px] tracking-[0.12em] text-bone-faint">
            {characters.length} {characters.length === 1 ? 'MEMBER' : 'MEMBERS'}
          </span>
          {overflows && (
            <span className="font-mono text-[9.5px] tracking-[0.12em] text-bone-faint ml-auto">
              SCROLL FOR MORE →
            </span>
          )}
        </div>

        <div
          className={cn('grid gap-px bg-[hsl(var(--border)/0.07)]', overflows && 'overflow-x-auto')}
          style={
            overflows
              ? { gridAutoFlow: 'column', gridAutoColumns: 'minmax(190px, 1fr)' }
              : { gridTemplateColumns: `repeat(${characters.length}, minmax(0,1fr))` }
          }
        >
          {characters.map((c, i) => {
            const hasHp =
              typeof c.currentHp === 'number' && typeof c.maxHp === 'number' && c.maxHp > 0;
            const pct = hasHp ? Math.max(0, Math.min(1, c.currentHp! / c.maxHp!)) : 0;
            // Healthy reads as neutral bone: only injury earns a hue, and
            // violet is spoken for.
            const hpColor =
              pct > 0.6 ? 'hsl(var(--bone-dim))' : pct > 0.3 ? 'hsl(var(--brass))' : 'hsl(var(--oxblood))';

            return (
              <button
                key={c.id}
                type="button"
                onClick={onSelect ? () => onSelect(c) : undefined}
                aria-label={onSelect ? `Open ${c.name} in the Codex` : undefined}
                // A real button, not a div with a pointer cursor: the plate is
                // keyboard-reachable, and the cursor only claims to be
                // clickable when something is actually wired to it.
                className={cn(
                  'bg-[hsl(265_16%_7%/0.9)] px-[13px] pt-2.5 pb-[11px] text-left transition-colors',
                  onSelect
                    ? 'cursor-pointer hover:bg-[hsl(265_16%_11%/0.95)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-oxblood-bright'
                    : 'cursor-default',
                )}
                style={{ borderTop: `3px solid ${PLATE_ACCENTS[i % PLATE_ACCENTS.length]}` }}
              >
                {/* Name on its own line so it never truncates to two characters. */}
                <div className="font-headline text-[13px] font-bold uppercase text-bone-body truncate mb-0.5">
                  {c.name}
                </div>
                <div className="font-mono text-[9.5px] font-bold tracking-[0.1em] text-bone-faint mb-1.5 truncate">
                  {[c.class, c.species].filter(Boolean).join(' · ') || '—'}
                </div>

                {hasHp && (
                  <div className="mb-1.5">
                    <div className="h-[4px] bg-[hsl(var(--border)/0.1)] overflow-hidden">
                      <div className="h-full" style={{ width: `${pct * 100}%`, background: hpColor }} />
                    </div>
                    <div className="font-mono text-[10px] text-bone-dim mt-1">
                      HP {c.currentHp}/{c.maxHp}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-[3px]">
                  <Stat label="AC" value={c.armorClass} strong />
                  <Stat label="PP" value={c.passivePerception} />
                  <Stat label="IN" value={c.passiveInvestigation} />
                  <Stat label="SP" value={c.speed} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
