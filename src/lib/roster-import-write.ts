import {
  arrayUnion, collection, doc, serverTimestamp, writeBatch, type Firestore,
} from 'firebase/firestore';
import type { ImportKind, ImportRow } from '@/lib/roster-import';

/**
 * Firestore side of the roster import. Kept out of `roster-import.ts` so the
 * parsing rules there stay free of Firebase and testable on their own.
 *
 * Runs in the browser as the signed-in owner, like `migrate.ts`: the rules
 * already let the owner write their own campaign, so no service account.
 */

const COLLECTION: Record<ImportKind, string> = {
  npc: 'npcs',
  place: 'locations',
  faction: 'factions',
};

/** A batch holds 500 writes; same headroom `migrate.ts` keeps. */
const BATCH_LIMIT = 450;

/**
 * The document for a new entity. Defaults mirror what the edit dialog writes
 * when its selects are left alone (`codex-entry-dialog.tsx`): NPCs start
 * Active and Minor, factions Neutral with a `createdAt`.
 *
 * `campaignId` is always present: the locations rule checks it on create.
 * `description` is written as '' when absent because the type marks it
 * required and the Codex renders it directly.
 */
export function newDocument(kind: ImportKind, campaignId: string, fields: ImportRow['fields']): Record<string, unknown> {
  const base: Record<string, unknown> = { description: '', ...fields, campaignId };
  if (kind === 'npc') {
    base.status ??= 'Active';
    base.importance ??= 'Minor';
  }
  if (kind === 'faction') {
    base.disposition ??= 'Neutral';
    base.createdAt = serverTimestamp();
  }
  return base;
}

export type ImportResult = { created: number; updated: number };

/**
 * Writes the chosen rows: `new` rows become documents, `existing` rows only
 * gain their missing aliases (`arrayUnion`, so concurrent edits and re-runs
 * can't duplicate them). Nothing else on an existing document is touched.
 *
 * Batches commit in order and are not atomic as a whole. If one fails part
 * way, the rows already written show up as "already here" on a re-run, so
 * running it again finishes the job without duplicates.
 */
export async function applyImport(
  firestore: Firestore,
  uid: string,
  campaignId: string,
  kind: ImportKind,
  rows: readonly ImportRow[],
): Promise<ImportResult> {
  const coll = collection(firestore, 'users', uid, 'campaigns', campaignId, COLLECTION[kind]);
  const writes = rows.filter(r =>
    r.action.type === 'new' || (r.action.type === 'existing' && r.action.newAliases.length > 0));

  let created = 0, updated = 0;
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(firestore);
    let c = 0, u = 0;
    for (const r of writes.slice(i, i + BATCH_LIMIT)) {
      if (r.action.type === 'new') {
        batch.set(doc(coll), newDocument(kind, campaignId, r.fields));
        c++;
      } else if (r.action.type === 'existing') {
        // campaignId rides along because the locations rule checks it on
        // update and older documents may lack it (see use-entity-writer.ts).
        batch.update(doc(coll, r.action.id), {
          aliases: arrayUnion(...r.action.newAliases),
          campaignId,
        });
        u++;
      }
    }
    await batch.commit();
    created += c;
    updated += u;
  }
  return { created, updated };
}
