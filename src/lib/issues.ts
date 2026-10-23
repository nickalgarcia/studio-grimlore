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
