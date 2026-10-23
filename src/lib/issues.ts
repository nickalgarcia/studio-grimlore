import type { Session } from '@/lib/types';

/**
 * Reading a session as an issue.
 *
 * Every screen goes through these instead of touching `summary` / `recap`
 * directly, so the transition from v3's `summary` to `recap` lives in one place.
 */

/** The recap text. `recap` wins; `summary` covers sessions the migration hasn't reached. */
export function recapOf(s: Pick<Session, 'recap' | 'summary'>): string {
  return s.recap ?? s.summary ?? '';
}

/** "Issue #14". A display label over `sessionNumber`, never stored. */
export function issueLabel(n: number): string {
  return `Issue #${n}`;
}

/**
 * The title to show. Sessions migrated from v3 have none, and an honest
 * "Issue #14" reads better under a cover than an invented one.
 */
export function issueTitle(s: Pick<Session, 'title' | 'sessionNumber'>): string {
  return s.title?.trim() || issueLabel(s.sessionNumber);
}

/**
 * First sentence of a markdown recap, used to backfill `logline`.
 *
 * v3 recaps are model output and often open with a heading ("## Session 14")
 * or a bullet, so those lines are skipped and inline markup is dropped before
 * looking for the sentence end. `[[Name|label]]` becomes its label.
 */
export function firstSentence(markdown: string, max = 200): string {
  const line = markdown
    .split('\n')
    .map(l => l.trim())
    .find(l => l && !/^#{1,6}\s/.test(l) && !/^(-{3,}|\*{3,}|_{3,})$/.test(l));
  if (!line) return '';

  const plain = line
    .replace(/^([-*+]|\d+\.)\s+/, '')
    .replace(/^>\s*/, '')
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, name: string, label?: string) => label ?? name)
    .replace(/\*\*|__|[*_`]/g, '')
    .trim();

  // A sentence ends at . ! or ? followed by a space or the end of the line.
  // "St. Aldwyn" will cut short; acceptable for a backfill the DM can edit.
  const end = plain.search(/[.!?](\s|$)/);
  const sentence = end === -1 ? plain : plain.slice(0, end + 1);
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

/**
 * A session's date as a Date. `date` is written with `serverTimestamp()`, so
 * it reads back as a Firestore Timestamp, or `null` while that write is
 * pending; older imports may hold an ISO string.
 */
export function sessionDate(s: Pick<Session, 'date'>): Date | null {
  const d = s.date as unknown;
  if (!d) return null;
  if (typeof d === 'string') {
    const t = Date.parse(d);
    return Number.isNaN(t) ? null : new Date(t);
  }
  if (typeof (d as { toDate?: unknown }).toDate === 'function') return (d as { toDate: () => Date }).toDate();
  return null;
}

/** "3 DAYS AGO", for the mono labels on Story and Issue. */
export function agoLabel(date: Date | null, now = Date.now()): string | null {
  if (!date) return null;
  const days = Math.floor((now - date.getTime()) / 86_400_000);
  if (days <= 0) return 'TODAY';
  if (days === 1) return 'YESTERDAY';
  if (days < 14) return `${days} DAYS AGO`;
  if (days < 60) return `${Math.floor(days / 7)} WEEKS AGO`;
  return `${Math.floor(days / 30)} MONTHS AGO`;
}

/** "SAT 25 OCT", for the next issue's scheduled date. */
export function shortDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t)
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(',', '')
    .toUpperCase();
}

/**
 * `[[Name|label]]` → `label`, `[[Name]]` → `Name`. A stand-in until the Issue
 * reader renders links as links (Stage 5), so raw brackets never show.
 */
export function plainLinks(markdown: string): string {
  return markdown.replace(/\[\[([^[\]\n|#]+)(?:#[^[\]\n|]*)?(?:\|([^[\]\n]+))?\]\]/g,
    (_, name: string, label?: string) => (label ?? name).trim());
}
