import { FieldValue } from "firebase/firestore";

export type SavedConcept = {
  id: string;
  userId: string;
  type: 'Plot Hook' | 'Encounter Idea' | 'NPC Concept' | 'Inspiration' | 'Dialog';
  content: string;
  context?: string;
  createdAt: string | FieldValue;
};

export type Campaign = {
  id: string;
  name: string;
  description: string;
  createdAt: FieldValue | string;
  aiSummary?: string;
};

export type Character = {
  id: string;
  campaignId: string;
  name: string;
  species?: string;
  class?: string;
  originCity?: string;
  backstory: string;
  developmentLog?: string;
  armorClass?: number;
  speed?: number;
  passivePerception?: number;
  passiveInvestigation?: number;
  passiveInsight?: number;
  // Hit points. Optional because every character saved before this existed has
  // none — the party dock renders the stat row without an HP bar when either
  // side of the pair is missing rather than inventing a denominator.
  currentHp?: number;
  maxHp?: number;
};

export type NpcStatus = 'Active' | 'Inactive' | 'Dead' | 'Unknown';
export type NpcImportance = 'Key' | 'Minor';

/**
 * One disposition scale for every entity that can have an attitude toward the
 * party. Factions already used this vocabulary, so NPCs adopt it rather than
 * introducing a second, coarser one — a single scale means a single pill
 * colour map and one thing to learn.
 *
 * UI collapses it to three buckets for the scene pill: Hostile/Unfriendly →
 * hostile, Friendly/Allied → ally, Neutral or absent → unknown.
 */
export type Disposition =
  | 'Hostile'
  | 'Unfriendly'
  | 'Neutral'
  | 'Friendly'
  | 'Allied';

/** @deprecated Use `Disposition`. Kept so faction code compiles unchanged. */
export type FactionDisposition = Disposition;

export type Npc = {
  id: string;
  campaignId: string;
  name: string;
  description: string;
  location?: string;
  status?: NpcStatus;
  importance?: NpcImportance;
  factionId?: string;   // references a Faction id
  factionName?: string; // denormalized for display without extra fetch
  /** Attitude toward the party. Was previously buried in free-text `description`. */
  disposition?: Disposition;
  /**
   * Scene-scoped, unlike the permanent `description`: what this NPC is trying
   * to get *right now*, and what they currently know. These two fields are what
   * make the Table screen worth looking at mid-session.
   */
  wants?: string;
  knows?: string;
  /** Session number this entry was last on stage. Written by "put on stage". */
  lastSeenSession?: number;
};

export type Location = {
  id: string;
  campaignId: string;
  name: string;
  description: string;
  lastSeenSession?: number;
};

export type Session = {
  id: string;
  campaignId: string;
  sessionNumber: number;
  date: FieldValue | string;
  summary: string;
  aiSummary?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Combat Tracker — persisted per-campaign so it survives tab switches / reloads
// ─────────────────────────────────────────────────────────────────────────────

export type CombatantType = 'player' | 'monster';

export type Condition =
  | 'Blinded' | 'Charmed' | 'Deafened' | 'Exhausted'
  | 'Frightened' | 'Grappled' | 'Incapacitated' | 'Invisible'
  | 'Paralyzed' | 'Petrified' | 'Poisoned' | 'Prone'
  | 'Restrained' | 'Stunned' | 'Unconscious' | 'Concentrating';

export type Combatant = {
  id: string;
  name: string;
  initiative: number | '';
  type: CombatantType;
  // Secondary sort key. Breaks initiative ties and makes the reorder arrows
  // work even when two combatants rolled the same number.
  seq: number;
  // Monsters only
  maxHp?: number;
  currentHp?: number;
  url?: string;
  // Shared
  conditions: Condition[];
};

export type CombatState = {
  campaignId: string;
  combatants: Combatant[];
  /**
   * Id of the combatant whose turn it is. Identity-based so that removing a
   * combatant or editing initiative mid-combat can't silently move the turn.
   */
  activeId?: string | null;
  /** @deprecated Positional index kept only to migrate encounters saved before activeId existed. */
  activeIndex?: number;
  round: number;
  turnCount: number;
  started: boolean;
  updatedAt?: FieldValue | string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Live Session — persisted per-campaign so the conversation and notes survive
// tab switches and reloads mid-session
// ─────────────────────────────────────────────────────────────────────────────

export type LiveSessionStoredMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type LiveSessionState = {
  campaignId: string;
  messages: LiveSessionStoredMessage[];
  notes: string;
  /**
   * When the DM started running tonight. Drives the "01:47 ELAPSED" readout in
   * the status bar; absent on sessions started before this field existed, in
   * which case the readout is hidden rather than showing a bogus zero.
   */
  startedAt?: FieldValue | string;
  updatedAt?: FieldValue | string;
};

/**
 * The last generated prep document, kept so switching tabs doesn't discard an
 * AI-generated document the DM hasn't copied anywhere yet.
 * `prep` mirrors SessionPrepOutput from the prep flow.
 */
export type SessionPrepState = {
  campaignId: string;
  prep: {
    sessionTitle: string;
    openingScene: string;
    alternateOpening: string;
    complications: { title: string; description: string }[];
    npcMotivations: { name: string; currentGoal: string; howTheyActToday: string }[];
    characterSpotlights: { character: string; opportunity: string }[];
    prepReminders: string[];
    openThreadsToPull: string[];
  } | null;
  updatedAt?: FieldValue | string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Faction
// ─────────────────────────────────────────────────────────────────────────────

export type Faction = {
  id: string;
  campaignId: string;
  name: string;
  description: string;
  leader?: string;
  homeBase?: string;
  color?: string; // hex color for visual identification
  // Dynamic — updated each session
  disposition: Disposition;
  /**
   * Storage keeps these names because campaigns already have documents written
   * under them; renaming would silently orphan live data for a cosmetic win.
   * The Codex normalizer maps currentAgenda → wants and whatTheyKnow → knows so
   * the *display* contract is uniform across NPCs and factions.
   */
  currentAgenda?: string;   // what are they actively doing right now?
  whatTheyKnow?: string;    // what do they know about the party?
  lastSeenSession?: number;
  createdAt: FieldValue | string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Scene — "the room the party is in". Nothing modelled this before; it is what
// the Table screen renders. Scenes are ordered by `createdAt`, and the newest
// one is the current scene, so putting an entry on stage never has to
// transactionally clear an `isCurrent` flag on some other document.
// ─────────────────────────────────────────────────────────────────────────────

export type Scene = {
  id: string;
  campaignId: string;
  name: string;
  location?: string;
  timeOfDay?: string;
  /** The one rule bending play tonight, e.g. "Party is unarmed by decree". */
  constraint?: string;
  onStageNpcIds: string[];
  pressure?: string;
  secret?: string;
  wayOut?: string;
  /** Display chrome only — renders as "SCENE 3 OF SESSION 14" / "03 / S14". */
  sceneNumber?: number;
  sessionNumber?: number;
  createdAt: FieldValue | string;
  updatedAt?: FieldValue | string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Thread — unresolved plot threads. SessionPrepOutput.openThreadsToPull emits
// these as loose strings that are currently thrown away; promoting one to a
// document is what lets it persist across sessions and change status.
// ─────────────────────────────────────────────────────────────────────────────

export type ThreadStatus = 'live' | 'seeded' | 'cold';

export type Thread = {
  id: string;
  campaignId: string;
  /** Short human-readable handle, e.g. "T-07". */
  tag: string;
  title: string;
  note?: string;
  status: ThreadStatus;
  createdAt: FieldValue | string;
  updatedAt?: FieldValue | string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Codex — one normalized shape over every entity type, so a single index and a
// single detail pane replace the five near-identical manager screens.
// ─────────────────────────────────────────────────────────────────────────────

export type CodexKind =
  | 'npc'
  | 'place'
  | 'faction'
  | 'party'
  | 'item'
  | 'session'
  | 'concept';

export type CodexEntry = {
  id: string;
  name: string;
  kind: CodexKind;
  /** Location, affiliation, or "carried by X". */
  where?: string;
  /** Session ref rendered in the SEEN column, e.g. "S14". */
  lastSeen?: string;
  /** Numeric form of `lastSeen`, kept for sorting. */
  lastSeenSession?: number;
  /** Colour by kind — see the kind accents in the design tokens. */
  accent: string;
  disposition?: Disposition;
  /** Uniform display contract; factions map currentAgenda/whatTheyKnow onto these. */
  wants?: string;
  knows?: string;
  /** The underlying document, for the detail pane and edit dialog. */
  source: unknown;
};
