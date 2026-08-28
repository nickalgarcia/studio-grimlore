'use client';

import * as React from 'react';
import {
  arrayRemove, arrayUnion, doc, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useUser } from '@/firebase/provider';
import {
  addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import { useCollection, type WithId } from './use-collection';
import { clientCreatedAt, stripUndefined, useCampaignCollectionRef } from './campaign-collection';
import type { Scene } from '@/lib/types';

/** All scenes for a campaign, newest first. */
export function useScenes(campaignId: string | null | undefined) {
  const ref = useCampaignCollectionRef(campaignId, 'scenes');
  const scenesQuery = useMemoFirebase(
    () => (ref ? query(ref, orderBy('createdAt', 'desc')) : null),
    [ref],
  );
  return useCollection<Scene>(scenesQuery);
}

/**
 * The scene the party is in right now — simply the newest one.
 *
 * Deliberately derived rather than stored as an `isCurrent` flag: a flag would
 * need a transaction to clear the previous holder on every scene change, and a
 * half-applied transaction leaves two current scenes or none.
 */
export function useCurrentScene(campaignId: string | null | undefined): {
  data: WithId<Scene> | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useScenes(campaignId);
  return { data: data?.[0] ?? null, isLoading, error: error ?? null };
}

export type NewScene = Omit<Scene, 'id' | 'campaignId' | 'createdAt' | 'updatedAt' | 'onStageNpcIds'>
  & Partial<Pick<Scene, 'onStageNpcIds'>>;

export function useSceneWriter(campaignId: string | null | undefined) {
  const { user } = useUser();
  const firestore = useFirestore();
  const scenesRef = useCampaignCollectionRef(campaignId, 'scenes');

  const sceneDoc = React.useCallback(
    (sceneId: string) => {
      if (!user || !campaignId) return null;
      return doc(firestore, 'users', user.uid, 'campaigns', campaignId, 'scenes', sceneId);
    },
    [user, firestore, campaignId],
  );

  const createScene = React.useCallback(
    (scene: NewScene) => {
      if (!scenesRef || !campaignId) return Promise.resolve(null);
      return addDocumentNonBlocking(scenesRef, stripUndefined({
        ...scene,
        campaignId,
        onStageNpcIds: scene.onStageNpcIds ?? [],
        createdAt: clientCreatedAt(),
        updatedAt: serverTimestamp(),
      }));
    },
    [scenesRef, campaignId],
  );

  const updateScene = React.useCallback(
    (sceneId: string, patch: Partial<Scene>) => {
      const ref = sceneDoc(sceneId);
      if (!ref) return Promise.resolve();
      return updateDocumentNonBlocking(ref, stripUndefined({ ...patch, updatedAt: serverTimestamp() }));
    },
    [sceneDoc],
  );

  const deleteScene = React.useCallback(
    (sceneId: string) => {
      const ref = sceneDoc(sceneId);
      if (!ref) return Promise.resolve();
      return deleteDocumentNonBlocking(ref);
    },
    [sceneDoc],
  );

  /**
   * Put an NPC on stage. Two writes, both idempotent: `arrayUnion` so adding
   * the same NPC twice is a no-op rather than a duplicate row, and a stamp of
   * the session number onto the NPC so the Codex SEEN column has something
   * real behind it.
   */
  const putOnStage = React.useCallback(
    (sceneId: string, npcId: string, sessionNumber?: number) => {
      const scene = sceneDoc(sceneId);
      if (!scene || !user || !campaignId) return Promise.resolve();

      const writes: Promise<unknown>[] = [
        updateDocumentNonBlocking(scene, {
          onStageNpcIds: arrayUnion(npcId),
          updatedAt: serverTimestamp(),
        }),
      ];

      if (typeof sessionNumber === 'number') {
        const npc = doc(firestore, 'users', user.uid, 'campaigns', campaignId, 'npcs', npcId);
        writes.push(updateDocumentNonBlocking(npc, { lastSeenSession: sessionNumber }));
      }

      return Promise.all(writes);
    },
    [sceneDoc, user, firestore, campaignId],
  );

  const removeFromStage = React.useCallback(
    (sceneId: string, npcId: string) => {
      const ref = sceneDoc(sceneId);
      if (!ref) return Promise.resolve();
      return updateDocumentNonBlocking(ref, {
        onStageNpcIds: arrayRemove(npcId),
        updatedAt: serverTimestamp(),
      });
    },
    [sceneDoc],
  );

  return { createScene, updateScene, deleteScene, putOnStage, removeFromStage };
}
