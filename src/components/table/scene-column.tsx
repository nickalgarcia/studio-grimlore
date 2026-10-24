'use client';

import * as React from 'react';
import Link from 'next/link';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { MonoLabel, SectionHeader } from '@/components/shared/section-header';
import { LiveNotes } from '@/components/table/live-notes';
import { useSceneWriter } from '@/firebase';
import { ruleAnchor } from '@/lib/core-rules';
import { GLYPH, pageHref, rulesHref } from '@/lib/pages';
import { cn } from '@/lib/utils';
import type { Capture, Disposition } from '@/lib/types';

function Panel({ label, text }: { label: string; text: string }) {
  return (
    <div className="relative min-h-[150px] border-[3px] border-ink bg-panel px-4 pt-10 pb-4">
      <span className="absolute top-0 left-0 px-2.5 py-1 bg-ink text-bg font-mono font-bold text-[11px] tracking-[0.16em] uppercase">
        {label}
      </span>
      <p className="text-[21px] leading-[1.4]">{text}</p>
    </div>
  );
}

/**
 * The players can see this screen, so the secret stays blurred until the DM
 * taps it. Remounted per scene (keyed by the parent), so it re-hides itself.
 */
function SecretPanel({ text }: { text: string }) {
  const [shown, setShown] = React.useState(false);
  return (
    <div className="border-[3px] border-dashed border-spot min-h-[150px] flex flex-col">
      <button
        type="button"
        aria-expanded={shown}
        onClick={() => setShown(s => !s)}
        className="w-full bg-spot text-spot-on px-3 py-1.5 text-left font-mono font-bold text-[11px] tracking-[0.16em]"
      >
        {shown ? 'SECRET · TAP TO HIDE' : 'SECRET · TAP TO REVEAL'}
      </button>
      <p
        className={cn('px-4 py-3 text-[21px] leading-[1.4] transition-[filter] duration-200', !shown && 'blur-[8px] select-none')}
        aria-hidden={!shown}
      >
        {text}
      </p>
    </div>
  );
}

function DispositionChip({ d }: { d?: Disposition }) {
  if (!d) return null;
  return (
    <span className={cn(
      'px-1.5 py-0.5 font-mono font-bold text-[11px] tracking-[0.14em] uppercase border-[1.5px]',
      d === 'Hostile' && 'bg-spot text-spot-on border-spot',
      d === 'Unfriendly' && 'border-spot text-spot',
      d !== 'Hostile' && d !== 'Unfriendly' && 'border-line2 text-mute',
    )}>
      {d}
    </span>
  );
}

function elapsed(at: string, startedAt: string | null): string {
  const t = Date.parse(at);
  if (Number.isNaN(t)) return '';
  const from = startedAt ? Date.parse(startedAt) : NaN;
  // Before START (or captured midweek), show the clock time instead.
  if (Number.isNaN(from) || t < from) return new Date(t).toTimeString().slice(0, 5);
  const mins = Math.floor((t - from) / 60_000);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/** The left of the cockpit: the scene, who's in it, the rules at hand, and tonight's notes. */
export function SceneColumn({ onEditScene, onNewScene }: { onEditScene: () => void; onNewScene: () => void }) {
  const { activeCampaign, scene, onStage, rules, live } = useCampaign();
  const { removeFromStage } = useSceneWriter(activeCampaign?.id);
  const pinned = rules.filter(r => r.pinned);
  const where = [scene?.location, scene?.timeOfDay].filter(Boolean).join(' · ');

  return (
    <div className="min-w-0 p-6 flex flex-col gap-9">
      {scene ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <MonoLabel className="text-mute">
                {GLYPH.lore} Scene {scene.sceneNumber ?? ''}{where ? ` · ${where}` : ''}
              </MonoLabel>
              <h2 className="font-headline font-black leading-[0.88] text-[clamp(40px,4vw,60px)] [text-wrap:balance]">{scene.name}</h2>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onEditScene} className="h-8 px-3 border-[1.5px] border-line2 font-mono font-bold text-[12px] tracking-[0.14em] hover:border-ink">EDIT SCENE</button>
              <button type="button" onClick={onNewScene} className="h-8 px-3 border-[1.5px] border-line2 font-mono font-bold text-[12px] tracking-[0.14em] hover:border-ink">NEW SCENE</button>
            </div>
          </div>
          {(scene.constraint || scene.pressure || scene.wayOut || scene.secret) ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-2.5">
              {scene.constraint && <Panel label="Constraint" text={scene.constraint} />}
              {scene.pressure && <Panel label="Pressure" text={scene.pressure} />}
              {scene.wayOut && <Panel label="Way out" text={scene.wayOut} />}
              {scene.secret && <SecretPanel key={scene.id} text={scene.secret} />}
            </div>
          ) : (
            <p className="italic text-mute">No constraint, pressure, way out or secret yet. EDIT SCENE to add them.</p>
          )}
        </section>
      ) : (
        <div className="border-[3px] border-dashed border-line2 p-6 flex flex-col items-start gap-3">
          <MonoLabel>No scene yet</MonoLabel>
          <p className="italic text-[17px] text-mute">Start one here, or ▶ STAGE a scene from Prep.</p>
          <button type="button" onClick={onNewScene} className="h-9 px-3.5 bg-ink text-bg font-mono font-bold text-[12px] tracking-[0.14em]">NEW SCENE</button>
        </div>
      )}

      {onStage.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader glyph={GLYPH.person} label="On stage" meta={onStage.length} />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2.5">
            {onStage.map(n => (
              <div key={n.id} className="relative flex gap-3 p-3 border-[1.5px] border-ink">
                <Link href={pageHref({ kind: 'npc', id: n.id })} className="absolute inset-0" aria-label={`Open ${n.name}`} />
                <div className="flex-none w-[84px] h-[104px] bg-panel border-[1.5px] border-ink overflow-hidden">
                  {n.portraitUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.portraitUrl} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-headline font-black text-[22px] leading-none">{n.name}</span>
                    <DispositionChip d={n.disposition} />
                  </div>
                  {n.wants && <p className="text-[16px] leading-snug"><MonoLabel className="text-spot mr-1.5">Wants</MonoLabel>{n.wants}</p>}
                  {n.knows && <p className="text-[16px] leading-snug"><MonoLabel className="text-mute mr-1.5">Knows</MonoLabel>{n.knows}</p>}
                </div>
                {scene && (
                  <button
                    type="button"
                    onClick={() => removeFromStage(scene.id, n.id)}
                    aria-label={`Take ${n.name} off stage`}
                    className="relative z-[1] self-start ml-auto h-7 px-1.5 font-mono font-bold text-[12px] text-mute hover:text-ink"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeader
          glyph={GLYPH.rule}
          label="At hand"
          meta={<Link href="/rules" className="hover:text-ink">RULEBOOK →</Link>}
        />
        {pinned.length === 0 ? (
          <p className="italic text-mute">Pin rules in the Rulebook and they ride along here.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
            {pinned.map(r => (
              <Link key={r.id} href={rulesHref({ anchor: ruleAnchor(r.id) })} className="p-3 border-[1.5px] border-ink hover:bg-panel flex flex-col gap-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-headline font-black text-[19px] leading-none">{r.title}</span>
                  <MonoLabel className={r.kind === 'house' ? 'text-spot' : 'text-mute'}>{r.kind === 'house' ? 'House' : '5E'}</MonoLabel>
                </span>
                <span className="text-[15px] leading-snug line-clamp-3">{r.text}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeader glyph={GLYPH.note} label="Captured tonight" meta={live.captures.length} />
        {live.captures.length === 0 ? (
          <p className="italic text-mute">Type + and a note in the search bar to capture it, from any screen.</p>
        ) : (
          <ol className="flex flex-col">
            {live.captures.map((c: Capture) => (
              <li key={c.id} className="grid grid-cols-[54px_minmax(0,1fr)] gap-3 py-2 border-b border-line">
                <span className="font-mono font-bold text-[12px] text-mute pt-1">{elapsed(c.at, live.startedAt)}</span>
                <span className="text-[18px] leading-snug">{c.text}</span>
              </li>
            ))}
          </ol>
        )}
        <details className="group pt-2">
          <summary className="cursor-pointer list-none font-mono font-bold text-[12px] tracking-[0.16em] text-mute hover:text-ink">
            {GLYPH.note} FREE NOTES <span className="group-open:hidden">▸</span><span className="hidden group-open:inline">▾</span>
          </summary>
          <div className="pt-2">
            <LiveNotes key={live.notesKey} initialValue={live.initialNotes} onNotesChange={live.handleNotesChange} />
          </div>
        </details>
      </section>
    </div>
  );
}
