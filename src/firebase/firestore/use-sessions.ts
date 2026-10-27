'use client';

import * as React from 'react';
import { arrayRemove, arrayUnion, doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase/provider';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { stripUndefined, useCampaignCollectionRef } from './campaign-collection';
import type { MentionRef, Session } from '@/lib/types';

/**
 * `recap` is the Director's Cut field; `summary` is what every v3 screen still
 * reads. Until those screens are gone, both are written with the same text so
 * neither side sees a stale copy. Every session write that carries recap text
 * goes through here.
 */
export function recapFields(text: string): Pick<Session, 'recap' | 'summary'> {
  return { recap: text, summary: text };
}

export type NewSession = Pick<Session, 'sessionNumber'> &
  Partial<Pick<Session, 'title' | 'logline' | 'notes' | 'captures' | 'coverUrl' | 'beats'>> & {
    recap?: string;
  };

export function useSessionWriter(campaignId: string | null | undefined) {
  const { user } = useUser();
  const firestore = useFirestore();
  const sessionsRef = useCampaignCollectionRef(campaignId, 'sessions');

  const sessionDoc = React.useCallback(
    (sessionId: string) => {
      if (!user || !campaignId) return null;
      return doc(firestore, 'users', user.uid, 'campaigns', campaignId, 'sessions', sessionId);
    },
    [user, firestore, campaignId],
  );

  const createSession = React.useCallback(
    ({ recap, ...rest }: NewSession) => {
      if (!sessionsRef || !campaignId) return Promise.resolve(null);
      return addDocumentNonBlocking(sessionsRef, stripUndefined({
        ...rest,
        // `summary` is required by the type and by v3 readers; an empty recap
        // is the honest state before one is drafted.
        ...recapFields(recap ?? ''),
        campaignId,
        date: serverTimestamp(),
      }));
    },
    [sessionsRef, campaignId],
  );

  const updateSession = React.useCallback(
    (sessionId: string, { recap, ...patch }: Partial<Omit<Session, 'id' | 'summary'>>) => {
      const ref = sessionDoc(sessionId);
      if (!ref || !campaignId) return Promise.resolve();
      return updateDocumentNonBlocking(ref, stripUndefined({
        ...patch,
        ...(recap !== undefined ? recapFields(recap) : {}),
        // The rules check campaignId on update; sessions written by early
        // versions may lack it.
        campaignId,
      }));
    },
    [sessionDoc, campaignId],
  );

  /**
   * Record the DM's decision about one mention in one issue. `confirm` affirms
   * it (or adds an entity the text never names), `ignore` drops an
   * auto-detected false hit, `null` clears both. Array ops rather than a
   * read-modify-write, so two quick toggles can't lose one another.
   */
  const setMentionOverride = React.useCallback(
    (sessionId: string, ref: MentionRef, state: 'confirm' | 'ignore' | null) => {
      const docRef = sessionDoc(sessionId);
      if (!docRef || !campaignId) return Promise.resolve();
      const value = { kind: ref.kind, id: ref.id };
      return updateDocumentNonBlocking(docRef, {
        'mentionOverrides.confirm': state === 'confirm' ? arrayUnion(value) : arrayRemove(value),
        'mentionOverrides.ignore': state === 'ignore' ? arrayUnion(value) : arrayRemove(value),
        campaignId,
      });
    },
    [sessionDoc, campaignId],
  );

  /**
   * Remove an issue. Nothing else stores a link to the document: the Loom,
   * mentions and numbering are all derived from the sessions that remain, so
   * a deleted middle issue leaves a gap and the next issue is still latest + 1.
   * Its images are the caller's job (see the issue screen), done only after
   * this succeeds so a failed delete never leaves an issue with missing art.
   */
  const deleteSession = React.useCallback(
    (sessionId: string) => {
      const ref = sessionDoc(sessionId);
      if (!ref) return Promise.resolve();
      return deleteDocumentNonBlocking(ref);
    },
    [sessionDoc],
  );

  return { createSession, updateSession, setMentionOverride, deleteSession };
}
