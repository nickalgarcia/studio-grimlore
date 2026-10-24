'use client';

import * as React from 'react';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { MonoLabel } from '@/components/shared/section-header';
import { cn } from '@/lib/utils';
import type { Character, Combatant } from '@/lib/types';

function hpOf(c: Combatant, characters: Character[]): { cur?: number; max?: number } {
  // PCs keep their HP on the character sheet; monsters on the combatant.
  if (c.type === 'player') {
    const pc = characters.find(ch => ch.name === c.name);
    return { cur: pc?.currentHp, max: pc?.maxHp };
  }
  return { cur: c.currentHp, max: c.maxHp };
}

function Card({ c, slot, live, characters }: { c: Combatant; slot: number; live: boolean; characters: Character[] }) {
  const { cur, max } = hpOf(c, characters);
  const pct = cur !== undefined && max ? Math.max(0, Math.min(1, cur / max)) : null;
  // Before START there is no NOW or ON DECK, just the order.
  const now = live && slot === 0;
  const onDeck = live && slot === 1;
  return (
    <li
      aria-current={now ? 'true' : undefined}
      className={cn(
        'flex-none flex flex-col justify-between gap-1.5 px-3 py-2 transition-[width] duration-200 min-w-0',
        now && 'w-[250px] bg-spot text-spot-on',
        onDeck && 'w-[180px] bg-panel border-[3px] border-ink',
        !now && !onDeck && 'w-[120px] border-[1.5px] border-line2',
        slot >= 6 && 'opacity-[0.55]',
        // Under ~1100px only NOW and ON DECK fit.
        slot >= 2 && 'max-[1099px]:hidden',
      )}
    >
      <div className="flex items-baseline gap-2 min-w-0">
        <span className={cn('font-headline font-black leading-none', now ? 'text-[44px]' : 'text-[22px]')}>
          {c.initiative === '' ? '–' : c.initiative}
        </span>
        <MonoLabel className={cn('truncate', !now && 'text-mute')}>{now ? 'Now' : onDeck ? 'On deck' : ''}</MonoLabel>
      </div>
      <div className={cn('font-headline font-black leading-none truncate', now ? 'text-[30px]' : 'text-[18px]')}>{c.name}</div>
      {pct !== null && (
        <div className="flex items-center gap-2">
          <span className="flex-1 h-1.5 border-[1.5px] border-current">
            <span className="block h-full bg-current" style={{ width: `${pct * 100}%` }} />
          </span>
          <span className="font-mono font-bold text-[11px]">{cur}/{max}</span>
        </div>
      )}
      <MonoLabel className={cn('truncate', !now && 'text-mute')}>
        {c.conditions.length ? c.conditions.join(' · ') : c.type === 'monster' ? 'Foe' : ''}
      </MonoLabel>
    </li>
  );
}

/**
 * Initiative as a row of cards, rotated so whoever is acting is always first.
 * Turn order logic lives in useCombat; this only draws it.
 */
export function TurnStrip({ onSetUp }: { onSetUp: () => void }) {
  const { combat, codex } = useCampaign();
  const characters = codex.raw.characters ?? [];
  const { sorted, started, activeId, round } = combat;

  if (sorted.length === 0) {
    return (
      <div className="flex-none flex items-center gap-4 px-6 py-3 border-b-[3px] border-ink">
        <MonoLabel className="text-mute">No combat</MonoLabel>
        <button type="button" onClick={onSetUp} className="h-9 px-3.5 border-[1.5px] border-ink font-mono font-bold text-[12px] tracking-[0.14em]">
          SET UP COMBAT
        </button>
      </div>
    );
  }

  const at = Math.max(0, sorted.findIndex(c => c.id === activeId));
  const order = started ? [...sorted.slice(at), ...sorted.slice(0, at)] : sorted;
  const allHaveInitiative = sorted.every(c => c.initiative !== '');

  return (
    <div className="flex-none flex items-stretch gap-4 px-6 py-4 border-b-[3px] border-ink">
      <div className="flex-none flex flex-col justify-center w-[76px]">
        <MonoLabel className="text-mute">Round</MonoLabel>
        <span className="font-headline font-black text-[64px] leading-[0.85]">{started ? round : '–'}</span>
      </div>

      <ol className="flex-1 min-w-0 flex gap-2 overflow-hidden" aria-label="Initiative order">
        {order.map((c, i) => <Card key={c.id} c={c} slot={i} live={started} characters={characters} />)}
      </ol>

      <div className="flex-none w-[150px] flex flex-col gap-2">
        {started ? (
          <>
            <button
              type="button"
              onClick={combat.nextTurn}
              className="flex-1 min-h-[56px] bg-ink text-bg hover:bg-spot hover:text-spot-on font-headline font-black text-[24px] leading-none"
            >
              NEXT TURN →
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={combat.prevTurn} className="flex-1 h-8 border-[1.5px] border-line2 font-mono font-bold text-[12px] tracking-[0.14em]">
                ← BACK
              </button>
              <button type="button" onClick={onSetUp} className="h-8 px-2 border-[1.5px] border-line2 font-mono font-bold text-[12px] tracking-[0.14em]">
                EDIT
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={combat.start}
              disabled={!allHaveInitiative}
              title={allHaveInitiative ? undefined : 'Every combatant needs an initiative first'}
              className="flex-1 min-h-[56px] bg-spot text-spot-on font-headline font-black text-[24px] leading-none disabled:opacity-50"
            >
              START →
            </button>
            <button type="button" onClick={onSetUp} className="h-8 border-[1.5px] border-line2 font-mono font-bold text-[12px] tracking-[0.14em]">
              SET UP
            </button>
          </>
        )}
      </div>
    </div>
  );
}
