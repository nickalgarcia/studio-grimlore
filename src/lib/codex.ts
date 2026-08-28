import type { CodexKind, Disposition } from '@/lib/types';

/**
 * Accent colour per Codex kind.
 *
 * npc / place / faction / item / session come from the design tokens. `party`
 * and `concept` are not in the spec — the mocks never show them — so they take
 * two unused values from the same palette rather than inventing new hues.
 */
export const KIND_ACCENT: Record<CodexKind, string> = {
  npc: '#8f2d24',
  place: '#5a5a5a',
  faction: '#8b6fd8',
  party: '#d4574c',
  item: '#c9a45c',
  session: '#3a3a3a',
  concept: '#8b847b',
};

/** Filter-chip order, which is also the index's default sort order. */
export const KIND_ORDER: CodexKind[] = [
  'npc', 'place', 'faction', 'party', 'item', 'session', 'concept',
];

export const KIND_LABEL: Record<CodexKind, string> = {
  npc: 'NPC',
  place: 'Place',
  faction: 'Faction',
  party: 'Party',
  item: 'Item',
  session: 'Session',
  concept: 'Concept',
};

export const KIND_LABEL_PLURAL: Record<CodexKind, string> = {
  npc: 'NPCs',
  place: 'Places',
  faction: 'Factions',
  party: 'Party',
  item: 'Items',
  session: 'Sessions',
  concept: 'Concepts',
};

export type CodexFilter = CodexKind | 'All';

/**
 * The design shows a three-state pill, while storage uses the five-point
 * `Disposition` scale shared with factions. Collapsing happens here so the
 * mapping lives in exactly one place.
 */
export type DispositionTone = 'hostile' | 'ally' | 'unknown';

export function dispositionTone(d: Disposition | undefined): DispositionTone {
  if (d === 'Hostile' || d === 'Unfriendly') return 'hostile';
  if (d === 'Friendly' || d === 'Allied') return 'ally';
  return 'unknown';
}

/** Session refs render as `S14`. Returns undefined rather than `S` when unset. */
export function sessionRef(n: number | undefined): string | undefined {
  return typeof n === 'number' ? `S${n}` : undefined;
}

/** First meaningful line of a free-text field, trimmed for a table cell. */
export function snippet(text: string | undefined, max = 60): string | undefined {
  if (!text) return undefined;
  const line = text.split('\n').map(s => s.trim()).find(Boolean);
  if (!line) return undefined;
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/**
 * Firestore subcollection per kind, under
 * `users/{uid}/campaigns/{campaignId}/`.
 *
 * `concept` is absent on purpose: concepts live at `users/{uid}/concepts` and
 * are not campaign subcollection documents, so they are handled separately
 * wherever they are written.
 */
export const KIND_COLLECTION: Partial<Record<CodexKind, string>> = {
  npc: 'npcs',
  place: 'locations',
  faction: 'factions',
  party: 'characters',
  session: 'sessions',
};

/** Kinds the shared entry dialog can create or edit. */
export const EDITABLE_KINDS: CodexKind[] = ['npc', 'place', 'faction', 'party', 'session'];

/** Kinds that can be created from scratch (a session is created by logging one). */
export const CREATABLE_KINDS: CodexKind[] = ['npc', 'place', 'faction', 'party'];

/**
 * Whether a saved concept should appear in a given campaign's Codex.
 *
 * Concepts live in a single global collection and are tied to a campaign only
 * by a free-text `context`. The Inspiration generator saves without one, and
 * the old global Library tab was the only place those ever showed up — with
 * that tab gone, context-less concepts would be orphaned, so they surface in
 * every campaign rather than nowhere.
 */
export function conceptInCampaign(
  context: string | undefined,
  campaignName: string,
): boolean {
  return !context || context === campaignName;
}
