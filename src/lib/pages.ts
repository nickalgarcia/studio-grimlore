import type { CodexKind, MentionKind, MentionRef } from '@/lib/types';

/**
 * Pages: one template for every entity, addressed as `/page/[kind]/[id]`.
 *
 * `kind` in the URL is the storage kind (npc, party, place …), not the display
 * kind, and `id` is the Firestore id, not a name slug, because ids survive
 * renames. Display collapses kinds to PERSON / LORE / THREAD.
 */
export type PageKind = MentionKind | 'concept';

const PAGE_KINDS: readonly PageKind[] = ['npc', 'party', 'place', 'faction', 'item', 'thread', 'concept'];

export function isPageKind(v: string): v is PageKind {
  return (PAGE_KINDS as readonly string[]).includes(v);
}

export type DisplayKind = 'PERSON' | 'LORE' | 'THREAD' | 'NOTE';

export const DISPLAY_KIND: Record<PageKind, DisplayKind> = {
  npc: 'PERSON',
  party: 'PERSON',
  place: 'LORE',
  faction: 'LORE',
  item: 'LORE',
  thread: 'THREAD',
  concept: 'NOTE',
};

/**
 * Section glyphs (Hickman). Plain Unicode, and the only icon system for
 * content types: lucide is for functional icons only.
 */
export const GLYPH = {
  person: '●',
  lore: '▲',
  thread: '○',
  issue: '▬',
  rule: '■',
  note: '◆',
  copilot: '◇',
} as const;

const DISPLAY_GLYPH: Record<DisplayKind, string> = {
  PERSON: GLYPH.person,
  LORE: GLYPH.lore,
  THREAD: GLYPH.thread,
  NOTE: GLYPH.note,
};

export function glyphFor(kind: PageKind): string {
  return DISPLAY_GLYPH[DISPLAY_KIND[kind]];
}

/** Codex kinds that have a page (sessions are issues, with their own route). */
export function pageKindOf(kind: CodexKind): PageKind | null {
  return kind === 'session' ? null : kind;
}

export function pageHref(ref: { kind: PageKind; id: string } | MentionRef): string {
  return `/page/${ref.kind}/${encodeURIComponent(ref.id)}`;
}

export function issueHref(n: number): string {
  return `/issue/${n}`;
}

export function rulesHref(opts?: { anchor?: string }): string {
  return `/rules${opts?.anchor ? `#${opts.anchor}` : ''}`;
}
