'use client';

import * as React from 'react';
import { doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase/provider';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { stripUndefined } from './campaign-collection';
import type { MentionKind } from '@/lib/types';

/** Subcollection per page kind, under `users/{uid}/campaigns/{campaignId}/`. */
const COLLECTION: Record<Exclude<MentionKind, 'item'>, string> = {
  npc: 'npcs',
  party: 'characters',
  place: 'locations',
  faction: 'factions',
  thread: 'threads',
};

export type WritableKind = keyof typeof COLLECTION;

export function isWritableKind(kind: string): kind is WritableKind {
  return kind in COLLECTION;
}

/**
 * Patch any page's document. `campaignId` is always written, because the
 * rules check it on update for characters, locations and threads, and older
 * documents may lack it.
 */
export function useEntityWriter(campaignId: string | null | undefined) {
  const { user } = useUser();
  const firestore = useFirestore();

  return React.useCallback(
    (kind: WritableKind, id: string, patch: Record<string, unknown>) => {
      if (!user || !campaignId) return Promise.resolve();
      const ref = doc(firestore, 'users', user.uid, 'campaigns', campaignId, COLLECTION[kind], id);
      return updateDocumentNonBlocking(ref, stripUndefined({
        ...patch,
        campaignId,
        // Threads keep an updatedAt; the other kinds never had one.
        ...(kind === 'thread' ? { updatedAt: serverTimestamp() } : {}),
      }));
    },
    [user, firestore, campaignId],
  );
}
