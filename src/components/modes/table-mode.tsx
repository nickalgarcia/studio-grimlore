'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Flame, Swords } from 'lucide-react';
import { LiveSession } from '@/components/live-session';
import { CombatTracker } from '@/components/combat-tracker';
import type { Campaign } from '@/lib/types';

export type TableView = 'scene' | 'combat';

/**
 * TABLE — running a session right now.
 *
 * Combat is a sub-view rather than a fourth mode (Open Question 1): it is the
 * same activity as the rest of Table, and keeping it here is what lets the
 * co-pilot stay in context when the question is "they attack — statblock?".
 */
export function TableMode({
  campaign, view, onViewChange,
}: {
  campaign: Campaign;
  view: TableView;
  onViewChange: (v: TableView) => void;
}) {
  // Combat mounts on first use and stays mounted thereafter.
  const [combatMounted, setCombatMounted] = React.useState(view === 'combat');
  React.useEffect(() => {
    if (view === 'combat') setCombatMounted(true);
  }, [view]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={view === 'scene' ? 'default' : 'outline'}
          onClick={() => onViewChange('scene')}
          className="gap-2"
        >
          <Flame className="h-3.5 w-3.5" /> Scene
        </Button>
        <Button
          size="sm"
          variant={view === 'combat' ? 'default' : 'outline'}
          onClick={() => onViewChange('combat')}
          className="gap-2"
        >
          <Swords className="h-3.5 w-3.5" /> Combat
        </Button>
      </div>

      {/* Hidden rather than unmounted. Both children own debounced Firestore
          writes and in-flight state — a streaming reply, a half-typed HP edit —
          and unmounting on every toggle would abort them mid-flight. */}
      <div className={view === 'scene' ? 'block' : 'hidden'}>
        <LiveSession campaignId={campaign.id} />
      </div>
      {combatMounted && (
        <div className={view === 'combat' ? 'block' : 'hidden'}>
          <CombatTracker campaignId={campaign.id} />
        </div>
      )}
    </div>
  );
}
