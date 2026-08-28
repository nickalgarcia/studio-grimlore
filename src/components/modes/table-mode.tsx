'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCheck, Loader2, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CombatTracker } from '@/components/combat-tracker';
import { useCurrentScene } from '@/firebase';
import { useLiveSession } from '@/components/table/use-live-session';
import { CoPilot } from '@/components/table/co-pilot';
import { LiveNotes } from '@/components/table/live-notes';
import { PartyDock } from '@/components/table/party-dock';
import { SceneStage } from '@/components/table/scene-stage';
import type { UseCodexEntriesResult } from '@/components/codex/use-codex-entries';
import type { Campaign } from '@/lib/types';

export type TableView = 'scene' | 'combat';

/**
 * TABLE — running a session right now.
 *
 * Combat is a sub-view rather than a fourth mode: it is the same activity as
 * the rest of Table, and keeping it here is what lets the co-pilot stay in
 * context when the question is "they attack — statblock?".
 */
export function TableMode({
  campaign, codex, view, onViewChange,
}: {
  campaign: Campaign;
  codex: UseCodexEntriesResult;
  view: TableView;
  onViewChange: (v: TableView) => void;
}) {
  const live = useLiveSession(campaign.id);
  const { data: scene } = useCurrentScene(campaign.id);

  // Combat mounts on first use and stays mounted, so a half-typed HP edit
  // survives toggling back to the scene.
  const [combatMounted, setCombatMounted] = React.useState(view === 'combat');
  React.useEffect(() => { if (view === 'combat') setCombatMounted(true); }, [view]);

  const latestSession = codex.raw.sessions?.[0]?.sessionNumber;

  if (live.showCloseFlow) {
    return (
      <div className="overflow-y-auto px-[26px] py-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-xl uppercase tracking-wide text-bone">Close Session</h3>
            <Button variant="ghost" size="sm" onClick={() => live.setShowCloseFlow(false)}>
              <X className="h-4 w-4 mr-1" /> Back to session
            </Button>
          </div>

          {live.isClosing ? (
            <Card className="surface-card">
              <CardContent className="py-12 flex flex-col items-center gap-4">
                <Loader2 className="h-7 w-7 animate-spin text-oxblood-bright" />
                <p className="label-forge">Chronicling the session…</p>
              </CardContent>
            </Card>
          ) : live.recapPreview ? (
            <>
              <Card className="surface-card border-l-4 border-l-oxblood">
                <CardContent className="pt-6">
                  <div className="label-forge mb-3">Session recap — review &amp; save</div>
                  <p className="whitespace-pre-wrap text-[14px] leading-[1.62] text-bone-soft">
                    {live.recapPreview}
                  </p>
                </CardContent>
              </Card>
              <div className="flex gap-3">
                <Button onClick={live.handleSaveRecap} disabled={live.isClosing} className="flex-1">
                  <CheckCheck className="h-4 w-4 mr-2" /> Save session log
                </Button>
                <Button variant="outline" onClick={() => live.setRecapPreview(null)} disabled={live.isClosing}>
                  Regenerate
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 grid grid-cols-[minmax(0,1fr)_396px]">
      {/* ── Stage column ── */}
      <div className="min-w-0 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 px-[26px] pt-3 pb-1 flex-shrink-0">
          {(['scene', 'combat'] as const).map(v => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={cn(
                'font-mono text-[10.5px] font-bold tracking-[0.14em] uppercase px-3 py-1.5 border transition-colors',
                view === v
                  ? 'text-bone bg-oxblood border-oxblood'
                  : 'text-bone-faint border-border/[0.12] hover:text-bone-dim',
              )}
            >
              {v}
            </button>
          ))}
          <div className="flex-1" />
          {(live.messages.length > 0 || live.hasNotes) && (
            <>
              <button
                onClick={live.handleCloseSession}
                disabled={live.isClosing}
                className="font-mono text-[10.5px] font-extrabold tracking-[0.14em] uppercase px-3 py-1.5
                           text-oxblood-bright hover:bg-oxblood/20 hover:text-bone transition-colors"
              >
                <CheckCheck className="h-3 w-3 mr-1.5 inline-block" />
                Close session
              </button>
              <button
                onClick={live.clearSession}
                aria-label="Start a new session"
                className="font-mono text-[10.5px] tracking-[0.14em] uppercase px-2 py-1.5 text-bone-faint hover:text-bone-dim"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-[26px] pt-2 pb-2">
          <div className={view === 'scene' ? 'block' : 'hidden'}>
            <SceneStage
              campaign={campaign}
              scene={scene}
              npcs={codex.raw.npcs ?? []}
              sessionNumber={latestSession}
            >
              <LiveNotes
                key={live.notesKey}
                initialValue={live.initialNotes}
                onNotesChange={live.handleNotesChange}
              />
            </SceneStage>
          </div>

          {/* Hidden rather than unmounted: the tracker owns debounced writes
              and in-flight edits that unmounting would abort. */}
          {combatMounted && (
            <div className={view === 'combat' ? 'block' : 'hidden'}>
              <CombatTracker campaignId={campaign.id} />
            </div>
          )}
        </div>

        {view === 'scene' && <PartyDock characters={codex.raw.characters ?? []} />}
      </div>

      {/* ── Co-pilot column ── */}
      <CoPilot
        messages={live.messages}
        input={live.input}
        setInput={live.setInput}
        isLoading={live.isLoading}
        onSend={live.sendMessage}
        textareaRef={live.textareaRef}
        sessionCount={codex.raw.sessions?.length ?? 0}
      />
    </div>
  );
}
