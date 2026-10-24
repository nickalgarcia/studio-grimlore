import type {
  Character, Disposition, Faction, HistoryEntry, Location, MentionRef, Npc, SavedConcept, Session, Thread,
} from '@/lib/types';
import type { PageKind } from '@/lib/pages';
import { plainLinks, recapOf } from '@/lib/issues';
import { refKey, sameRef, type CampaignMentions, type Matcher } from '@/lib/mentions';

/**
 * One shape for every Page, whatever the entity. The template renders this;
 * the per-kind decisions (which field is the "now" section, what the history
 * list is called) all live here.
 */

export type Tone = 'spot' | 'sand' | 'mute';
export type PageTag = { text: string; tone: Tone };
export type PageFact = { key: string; value: string };
export type PageSection = {
  label: string;
  text: string;
  /** The section about the present: labelled in spot. */
  now?: boolean;
};

export type PageModel = {
  name: string;
  lede?: string;
  tags: PageTag[];
  sections: PageSection[];
  secret?: string;
  /** Stored rows (co-pilot draftable). Absent means the template derives rows from mentions. */
  history?: HistoryEntry[];
  historyLabel: string;
  facts: PageFact[];
  image?: { url?: string; field: 'portraitUrl' | 'imageUrl'; label: string };
  /** Nothing written yet: shows the STUB PAGE box. */
  isStub: boolean;
  /** The co-pilot can draft this kind from the recaps. PCs belong to their players, so no. */
  draftable: boolean;
};

export function dispositionTone(d: Disposition | undefined): Tone {
  if (d === 'Hostile') return 'spot';
  if (d === 'Unfriendly') return 'sand';
  return 'mute';
}

/**
 * Split long free text into a short lede and the rest. The lede is the first
 * paragraph if it's short, otherwise its first sentence; nothing is repeated.
 */
export function splitLede(text: string | undefined, max = 280): { lede?: string; rest?: string } {
  const t = text?.trim();
  if (!t) return {};
  const paragraphs = t.split(/\n\s*\n/);
  const first = paragraphs[0].trim();
  const others = paragraphs.slice(1).join('\n\n').trim();
  if (first.length <= max) return { lede: first, rest: others || undefined };

  const end = first.search(/[.!?](\s|$)/);
  if (end === -1 || end + 1 > max) return { rest: t };
  const rest = [first.slice(end + 1).trim(), others].filter(Boolean).join('\n\n');
  return { lede: first.slice(0, end + 1), rest: rest || undefined };
}

const tag = (text: string | undefined, tone: Tone = 'mute'): PageTag[] => (text ? [{ text: text.toUpperCase(), tone }] : []);
const fact = (key: string, value: string | number | undefined | null): PageFact[] =>
  value === undefined || value === null || value === '' ? [] : [{ key, value: String(value) }];
const section = (label: string, text: string | undefined, now = false): PageSection[] =>
  text?.trim() ? [{ label, text: text.trim(), ...(now ? { now } : {}) }] : [];

const THREAD_TONE = { live: 'spot', seeded: 'sand', cold: 'mute' } as const;

export function buildPageModel(kind: PageKind, source: unknown): PageModel {
  let m: Omit<PageModel, 'isStub'>;

  switch (kind) {
    case 'npc': {
      const n = source as Npc;
      const { lede, rest } = splitLede(n.description);
      m = {
        name: n.name,
        lede,
        tags: [
          ...(n.importance === 'Key' ? tag('Key NPC') : []),
          ...tag(n.factionName),
          ...tag(n.disposition, dispositionTone(n.disposition)),
          ...(n.status && n.status !== 'Active' ? tag(n.status, n.status === 'Dead' ? 'spot' : 'mute') : []),
        ],
        sections: [...section('Wants · now', n.wants, true), ...section('Knows', n.knows), ...section('Who they are', rest)],
        secret: n.secret?.trim() || undefined,
        history: n.history?.length ? n.history : undefined,
        historyLabel: 'With the party',
        facts: [...fact('Location', n.location), ...fact('Faction', n.factionName), ...fact('Status', n.status)],
        image: { url: n.portraitUrl, field: 'portraitUrl', label: 'Portrait' },
        draftable: true,
      };
      break;
    }
    case 'party': {
      const c = source as Character;
      const { lede, rest } = splitLede(c.backstory);
      const hp = c.currentHp !== undefined && c.maxHp !== undefined ? `${c.currentHp} / ${c.maxHp}` : undefined;
      m = {
        name: c.name,
        lede,
        tags: [...tag('Party'), ...tag(c.class), ...tag(c.species)],
        sections: [...section('Backstory', rest), ...section("How they've changed", c.developmentLog, true)],
        historyLabel: 'With the party',
        facts: [
          ...fact('Class', c.class), ...fact('Species', c.species), ...fact('Origin', c.originCity),
          ...fact('HP', hp), ...fact('AC', c.armorClass), ...fact('Speed', c.speed),
          ...fact('Passive perception', c.passivePerception),
          ...fact('Passive investigation', c.passiveInvestigation),
          ...fact('Passive insight', c.passiveInsight),
        ],
        image: { url: c.portraitUrl, field: 'portraitUrl', label: 'Portrait' },
        draftable: false,
      };
      break;
    }
    case 'place': {
      const l = source as Location;
      const { lede, rest } = splitLede(l.description);
      m = {
        name: l.name,
        lede,
        tags: tag('Place'),
        sections: section("What's known", rest),
        historyLabel: "How it's unfolded",
        facts: [],
        image: { url: l.imageUrl, field: 'imageUrl', label: 'Image' },
        draftable: true,
      };
      break;
    }
    case 'faction': {
      const f = source as Faction;
      const { lede, rest } = splitLede(f.description);
      m = {
        name: f.name,
        lede,
        tags: [...tag('Faction'), ...tag(f.disposition, dispositionTone(f.disposition))],
        sections: [
          ...section('Agenda · now', f.currentAgenda, true),
          ...section('Where it is', f.homeBase),
          ...section('What they know', f.whatTheyKnow),
          ...section("What's known", rest),
        ],
        historyLabel: "How it's unfolded",
        facts: [...fact('Leader', f.leader), ...fact('Home base', f.homeBase), ...fact('Disposition', f.disposition)],
        image: { url: f.imageUrl, field: 'imageUrl', label: 'Image' },
        draftable: true,
      };
      break;
    }
    case 'thread': {
      const t = source as Thread;
      m = {
        name: t.title,
        lede: t.note?.trim() || undefined,
        tags: [
          ...tag(t.tag),
          ...tag(t.status, THREAD_TONE[t.status] ?? 'mute'),
          ...(t.pullNext ? tag('Pulling next', 'spot') : []),
        ],
        sections: [
          ...section('Where it stands', t.body?.whereItStands, true),
          ...section('What each side offers', t.body?.whatEachSideOffers),
        ],
        secret: t.secret?.trim() || undefined,
        history: t.history?.length ? t.history : undefined,
        historyLabel: "How it's unfolded",
        facts: [...fact('Tag', t.tag), ...fact('Status', t.status?.toUpperCase())],
        draftable: true,
      };
      break;
    }
    default: {
      const c = source as SavedConcept;
      m = {
        name: c.content?.split('\n')[0]?.slice(0, 80) || c.type,
        lede: undefined,
        tags: tag(c.type),
        sections: section('Note', c.content),
        historyLabel: 'Mentioned',
        facts: [...fact('Type', c.type), ...fact('Context', c.context)],
        draftable: false,
      };
    }
  }

  return { ...m, isStub: !m.lede && m.sections.length === 0 && !m.secret };
}

/**
 * What the recaps say about one entity: each issue's paragraphs that mention
 * it, links flattened to plain names. Newest issues win when there are more
 * than `limit`; returned oldest first, which is how the draft prompt reads them.
 */
export function excerptsFor(
  ref: MentionRef,
  issues: readonly Pick<Session, 'sessionNumber' | 'recap' | 'summary'>[],
  appearances: readonly number[],
  matcher: Matcher,
  { limit = 12, maxChars = 2_400 } = {},
): { session: number; text: string }[] {
  const wanted = new Set(appearances.slice(-limit));
  const out: { session: number; text: string }[] = [];
  for (const s of issues) {
    if (!wanted.has(s.sessionNumber)) continue;
    const paragraphs = recapOf(s).split(/\n\s*\n/)
      .filter(p => matcher.scan(p).hits.some(h => sameRef(h.ref, ref)));
    // Confirmed-only mentions have no matching paragraph; the whole recap,
    // trimmed, is the best evidence there is.
    const text = plainLinks((paragraphs.length ? paragraphs.join('\n\n') : recapOf(s)).trim());
    if (text) out.push({ session: s.sessionNumber, text: text.slice(0, maxChars) });
  }
  return out.sort((a, b) => a.session - b.session);
}

/** The entities that share the most issues with this one: the Page's related links. */
export function relatedRefs(ref: MentionRef, mentions: CampaignMentions, limit = 3): MentionRef[] {
  const key = refKey(ref);
  const counts = new Map<string, { ref: MentionRef; n: number }>();
  for (const idx of mentions.byIssue.values()) {
    if (!idx.via.has(key)) continue;
    for (const other of idx.refs) {
      const k = refKey(other);
      if (k === key) continue;
      const entry = counts.get(k) ?? { ref: other, n: 0 };
      entry.n += 1;
      counts.set(k, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, limit).map(e => e.ref);
}
