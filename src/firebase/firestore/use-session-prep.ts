'use client';

import * as React from 'react';
import { deleteField, doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase/provider';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { SessionPrepState } from '@/lib/types';

type Prep = NonNullable<SessionPrepState['prep']>;

/** Writes to `sessionPrep/current`, the prep for the next issue. */
export function usePrepWriter(campaignId: string | null | undefined) {
  const { user } = useUser();
  const firestore = useFirestore();

  const ref = React.useMemo(
    () => (user && campaignId ? doc(firestore, 'users', user.uid, 'campaigns', campaignId, 'sessionPrep', 'current') : null),
    [user, firestore, campaignId],
  );

  /** Replace the whole prep (a fresh co-pilot draft). */
  const savePrep = React.useCallback((prep: Prep | null) => {
    if (!ref || !campaignId) return Promise.resolve();
    return setDocumentNonBlocking(ref, { campaignId, prep, updatedAt: serverTimestamp() }, { merge: true });
  }, [ref, campaignId]);

  /**
   * Change some fields of an existing prep: ticked reminders, edited scenes.
   * A merge write deep-merges maps, so the rest of `prep` is untouched; only
   * call it when a prep exists, or the merge would leave a partial one.
   */
  const patchPrep = React.useCallback((patch: Partial<Prep>) => {
    if (!ref || !campaignId) return Promise.resolve();
    return setDocumentNonBlocking(ref, { campaignId, prep: patch, updatedAt: serverTimestamp() }, { merge: true });
  }, [ref, campaignId]);

  /** The next issue's date and cover, which exist with or without a prep. `null` clears. */
  const setMeta = React.useCallback((meta: { scheduledAt?: string | null; coverUrl?: string | null }) => {
    if (!ref || !campaignId) return Promise.resolve();
    const out: Record<string, unknown> = { campaignId, updatedAt: serverTimestamp() };
    for (const [k, v] of Object.entries(meta)) {
      if (v === undefined) continue;
      out[k] = v === null ? deleteField() : v;
    }
    return setDocumentNonBlocking(ref, out, { merge: true });
  }, [ref, campaignId]);

  /**
   * At END SESSION: keep the played issue's prep as `sessionPrep/s{N}` and
   * start the next issue clean. The existing rules cover any id here.
   */
  const archive = React.useCallback(async (state: SessionPrepState | null, sessionNumber: number) => {
    if (!user || !campaignId || !ref) return;
    if (state?.prep) {
      const archived = doc(firestore, 'users', user.uid, 'campaigns', campaignId, 'sessionPrep', `s${sessionNumber}`);
      await setDocumentNonBlocking(archived, { campaignId, prep: state.prep, updatedAt: serverTimestamp() }, { merge: false });
    }
    await setDocumentNonBlocking(ref, {
      campaignId, prep: null, scheduledAt: deleteField(), coverUrl: deleteField(), updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [user, firestore, campaignId, ref]);

  return { savePrep, patchPrep, setMeta, archive };
}
