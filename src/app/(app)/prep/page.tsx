'use client';

import * as React from 'react';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { ForgeMode, type ForgeView } from '@/components/modes/forge-mode';

/**
 * Stand-in until Stage 6: the whole v3 Forge, so prep, the campaign overview
 * (summary, logging, export) and the generators stay reachable on this branch.
 */
export default function PrepPage() {
  const { activeCampaign, codex, saveConcept } = useCampaign();
  const [view, setView] = React.useState<ForgeView>('prep');
  if (!activeCampaign) return null;
  return (
    <ForgeMode
      campaign={activeCampaign}
      codex={codex}
      view={view}
      onViewChange={setView}
      onSaveConcept={saveConcept}
    />
  );
}
