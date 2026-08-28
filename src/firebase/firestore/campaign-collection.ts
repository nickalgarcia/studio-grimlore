'use client';

import { collection, doc, type CollectionReference, type DocumentReference } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useUser } from '@/firebase/provider';

/**
 * Shared ref builders for the per-user campaign subcollections.
 *
 * Imports point at `@/firebase/provider` rather than the `@/firebase` barrel:
 * the barrel re-exports this directory, so going through it would make the
 * module graph circular.
 */
export function useCampaignCollectionRef(
  campaignId: string | null | undefined,
  name: string,
): CollectionReference | null {
  const { user } = useUser();
  const firestore = useFirestore();
  return useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaignId, name);
  }, [user, firestore, campaignId, name]) as CollectionReference | null;
}

export function useCampaignDocRef(
  campaignId: string | null | undefined,
  name: string,
  docId: string | null | undefined,
): DocumentReference | null {
  const { user } = useUser();
  const firestore = useFirestore();
  return useMemoFirebase(() => {
    if (!user || !campaignId || !docId) return null;
    return doc(firestore, 'users', user.uid, 'campaigns', campaignId, name, docId);
  }, [user, firestore, campaignId, name, docId]) as DocumentReference | null;
}

/**
 * `createdAt` is written as a client ISO string, not `serverTimestamp()`.
 *
 * Scenes are ordered by `createdAt` and the newest one *is* the current scene,
 * so ordering has to be correct the instant a document is created. A pending
 * server timestamp reads back as `null` in the local snapshot until the server
 * resolves it, and null sorts last under `desc` — a scene you just created
 * would briefly not be the current one. A client timestamp is stable on write.
 * `updatedAt` is not ordered on, so it keeps using `serverTimestamp()`.
 */
export function clientCreatedAt(): string {
  return new Date().toISOString();
}

/**
 * Drop keys whose value is `undefined`.
 *
 * The Firestore client is not configured with `ignoreUndefinedProperties`, so
 * an explicit `undefined` field value throws rather than being skipped. Callers
 * naturally produce them (`sessionNumber: latest || undefined`), so writes are
 * cleaned here instead of at every call site.
 */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}
