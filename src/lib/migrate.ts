import { collection, doc, getDocs, writeBatch, type Firestore } from 'firebase/firestore';
import type { Campaign, Session } from '@/lib/types';
import { firstSentence } from '@/lib/issues';

/**
 * One-off data migrations, run in the browser as the signed-in owner.
 *
 * Client-side on purpose: the Firestore rules already let the owner write
 * their own documents, so this needs no service account, and it can show a
 * dry run before anything is written. Each step only fills fields that are
 * missing, so running it twice is harmless; `Campaign.schemaVersion` records
 * that it has run so the menu item goes away.
 *
 * v1 → v2 (Director's Cut):
 *   - `recap` ← `summary`, for sessions with no recap
 *   - `logline` ← first sentence of the recap, for sessions with no logline
 *   - `title` is left alone. v3 never had one, and "Issue #14" is a better
 *     placeholder than a made-up title; the co-pilot can draft titles later.
 *   - `mentions` is not backfilled: the index is derived at read time.
 * Nothing is deleted. `summary` stays, because v3 screens still read it.
 */
export const CURRENT_SCHEMA = 2;

export function needsMigration(c: Pick<Campaign, 'schemaVersion'> | null | undefined): boolean {
  return !!c && (c.schemaVersion ?? 1) < CURRENT_SCHEMA;
}

export type SessionPatch = {
  id: string;
  sessionNumber: number;
  set: Partial<Pick<Session, 'recap' | 'logline'>>;
};

export type MigrationPlan = {
  campaignId: string;
  from: number;
  to: number;
  sessionCount: number;
  patches: SessionPatch[];
};

export async function planMigration(
  firestore: Firestore,
  uid: string,
  campaign: Pick<Campaign, 'id' | 'schemaVersion'>,
): Promise<MigrationPlan> {
  const snap = await getDocs(collection(firestore, 'users', uid, 'campaigns', campaign.id, 'sessions'));
  const patches: SessionPatch[] = [];

  for (const d of snap.docs) {
    const s = d.data() as Partial<Session>;
    const set: SessionPatch['set'] = {};
    const text = s.recap ?? s.summary ?? '';

    if (s.recap === undefined && typeof s.summary === 'string') set.recap = s.summary;
    if (!s.logline?.trim() && text.trim()) {
      const line = firstSentence(text);
      if (line) set.logline = line;
    }

    if (Object.keys(set).length) {
      patches.push({ id: d.id, sessionNumber: s.sessionNumber ?? 0, set });
    }
  }

  patches.sort((a, b) => a.sessionNumber - b.sessionNumber);
  return {
    campaignId: campaign.id,
    from: campaign.schemaVersion ?? 1,
    to: CURRENT_SCHEMA,
    sessionCount: snap.size,
    patches,
  };
}

/** A batch holds 500 writes; stay under it with room for the campaign doc. */
const BATCH_LIMIT = 450;

/**
 * Writes the plan, then stamps the campaign. The stamp goes in the last batch,
 * so a failure part-way leaves the campaign unstamped and the menu item still
 * there; re-running re-plans and skips whatever already landed.
 */
export async function applyMigration(firestore: Firestore, uid: string, plan: MigrationPlan): Promise<void> {
  const base = ['users', uid, 'campaigns', plan.campaignId] as const;
  const chunks: SessionPatch[][] = [];
  for (let i = 0; i < plan.patches.length; i += BATCH_LIMIT) {
    chunks.push(plan.patches.slice(i, i + BATCH_LIMIT));
  }
  if (chunks.length === 0) chunks.push([]);

  for (let i = 0; i < chunks.length; i++) {
    const batch = writeBatch(firestore);
    for (const p of chunks[i]) {
      // campaignId is rewritten because the sessions rule checks it on
      // update, and sessions saved by early versions may lack it.
      batch.update(doc(firestore, ...base, 'sessions', p.id), { ...p.set, campaignId: plan.campaignId });
    }
    if (i === chunks.length - 1) {
      batch.update(doc(firestore, ...base), { schemaVersion: plan.to });
    }
    await batch.commit();
  }
}
