'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { CombatTracker } from '@/components/combat-tracker';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CoPilot } from '@/components/table/co-pilot';
import { ElapsedClock } from '@/components/table/elapsed-clock';
import { EndSessionDialog } from '@/components/table/end-session-dialog';
import { PartyDock } from '@/components/table/party-dock';
import { SceneColumn } from '@/components/table/scene-column';
import { SceneEditorDialog } from '@/components/table/scene-editor-dialog';
import { TurnStrip } from '@/components/table/turn-strip';
import { useMediaQuery } from '@/hooks/use-media-query';
import { GLYPH } from '@/lib/pages';
import { cn } from '@/lib/utils';

const COPILOT_KEY = 'grimlore.copilot';

export default function TablePage() {
  return (
    <React.Suspense fallback={null}>
      <Table />
    </React.Suspense>
  );
}

/**
 * The live console: exactly the viewport under the header, never taller, so
 * the party dock is always on screen. Live bar and turn strip on top, scene
 * and co-pilot side by side (only the scene column scrolls), dock at the foot.
 */
function Table() {
  const router = useRouter();
  const params = useSearchParams();
  const { live, nextIssueNumber, scene, combat, codex } = useCampaign();
  const narrow = useMediaQuery('(max-width: 1099px)');

  // Co-pilot open: remembered per browser; storage that throws is ignored.
  const [copilot, setCopilot] = React.useState(true);
  React.useEffect(() => {
    try { if (window.localStorage.getItem(COPILOT_KEY) === 'closed') setCopilot(false); } catch { /* default open */ }
  }, []);
  const toggleCopilot = () => setCopilot(o => {
    try { window.localStorage.setItem(COPILOT_KEY, o ? 'closed' : 'open'); } catch { /* preference only */ }
    return !o;
  });
  // On a narrow screen the column is a sheet, closed until asked for.
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const [setupOpen, setSetupOpen] = React.useState(false);
  const [sceneDialog, setSceneDialog] = React.useState<'edit' | 'new' | null>(null);
  const [ending, setEnding] = React.useState(false);

  // RUN buttons link here with ?run=1: start the clock once the stored
  // session has loaded (starting earlier would be overwritten by hydration).
  // ?ask= comes from the command bar's "Ask the co-pilot" row.
  React.useEffect(() => {
    if (!live.hydrated) return;
    const run = params.get('run') === '1';
    const ask = params.get('ask');
    if (!run && !ask) return;
    if (run) live.start();
    if (ask) {
      live.setInput(ask);
      if (narrow) setSheetOpen(true); else setCopilot(true);
      setTimeout(() => live.textareaRef.current?.focus(), 50);
    }
    router.replace('/table', { scroll: false });
  }, [live.hydrated, params]); // eslint-disable-line react-hooks/exhaustive-deps

  const running = !!live.startedAt;
  const sceneLine = scene ? `Scene ${scene.sceneNumber ?? ''} — ${scene.name}${scene.timeOfDay ? ` · ${scene.timeOfDay}` : ''}` : null;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* ── Live bar ── */}
      <div className="flex-none flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-2.5 bg-spot text-spot-on font-headline font-extrabold text-[19px] uppercase">
        <span>{running ? '● Live' : '○ Ready'} · Issue #{nextIssueNumber}</span>
        {sceneLine && <span className="truncate min-w-0">{sceneLine}</span>}
        <span className="flex-1" />
        <ElapsedClock startedAt={live.startedAt} className="font-mono font-bold text-[14px] tracking-[0.12em]" />
        <button
          type="button"
          aria-pressed={narrow ? sheetOpen : copilot}
          onClick={() => (narrow ? setSheetOpen(true) : toggleCopilot())}
          className={cn(
            'h-8 px-3 border-2 border-spot-on font-mono font-bold text-[12px] tracking-[0.14em]',
            (narrow ? sheetOpen : copilot) && 'bg-spot-on text-spot',
          )}
        >
          {GLYPH.copilot} CO-PILOT
        </button>
        {running ? (
          <button type="button" onClick={() => setEnding(true)} className="h-8 px-3 border-2 border-spot-on font-mono font-bold text-[12px] tracking-[0.14em] hover:bg-spot-on hover:text-spot">
            END SESSION
          </button>
        ) : (
          <button type="button" onClick={live.start} className="h-8 px-3 bg-spot-on text-spot font-mono font-bold text-[12px] tracking-[0.14em]">
            START ▶
          </button>
        )}
      </div>

      <TurnStrip onSetUp={() => setSetupOpen(true)} />

      {/* grid-rows-[minmax(0,1fr)] is load-bearing: without it the row grows to
          its tallest child and pushes the party dock off screen. */}
      <div className="flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)] grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-h-0 overflow-y-auto">
          <SceneColumn onEditScene={() => setSceneDialog('edit')} onNewScene={() => setSceneDialog('new')} />
        </div>
        {!narrow && copilot && (
          <CoPilot live={live} className="w-[380px] min-w-[300px] h-full border-l border-line" />
        )}
      </div>

      <PartyDock />

      {narrow && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right" className="w-[min(420px,100vw)] p-0 flex flex-col">
            <SheetHeader className="sr-only">
              <SheetTitle>Co-pilot</SheetTitle>
              <SheetDescription>Ask the co-pilot about the scene.</SheetDescription>
            </SheetHeader>
            <CoPilot live={live} className="flex-1" />
          </SheetContent>
        </Sheet>
      )}

      <Sheet open={setupOpen} onOpenChange={setSetupOpen}>
        <SheetContent side="right" className="w-[min(760px,100vw)] sm:max-w-none overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>Set up combat</SheetTitle>
            <SheetDescription>Add combatants, roll initiative and track HP and conditions.</SheetDescription>
          </SheetHeader>
          <CombatTracker combat={combat} characters={codex.raw.characters ?? []} />
        </SheetContent>
      </Sheet>

      <SceneEditorDialog open={!!sceneDialog} mode={sceneDialog ?? 'new'} onOpenChange={o => { if (!o) setSceneDialog(null); }} />
      <EndSessionDialog open={ending} onOpenChange={setEnding} />
    </div>
  );
}
