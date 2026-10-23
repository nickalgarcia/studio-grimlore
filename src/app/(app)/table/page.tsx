'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { TableMode, type TableView } from '@/components/modes/table-mode';
import { ElapsedClock } from '@/components/table/elapsed-clock';
import { MonoLabel } from '@/components/shared/section-header';

/**
 * Stand-in until Stage 6: the v3 Table, in a viewport-height box because its
 * cockpit grid (and the party dock) needs a fixed height to lay out.
 *
 * Caveat until the combat hook moves into the provider (Stage 6): the combat
 * tracker now unmounts when you leave /table. It saves every change as it
 * happens, so only an HP number half-typed at that moment is lost.
 */
export default function TablePage() {
  const router = useRouter();
  const { activeCampaign, codex, live, nextIssueNumber, hrefForEntryId } = useCampaign();
  const [view, setView] = React.useState<TableView>('scene');
  if (!activeCampaign) return null;

  const hasSession = live.messages.length > 0 || live.hasNotes || live.captures.length > 0;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* The v3 status bar held these; they wait here for the live bar. */}
      <div className="flex-none flex items-center gap-4 px-6 h-10 border-b border-line">
        <MonoLabel>Issue #{nextIssueNumber}</MonoLabel>
        <ElapsedClock startedAt={live.startedAt} />
        <span className="flex-1" />
        {hasSession && (
          <button
            type="button"
            onClick={live.handleCloseSession}
            disabled={live.isClosing}
            className="font-mono font-bold text-[12px] tracking-[0.14em] uppercase disabled:opacity-50"
          >
            Close session
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)]">
        <TableMode
          campaign={activeCampaign}
          codex={codex}
          live={live}
          view={view}
          onViewChange={setView}
          onOpenInCodex={id => { const href = hrefForEntryId(id); if (href) router.push(href); }}
        />
      </div>
    </div>
  );
}
