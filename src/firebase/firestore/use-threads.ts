'use client';

import * as React from 'react';
import { doc, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useUser } from '@/firebase/provider';
import {
  addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import { useCollection, type WithId } from './use-collection';
import { clientCreatedAt, stripUndefined, useCampaignCollectionRef } from './campaign-collection';
import type { Thread, ThreadStatus } from '@/lib/types';

/** Live threads first, then seeded, then cold — the order a DM scans them in. */
const STATUS_RANK: Record<ThreadStatus, number> = { live: 0, seeded: 1, cold: 2 };

export function useThreads(campaignId: string | null | undefined) {
  const ref = useCampaignCollectionRef(campaignId, 'threads');
  const threadsQuery = useMemoFirebase(
    () => (ref ? query(ref, orderBy('createdAt', 'desc')) : null),
    [ref],
  );
  const { data, isLoading, error } = useCollection<Thread>(threadsQuery);

  // Sorted client-side: Firestore can't order by a custom status ranking
  // without a second indexed field, and the list is small enough that it isn't
  // worth denormalizing one.
  const sorted = React.useMemo(() => {
    if (!data) return data;
    return [...data].sort(
      (a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9),
    );
  }, [data]);

  return { data: sorted, isLoading, error };
}

/**
 * Next free `T-NN` handle. Scans the existing tags rather than counting
 * documents so deleting a thread never hands its tag to a different one.
 */
export function nextThreadTag(threads: WithId<Thread>[] | null | undefined): string {
  const highest = (threads ?? []).reduce((max, t) => {
    const n = parseInt(String(t.tag ?? '').replace(/^\D+/, ''), 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  return `T-${String(highest + 1).padStart(2, '0')}`;
}

export function useThreadWriter(campaignId: string | null | undefined) {
  const { user } = useUser();
  const firestore = useFirestore();
  const threadsRef = useCampaignCollectionRef(campaignId, 'threads');

  const threadDoc = React.useCallback(
    (threadId: string) => {
      if (!user || !campaignId) return null;
      return doc(firestore, 'users', user.uid, 'campaigns', campaignId, 'threads', threadId);
    },
    [user, firestore, campaignId],
  );

  const createThread = React.useCallback(
    (thread: { tag: string; title: string; note?: string; status?: ThreadStatus }) => {
      if (!threadsRef || !campaignId) return Promise.resolve(null);
      return addDocumentNonBlocking(threadsRef, stripUndefined({
        ...thread,
        campaignId,
        status: thread.status ?? 'seeded',
        createdAt: clientCreatedAt(),
        updatedAt: serverTimestamp(),
      }));
    },
    [threadsRef, campaignId],
  );

  const updateThread = React.useCallback(
    (threadId: string, patch: Partial<Thread>) => {
      const ref = threadDoc(threadId);
      if (!ref) return Promise.resolve();
      return updateDocumentNonBlocking(ref, stripUndefined({ ...patch, updatedAt: serverTimestamp() }));
    },
    [threadDoc],
  );

  const deleteThread = React.useCallback(
    (threadId: string) => {
      const ref = threadDoc(threadId);
      if (!ref) return Promise.resolve();
      return deleteDocumentNonBlocking(ref);
    },
    [threadDoc],
  );

  /**
   * Promote `SessionPrepOutput.openThreadsToPull` — which the prep flow emits
   * as loose strings that are currently discarded — into real documents.
   * Titles already present are skipped so re-running prep can't duplicate them.
   */
  const promoteThreads = React.useCallback(
    (titles: string[], existing: WithId<Thread>[] | null | undefined) => {
      const seen = new Set((existing ?? []).map(t => t.title.trim().toLowerCase()));
      let tagSeed = existing;
      const writes: Promise<unknown>[] = [];

      for (const title of titles) {
        const key = title.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const tag = nextThreadTag(tagSeed);
        writes.push(createThread({ tag, title: title.trim(), status: 'seeded' }));
        // Seed the next tag off a synthetic entry so a batch of promotions
        // doesn't hand every thread the same handle.
        tagSeed = [...(tagSeed ?? []), { tag } as WithId<Thread>];
      }

      return Promise.all(writes);
    },
    [createThread],
  );

  return { createThread, updateThread, deleteThread, promoteThreads };
}
