'use client';

import * as React from 'react';
import { KIND_ACCENT } from '@/lib/codex';
import type { Character } from '@/lib/types';

const PLATE_ACCENTS = ['#8f2d24', '#5a5a5a', '#8b6fd8', '#c9a45c', '#3a3a3a'];

function Stat({ label, value, strong }: { label: string; value?: number; strong?: boolean }) {
  return (
    <span
      className={
        'font-mono text-[10.5px] whitespace-nowrap ' +
        (strong ? 'font-bold text-oxblood-bright' : 'text-bone-dim')
      }
    >
      {label} {value ?? '—'}
    </span>
  );
}

/**
 * The single most useful element during a session, and previously hidden in a
 * sidebar that disappeared below `lg`. It is pinned to the bottom of the stage
 * column and never scrolls away.
 *
 * HP gets its own row above the four stats: the schema now carries it, and the
 * design's four-column stat grid has no slot for a value that needs a bar. A
 * plate with no HP recorded simply omits the row rather than inventing 0/0.
 */
export function PartyDock({ characters }: { characters: Character[] }) {
  if (characters.length === 0) return null;

  return (
    <div className="flex-shrink-0 px-[26px] pb-[18px] animate-rise">
      <div
        className="bg-[hsl(264_17%_6%/0.95)] border border-border/[0.09] border-t-4 border-t-oxblood
                   shadow-[0_-6px_40px_-14px_hsl(var(--oxblood)/0.5),0_22px_50px_-18px_rgba(0,0,0,0.95)]
                   animate-floatB"
      >
        <div className="flex items-center gap-3 px-4 pt-[7px] pb-[5px]">
          <span className="font-mono text-[9px] font-extrabold tracking-[0.26em] text-bone-faint">
            THE PARTY
          </span>
          <span className="font-mono text-[9.5px] tracking-[0.12em] text-bone-faint">
            {characters.length} {characters.length === 1 ? 'MEMBER' : 'MEMBERS'}
          </span>
        </div>

        <div
          className="grid gap-px bg-[hsl(var(--border)/0.07)]"
          style={{ gridTemplateColumns: `repeat(${Math.min(characters.length, 5)}, minmax(0,1fr))` }}
        >
          {characters.slice(0, 5).map((c, i) => {
            const hasHp = typeof c.currentHp === 'number' && typeof c.maxHp === 'number' && c.maxHp > 0;
            const pct = hasHp ? Math.max(0, Math.min(1, c.currentHp! / c.maxHp!)) : 0;
            const hpColor = pct > 0.6 ? 'hsl(var(--kind-faction))' : pct > 0.3 ? 'hsl(var(--brass))' : 'hsl(var(--oxblood))';
            return (
              <div
                key={c.id}
                className="bg-[hsl(265_16%_7%/0.9)] px-[13px] pt-2.5 pb-[11px] cursor-pointer hover:bg-[hsl(265_16%_11%/0.95)] transition-colors"
                style={{ borderTop: `3px solid ${PLATE_ACCENTS[i % PLATE_ACCENTS.length] ?? KIND_ACCENT.npc}` }}
              >
                {/* Name gets its own line so it never truncates to two characters. */}
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
