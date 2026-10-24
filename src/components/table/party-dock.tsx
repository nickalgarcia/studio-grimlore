'use client';

import * as React from 'react';
import Link from 'next/link';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { useEntityWriter, type WithId } from '@/firebase';
import { pageHref } from '@/lib/pages';
import { cn } from '@/lib/utils';
import type { Character } from '@/lib/types';

/** Click the HP number to type a new value: PCs' HP lives on their sheet. */
function HpEdit({ c }: { c: WithId<Character> }) {
  const { activeCampaign } = useCampaign();
  const write = useEntityWriter(activeCampaign?.id);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');

  const commit = () => {
    const n = parseInt(draft, 10);
    if (Number.isFinite(n)) void write('party', c.id, { currentHp: Math.max(0, Math.min(c.maxHp ?? n, n)) });
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="number"
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        aria-label={`${c.name} current hit points`}
        className="w-14 bg-bg border-[1.5px] border-ink px-1 font-mono font-bold text-[13px]"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => { setDraft(String(c.currentHp ?? '')); setEditing(true); }}
      aria-label={`${c.name}: ${c.currentHp} of ${c.maxHp} hit points. Edit`}
      className="font-mono font-bold text-[13px] hover:underline"
    >
      {c.currentHp}/{c.maxHp}
    </button>
  );
}

/**
 * The whole party across the bottom, every plate in view: one column per PC,
 * so seven fit without scrolling (review item U4). Eight and up wrap.
 */
export function PartyDock() {
  const { codex, combat, live } = useCampaign();
  const party = codex.raw.characters ?? [];
  if (party.length === 0) return null;

  const activeName = combat.active?.type === 'player' ? combat.active.name : null;
  const cols = Math.min(Math.max(party.length, 1), 8);

  return (
    <div
      className="flex-none grid border-t-[3px] border-ink bg-panel"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      aria-label="Party"
    >
      {party.map(c => {
        const hasHp = typeof c.currentHp === 'number' && typeof c.maxHp === 'number' && c.maxHp > 0;
        const pct = hasHp ? Math.max(0, Math.min(1, c.currentHp! / c.maxHp!)) : 0;
        const bloodied = hasHp && pct < 0.5;
        const spot = live.spotlit.includes(c.id);
        return (
          <div
            key={c.id}
            className={cn('min-w-0 px-3.5 py-3 flex flex-col gap-1.5 border-r border-line last:border-r-0', c.name === activeName && 'bg-bg')}
          >
            <Link href={pageHref({ kind: 'party', id: c.id })} className="font-headline font-black text-[20px] leading-none truncate hover:text-spot">
              {c.name}
            </Link>
            <span className="font-mono text-[11px] tracking-[0.1em] text-mute truncate uppercase">{c.class || c.species || '—'}</span>
            {hasHp && (
              <>
                <span className={cn('h-2 border-[1.5px]', bloodied ? 'border-spot' : 'border-ink')}>
                  <span className={cn('block h-full', bloodied ? 'bg-spot' : 'bg-ink')} style={{ width: `${pct * 100}%` }} />
                </span>
                <span className={cn('flex items-baseline gap-2', bloodied && 'text-spot')}>
                  <HpEdit c={c} />
                  {bloodied && <span className="font-mono font-bold text-[11px] tracking-[0.14em]">BLOODIED</span>}
                </span>
              </>
            )}
            <span className="font-mono font-bold text-[12px] tracking-[0.08em]">
              {c.armorClass !== undefined && <>AC {c.armorClass}</>}
              {c.armorClass !== undefined && c.passivePerception !== undefined && ' · '}
              {c.passivePerception !== undefined && <>PP {c.passivePerception}</>}
            </span>
            <button
              type="button"
              aria-pressed={spot}
              onClick={() => live.toggleSpotlit(c.id)}
              title="Mark that this character had the spotlight tonight"
              className={cn('self-start font-mono font-bold text-[11px] tracking-[0.12em]', spot ? 'text-spot' : 'text-mute hover:text-ink')}
            >
              {spot ? '★ SPOTLIT' : '☆ SPOTLIT'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
