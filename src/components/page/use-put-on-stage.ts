'use client';

import * as React from 'react';
import { useCurrentSceneId, useSceneWriter } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { Campaign, CodexEntry } from '@/lib/types';

/**
 * "Put on stage", moved from the v3 Codex screen unchanged: add the entry to
 * the current scene, creating the first scene if there isn't one, and stamp
 * the session number onto the NPC.
 */
export function usePutOnStage(campaign: Campaign | null, latestSessionNumber: number) {
  const { toast } = useToast();
  const getCurrentSceneId = useCurrentSceneId(campaign?.id);
  const { createScene, putOnStage } = useSceneWriter(campaign?.id);

  return React.useCallback(async (entry: CodexEntry) => {
    if (!campaign) return;
    let sceneId = await getCurrentSceneId();
    if (!sceneId) {
      const created = await createScene({
        name: campaign.name,
        onStageNpcIds: [],
        sessionNumber: latestSessionNumber || undefined,
        sceneNumber: 1,
      });
      sceneId = created?.id ?? null;
    }
    if (!sceneId) {
      toast({ variant: 'destructive', title: 'Could not open a scene' });
      return;
    }
    await putOnStage(sceneId, entry.id, latestSessionNumber || undefined);
    toast({ title: `${entry.name} is on stage`, description: 'They appear on the Table screen.' });
  }, [campaign, getCurrentSceneId, createScene, putOnStage, latestSessionNumber, toast]);
}
