'use client';

import * as React from 'react';
import { dispositionTone } from '@/lib/codex';
import { cn } from '@/lib/utils';
import type { Campaign, Npc, Scene } from '@/lib/types';

function Eyebrow({ label, right }: { label: string; right?: string }) {
  return (
    <div className="flex items-center gap-3 mb-3 animate-rise">
      <span className="h-[13px] w-[4px] bg-oxblood shadow-[0_0_14px_hsl(var(--oxblood-bright)/0.9)]" />
      <span className="font-mono text-[10px] font-extrabold tracking-[0.3em] text-oxblood-bright">
        {label}
      </span>
      <span className="flex-1 h-px bg-[linear-gradient(90deg,hsl(var(--oxblood)/0.5),hsl(var(--border)/0.08))]" />
      {right && (
        <span className="font-mono text-[10px] tracking-[0.16em] text-bone-faint">{right}</span>
      )}
    </div>
  );
}

function DispositionPill({ disposition }: { disposition?: Npc['disposition'] }) {
  const tone = dispositionTone(disposition);
  return (
    <span
      className={cn(
        'font-mono text-[9px] font-extrabold tracking-[0.16em] uppercase px-[7px] py-[3px] flex-shrink-0',
        tone === 'hostile'
          ? 'text-bone bg-oxblood shadow-[0_0_18px_-4px_hsl(var(--oxblood-bright)/0.9)]'
          : 'text-bone-dim bg-[hsl(var(--border)/0.09)]',
      )}
    >
      {disposition ?? 'Unknown'}
    </span>
  );
}

/**
 * The hero of Table mode, replacing the old empty "Session Assistant" state.
 *
 * Degrades deliberately: with no scene recorded the title falls back to the
 * campaign name and the meta strip and ON STAGE block collapse, so notes and
 * the co-pilot still carry the screen. A scene is an upgrade, not a gate — it
 * gets created the first time you put an entry on stage from the Codex.
 */
export function SceneStage({
  campaign, scene, npcs, sessionNumber, onSelectNpc, children,
}: {
  campaign: Campaign;
  scene: Scene | null;
  npcs: Npc[];
  sessionNumber?: number;
  /** Opens the NPC in the Codex. */
  onSelectNpc?: (npc: Npc) => void;
  children?: React.ReactNode;
}) {
  const onStage = React.useMemo(() => {
    const ids = new Set(scene?.onStageNpcIds ?? []);
    return npcs.filter(n => ids.has(n.id));
  }, [scene?.onStageNpcIds, npcs]);

  const inPlay = [
    { label: 'PRESSURE', text: scene?.pressure, color: 'text-oxblood-bright', top: 'hsl(var(--oxblood))' },
    { label: 'SECRET', text: scene?.secret, color: 'text-bone-faint', top: 'hsl(var(--kind-place))' },
    { label: 'WAY OUT', text: scene?.wayOut, color: 'text-bone-body', top: 'hsl(var(--bone-faint))' },
  ].filter(c => !!c.text);

  const ref = [
    scene?.sceneNumber ? String(scene.sceneNumber).padStart(2, '0') : null,
    sessionNumber ? `S${sessionNumber}` : null,
  ].filter(Boolean).join(' / ');

  return (
    <div>
      <Eyebrow label="THE SCENE" right={ref || undefined} />

      <h1 className="font-headline text-[58px] font-black uppercase leading-[0.95] tracking-[-0.008em] text-bone
                     [text-shadow:0_0_60px_hsl(var(--oxblood)/0.45),0_8px_40px_rgba(0,0,0,0.8)]
                     mb-4 animate-rise [animation-delay:.05s]">
        {scene?.name || campaign.name}
      </h1>

      {(scene?.location || scene?.timeOfDay || scene?.constraint) && (
        <div className="flex items-stretch bg-[hsl(var(--background)/0.66)] border border-border/[0.09]
                        shadow-[0_18px_44px_-20px_rgba(0,0,0,0.95)] animate-rise [animation-delay:.12s]">
          {scene?.location && (
            <div className="px-[18px] py-2.5 border-r border-border/[0.08]">
              <div className="font-mono text-[8.5px] font-extrabold tracking-[0.22em] text-bone-faint mb-[3px]">WHERE</div>
              <div className="text-[13px] text-bone-soft">{scene.location}</div>
            </div>
          )}
          {scene?.timeOfDay && (
            <div className="px-[18px] py-2.5 border-r border-border/[0.08]">
              <div className="font-mono text-[8.5px] font-extrabold tracking-[0.22em] text-bone-faint mb-[3px]">WHEN</div>
              <div className="text-[13px] text-bone-soft">{scene.timeOfDay}</div>
            </div>
          )}
          {scene?.constraint && (
            <div
              className="px-[18px] py-2.5 flex-1"
              style={{ background: 'linear-gradient(180deg, hsl(var(--oxblood)/0.34), hsl(var(--oxblood)/0.14))' }}
            >
              <div className="font-mono text-[8.5px] font-extrabold tracking-[0.22em] text-oxblood-pale mb-[3px]">CONSTRAINT</div>
              <div className="text-[13px] font-semibold text-bone">{scene.constraint}</div>
            </div>
          )}
        </div>
      )}

      {onStage.length > 0 && (
        <>
          <div className="flex items-center gap-3 mt-[26px] mb-3 animate-rise [animation-delay:.18s]">
            <span className="font-mono text-[10px] font-extrabold tracking-[0.3em] text-bone-faint">ON STAGE</span>
            <span className="flex-1 h-[3px] bg-[hsl(var(--border)/0.06)]" />
          </div>

          <div className="flex flex-col gap-2.5">
            {onStage.map((n, i) => (
              <button
                key={n.id}
                type="button"
                onClick={onSelectNpc ? () => onSelectNpc(n) : undefined}
                aria-label={onSelectNpc ? `Open ${n.name} in the Codex` : undefined}
                // A button rather than a div with a pointer cursor, so the card
                // is keyboard-reachable and the cursor only promises what is
                // actually wired up.
                className={cn(
                  'surface-card border-l-4 border-l-oxblood px-[17px] py-[15px] text-left w-full animate-rise',
                  onSelectNpc
                    ? 'surface-card-hover cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-oxblood-bright'
                    : 'cursor-default',
                )}
                style={{ animationDelay: `${(0.2 + i * 0.07).toFixed(2)}s` }}
              >
                <div className="flex items-baseline gap-[11px] mb-2.5">
                  <span className="font-headline text-[22px] font-bold uppercase tracking-[0.01em] text-bone">
                    {n.name}
                  </span>
                  <DispositionPill disposition={n.disposition} />
                  <div className="flex-1" />
                  {n.location && (
                    <span className="font-mono text-[10px] font-bold text-bone-faint truncate max-w-[12rem]">
                      {n.location}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-[66px_minmax(0,1fr)] gap-x-3 gap-y-[7px]">
                  <span className="font-mono text-[8.5px] font-extrabold tracking-[0.2em] text-oxblood-bright pt-1">WANTS</span>
                  <span className="text-[13.5px] leading-[1.5] text-bone-soft">{n.wants || <em className="text-bone-faint not-italic">—</em>}</span>
                  <span className="font-mono text-[8.5px] font-extrabold tracking-[0.2em] text-bone-faint pt-1">KNOWS</span>
                  <span className="text-[13.5px] leading-[1.5] text-bone-dim">{n.knows || <em className="text-bone-faint not-italic">—</em>}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {inPlay.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 mt-[22px]">
          {inPlay.map((c, i) => (
            <div
              key={c.label}
              className="surface-card px-4 py-3.5 h-full animate-rise"
              style={{ borderTop: `3px solid ${c.top}`, animationDelay: `${(0.28 + i * 0.06).toFixed(2)}s` }}
            >
              <div className={cn('font-mono text-[9px] font-extrabold tracking-[0.22em] mb-2', c.color)}>
                {c.label}
              </div>
              <div className="text-[13px] leading-[1.55] text-bone-dim">{c.text}</div>
            </div>
          ))}
        </div>
      )}

      {!scene && (
        <p className="mt-4 text-[13px] text-bone-faint leading-relaxed max-w-[46ch] animate-rise [animation-delay:.12s]">
          No scene set. Put an NPC on stage from the Codex to start one — or just
          take notes below and ask the co-pilot.
        </p>
      )}

      {children}
    </div>
  );
}
