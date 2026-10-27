import type {
  Character, Faction, Location, MentionKind, MentionRef, Npc, Session, Thread,
} from '@/lib/types';
import { recapOf } from '@/lib/issues';

/**
 * The mentions index: which entities each issue mentions, and its inverse,
 * which issues each entity appears in. The Loom, "In this issue", "Mentioned
 * in", the tick strip and FIRST / LAST SEEN are all read off this.
 *
 * It is derived at read time and never stored. The app already holds every
 * session and entity in memory, and a stored index would go stale the moment
 * the DM added an NPC that an old recap already names. Only the DM's
 * confirm / ignore decisions are stored (`Session.mentionOverrides`).
 *
 * Everything here is a pure function so it can be unit-tested (review H7).
 */

/** Something a recap can mention, with every name it goes by. */
export type MentionTarget = { ref: MentionRef; name: string; aliases?: string[] };

/**
 * How a ref got into an issue's index. `link` is an explicit `[[Name]]` (solid
 * spot underline), `detected` an unbracketed exact name (dotted underline),
 * `confirmed` added by the DM.
 */
export type MentionVia = 'link' | 'detected' | 'confirmed';

export type MentionHit = {
  start: number;
  end: number;
  /** What to display: a link's `|label` if it has one, otherwise the matched text. */
  text: string;
  ref: MentionRef;
  via: 'link' | 'detected';
};

/** A `[[Name]]` that names nothing known. Rendered plainly; a candidate for "+ new page". */
export type UnresolvedLink = { start: number; end: number; name: string; text: string };

export type ScanResult = { hits: MentionHit[]; unresolved: UnresolvedLink[] };

/**
 * Names shorter than this are never auto-detected (links still resolve).
 * Three, not four: party names like "Odo" are three letters, and the design's
 * own capture example links one.
 */
export const MIN_DETECT_LENGTH = 3;

/**
 * When two entities share a name, a `[[link]]` goes to the first kind in this
 * order. Auto-detection skips shared names entirely: a guess there would put
 * an issue on the wrong lane with nothing to show it was a guess.
 */
export const KIND_PRIORITY: MentionKind[] =['npc', 'party', 'faction', 'place', 'item', 'thread'];

export function refKey(ref: MentionRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function sameRef(a: MentionRef, b: MentionRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

// `[[Target]]`, `[[Target|label]]`, `[[Target#heading]]` — the Obsidian forms,
// since sessions arrive through the Obsidian import. No nesting, no newlines.
const LINK_RE = /\[\[([^[\]\n]+?)\]\]/g;

function parseLinkBody(body: string): { name: string; label?: string } {
  const [target, label] = body.split('|', 2);
  const name = target.split('#', 1)[0].trim();
  const trimmed = label?.trim();
  return trimmed ? { name, label: trimmed } : { name };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "Whole word" for names that may contain spaces or apostrophes: the match
// must not be glued to a letter, digit or underscore on either side. Unicode
// aware so "Æthelric" and "Mírë" work. Apostrophes are boundaries, so
// "Verrin's" still finds "Verrin".
const NOT_WORD_BEFORE = '(?<![\\p{L}\\p{N}_])';
const NOT_WORD_AFTER = '(?![\\p{L}\\p{N}_])';

function buildDetector(names: string[], ignoreCase: boolean): RegExp | null {
  if (names.length === 0) return null;
  // Longest first, so "Lady Sabeth Verrin" wins over "Verrin" at the same spot.
  const alternation = [...names]
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
    .join('|');
  return new RegExp(`${NOT_WORD_BEFORE}(?:${alternation})${NOT_WORD_AFTER}`, ignoreCase ? 'giu' : 'gu');
}

export type Matcher = {
  /** Resolve a link target: exact name or alias first, then case-insensitive. */
  resolveLink(name: string): MentionRef | null;
  /**
   * Find every link and detected name in `text`.
   *
   * Recaps are scanned case-sensitively, so "the reliquary" in a sentence
   * doesn't count as the Reliquary. Captures are typed fast at the table
   * ("+ odo took the key"), so the command bar scans with `ignoreCase`.
   */
  scan(text: string, opts?: { ignoreCase?: boolean }): ScanResult;
  /** The canonical name for a ref, for labels like "LINKED ODO". */
  nameOf(ref: MentionRef): string | undefined;
};

/**
 * Build once per entity set (memoize on the entity arrays) and reuse for every
 * session: the detector regex is the only non-trivial cost.
 */
export function createMatcher(targets: MentionTarget[]): Matcher {
  const ordered = [...targets].sort(
    (a, b) => KIND_PRIORITY.indexOf(a.ref.kind) - KIND_PRIORITY.indexOf(b.ref.kind),
  );

  const names = new Map<string, string>(); // refKey → canonical name
  const linkExact = new Map<string, MentionRef>();
  const linkLower = new Map<string, MentionRef>();
  // Detection maps go to `null` once a second entity claims the same name.
  const detectExact = new Map<string, MentionRef | null>();
  const detectLower = new Map<string, MentionRef | null>();

  const claim = (map: Map<string, MentionRef | null>, key: string, ref: MentionRef) => {
    const prev = map.get(key);
    if (prev === undefined) map.set(key, ref);
    else if (prev && !sameRef(prev, ref)) map.set(key, null);
  };

  for (const t of ordered) {
    names.set(refKey(t.ref), t.name);
    const all = [t.name, ...(t.aliases ?? [])].map(n => n.trim()).filter(Boolean);
    for (const n of all) {
      // First claimant wins for links, and `ordered` puts kinds in priority order.
      if (!linkExact.has(n)) linkExact.set(n, t.ref);
      if (!linkLower.has(n.toLowerCase())) linkLower.set(n.toLowerCase(), t.ref);
      if (n.length < MIN_DETECT_LENGTH) continue;
      claim(detectExact, n, t.ref);
      claim(detectLower, n.toLowerCase(), t.ref);
    }
  }

  const unambiguous = (map: Map<string, MentionRef | null>) =>
    [...map].filter(([, ref]) => ref !== null).map(([n]) => n);

  const detector = buildDetector(unambiguous(detectExact), false);
  let detectorCi: RegExp | null | undefined; // built on first ignoreCase scan

  const resolveLink = (name: string) =>
    linkExact.get(name) ?? linkLower.get(name.toLowerCase()) ?? null;

  const scan = (text: string, opts?: { ignoreCase?: boolean }): ScanResult => {
    const hits: MentionHit[] = [];
    const unresolved: UnresolvedLink[] = [];
    const linkSpans: [number, number][] = [];

    for (const m of text.matchAll(LINK_RE)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      linkSpans.push([start, end]);
      const { name, label } = parseLinkBody(m[1]);
      const ref = name ? resolveLink(name) : null;
      if (ref) hits.push({ start, end, text: label ?? name, ref, via: 'link' });
      else unresolved.push({ start, end, name, text: label ?? name });
    }

    const ignoreCase = !!opts?.ignoreCase;
    if (ignoreCase && detectorCi === undefined) {
      detectorCi = buildDetector(unambiguous(detectLower), true);
    }
    const re = ignoreCase ? detectorCi : detector;
    if (re) {
      for (const m of text.matchAll(re)) {
        const start = m.index ?? 0;
        const end = start + m[0].length;
        // Text inside a [[link]] belongs to the link.
        if (linkSpans.some(([s, e]) => start < e && end > s)) continue;
        const ref = ignoreCase ? detectLower.get(m[0].toLowerCase()) : detectExact.get(m[0]);
        if (ref) hits.push({ start, end, text: m[0], ref, via: 'detected' });
      }
    }

    hits.sort((a, b) => a.start - b.start);
    return { hits, unresolved };
  };

  return { resolveLink, scan, nameOf: ref => names.get(refKey(ref)) };
}

/** Every mentionable entity in a campaign, as matcher targets. */
export function mentionTargets(entities: {
  npcs?: readonly Npc[] | null;
  characters?: readonly Character[] | null;
  locations?: readonly Location[] | null;
  factions?: readonly Faction[] | null;
  threads?: readonly Thread[] | null;
}): MentionTarget[] {
  const out: MentionTarget[] = [];
  for (const n of entities.npcs ?? []) out.push({ ref: { kind: 'npc', id: n.id }, name: n.name, aliases: n.aliases });
  // PCs carry no aliases field; they're named consistently at the table.
  for (const c of entities.characters ?? []) out.push({ ref: { kind: 'party', id: c.id }, name: c.name });
  for (const l of entities.locations ?? []) out.push({ ref: { kind: 'place', id: l.id }, name: l.name, aliases: l.aliases });
  for (const f of entities.factions ?? []) out.push({ ref: { kind: 'faction', id: f.id }, name: f.name, aliases: f.aliases });
  for (const t of entities.threads ?? []) out.push({ ref: { kind: 'thread', id: t.id }, name: t.title, aliases: t.aliases });
  return out.filter(t => t.name?.trim());
}

/** What one issue mentions, in first-appearance order. */
export type IssueMentions = {
  refs: MentionRef[];
  via: Map<string, MentionVia>;
};

/** The text an issue is indexed from: everything the DM wrote about it. */
function issueText(s: Pick<Session, 'title' | 'logline' | 'recap' | 'summary'>): string {
  return [s.title, s.logline, recapOf(s)].filter(Boolean).join('\n\n');
}

export function indexIssue(
  session: Pick<Session, 'title' | 'logline' | 'recap' | 'summary' | 'mentionOverrides'>,
  matcher: Matcher,
): IssueMentions {
  const ignore = new Set((session.mentionOverrides?.ignore ?? []).map(refKey));
  const refs: MentionRef[] = [];
  const via = new Map<string, MentionVia>();

  for (const hit of matcher.scan(issueText(session)).hits) {
    const key = refKey(hit.ref);
    if (hit.via === 'detected' && ignore.has(key)) continue;
    const prev = via.get(key);
    if (!prev) refs.push(hit.ref);
    // A link anywhere in the issue outranks a detection elsewhere in it.
    if (!prev || (prev === 'detected' && hit.via === 'link')) via.set(key, hit.via);
  }

  for (const ref of session.mentionOverrides?.confirm ?? []) {
    const key = refKey(ref);
    if (!via.has(key)) refs.push(ref);
    // Confirming a detected name promotes it; a link stays a link.
    if (via.get(key) !== 'link') via.set(key, 'confirmed');
  }

  return { refs, via };
}

export type CampaignMentions = {
  /** sessionNumber → what that issue mentions. */
  byIssue: Map<number, IssueMentions>;
  /** refKey → issue numbers it appears in, ascending. The Loom lanes' `sessions[]`. */
  appearances: Map<string, number[]>;
};

export function indexCampaign(
  sessions: readonly Pick<Session, 'sessionNumber' | 'title' | 'logline' | 'recap' | 'summary' | 'mentionOverrides'>[],
  matcher: Matcher,
): CampaignMentions {
  const byIssue = new Map<number, IssueMentions>();
  const appearances = new Map<string, number[]>();

  const ordered = [...sessions].sort((a, b) => a.sessionNumber - b.sessionNumber);
  for (const s of ordered) {
    const idx = indexIssue(s, matcher);
    byIssue.set(s.sessionNumber, idx);
    for (const ref of idx.refs) {
      const key = refKey(ref);
      const list = appearances.get(key);
      if (!list) appearances.set(key, [s.sessionNumber]);
      // Ascending input and one entry per issue, so no sort or dedupe pass is needed,
      // unless two documents share a session number.
      else if (list[list.length - 1] !== s.sessionNumber) list.push(s.sessionNumber);
    }
  }

  return { byIssue, appearances };
}

/**
 * Names a capture will link, for "WILL LINK → VERRIN · ODO". Canonical names,
 * deduplicated, in the order they appear in the note.
 */
export function captureLinks(text: string, matcher: Matcher): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const hit of matcher.scan(text, { ignoreCase: true }).hits) {
    const key = refKey(hit.ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(matcher.nameOf(hit.ref) ?? hit.text);
  }
  return out;
}
