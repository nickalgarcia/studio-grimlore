'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CampaignOverview } from '@/components/forge/campaign-overview';
import { SessionPrep } from '@/components/session-prep';
import { IdeaGenerator } from '@/components/idea-generator';
import { InspirationGenerator } from '@/components/inspiration-generator';
import type { UseCodexEntriesResult } from '@/components/codex/use-codex-entries';
import type { Campaign, SavedConcept } from '@/lib/types';

export type ForgeView = 'prep' | 'overview' | 'generate';

const VIEWS: { id: ForgeView; label: string }[] = [
  { id: 'prep', label: 'Prep' },
  { id: 'overview', label: 'Overview' },
  { id: 'generate', label: 'Generate' },
];

const TITLE: Record<ForgeView, string> = {
  prep: 'Session Prep',
  overview: 'The Story So Far',
  generate: 'Idea Forge',
};

/**
 * FORGE — everything you do between sessions.
 *
 * The three views are one in-mode switch, the same shape as Table's
 * SCENE / COMBAT toggle. Not a return of the old sub-tab bar: those were a
 * second nav *level* holding entity types that are now Codex siblings, whereas
 * these are three tools that all belong to "prepping". Mounting one at a time
 * also keeps three AI-backed screens from querying at once.
 */
export function ForgeMode({
  campaign, codex, view, onViewChange, onSaveConcept,
}: {
  campaign: Campaign;
  codex: UseCodexEntriesResult;
  view: ForgeView;
  onViewChange: (v: ForgeView) => void;
  onSaveConcept: (concept: Omit<SavedConcept, 'id' | 'createdAt' | 'userId'>) => void;
}) {
  return (
    <div className="min-h-0 overflow-y-auto">
      {/* box-sizing + width:100% on a padded max-width container, or the
          fixed-track siblings refuse to shrink and overflow horizontally. */}
      <div className="w-full box-border max-w-[1240px] mx-auto px-[28px] pt-[26px] pb-[60px]">
        <div className="flex items-center gap-3 mb-3 animate-rise">
          <span className="h-[13px] w-[4px] bg-oxblood shadow-[0_0_14px_hsl(var(--oxblood-bright)/0.9)]" />
          <span className="font-mono text-[10px] font-extrabold tracking-[0.3em] text-oxblood-bright uppercase">
            Forge · {campaign.name}
          </span>
          <span className="flex-1 h-px bg-[linear-gradient(90deg,hsl(var(--oxblood)/0.5),hsl(var(--border)/0.08))]" />
        </div>

        <h1 className="font-headline text-[46px] font-black uppercase leading-[0.98] text-bone
                       [text-shadow:0_0_60px_hsl(var(--oxblood)/0.45)] mb-5 animate-rise [animation-delay:.05s]">
          {TITLE[view]}
        </h1>

        <div className="flex items-center gap-0.5 mb-6">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              aria-current={view === v.id ? 'true' : undefined}
              className={cn(
                'font-mono text-[10px] font-bold tracking-[0.12em] uppercase px-[11px] py-[5px] border transition-colors',
                view === v.id
                  ? 'text-bone bg-oxblood border-oxblood'
                  : 'text-bone-faint border-border/[0.12] hover:text-bone-dim',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="animate-rise [animation-delay:.12s]">
          {view === 'prep' && <SessionPrep campaignId={campaign.id} />}
          {view === 'overview' && <CampaignOverview campaign={campaign} codex={codex} />}
          {view === 'generate' && (
            <div className="space-y-10">
              <IdeaGenerator onSave={onSaveConcept} campaignId={campaign.id} />
              <InspirationGenerator onSave={onSaveConcept} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
