'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { BookOpen, ClipboardList, Sparkles } from 'lucide-react';
import { CampaignOverview } from '@/components/forge/campaign-overview';
import { SessionPrep } from '@/components/session-prep';
import { IdeaGenerator } from '@/components/idea-generator';
import { InspirationGenerator } from '@/components/inspiration-generator';
import type { UseCodexEntriesResult } from '@/components/codex/use-codex-entries';
import type { Campaign, SavedConcept } from '@/lib/types';

export type ForgeView = 'prep' | 'overview' | 'generate';

const VIEWS: { id: ForgeView; label: string; icon: React.ReactNode }[] = [
  { id: 'prep', label: 'Prep', icon: <ClipboardList className="h-3.5 w-3.5" /> },
  { id: 'overview', label: 'Overview', icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: 'generate', label: 'Generate', icon: <Sparkles className="h-3.5 w-3.5" /> },
];

/**
 * FORGE — everything you do between sessions.
 *
 * The three views are a single in-mode switch, the same shape as Table's
 * SCENE / COMBAT toggle. It is not a return of the old sub-tab bar: those were
 * a second nav *level* holding entity types that are now siblings in the Codex,
 * whereas these are three tools that all belong to "prepping". Mounting them
 * one at a time also keeps three sets of AI-backed queries from firing at once.
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
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {VIEWS.map(v => (
          <Button
            key={v.id}
            size="sm"
            variant={view === v.id ? 'default' : 'outline'}
            onClick={() => onViewChange(v.id)}
            className="gap-2"
          >
            {v.icon}
            {v.label}
          </Button>
        ))}
      </div>

      {view === 'prep' && <SessionPrep campaignId={campaign.id} />}
      {view === 'overview' && <CampaignOverview campaign={campaign} codex={codex} />}
      {view === 'generate' && (
        <div className="space-y-10">
          <IdeaGenerator onSave={onSaveConcept} campaignId={campaign.id} />
          <InspirationGenerator onSave={onSaveConcept} />
        </div>
      )}
    </div>
  );
}
