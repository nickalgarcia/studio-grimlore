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
  /**
   * Which data migration this campaign has had (see `lib/migrate.ts`).
   * Absent means 1: everything saved before the Director's Cut.
   */
  schemaVersion?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared Director's Cut shapes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Anything a recap can mention: the Codex kinds that are world entities, plus
 * threads. `session` and `concept` are excluded — an issue doesn't "appear" in
 * another issue, and concepts are unfiled generator output.
 */
export type MentionKind = Exclude<CodexKind, 'session' | 'concept'> | 'thread';

export type MentionRef = { kind: MentionKind; id: string };

/** One "#N | what happened" row in a Page's history list. Co-pilot draftable. */
export type HistoryEntry = { session: number; text: string };

/**
 * A note taken mid-session through the command bar's `+` capture. `links` are
 * the entity names found in the text when it was captured, kept as names (not
 * ids) because they're only shown back as "LINKED ODO"; the Loom never reads
 * captures.
 */
export type Capture = {
  id: string;
  /** Client ISO timestamp; Captured tonight shows it as time since `startedAt`. */
  at: string;
  text: string;
  links: string[];
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
  portraitUrl?: string;
  /** Issue number of this PC's last spotlight. Prep flags them OVERDUE after 5. */
  lastSpotlightSession?: number;
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
  portraitUrl?: string;
  /** DM eyes only. The players can see the screen, so it renders behind a dashed box. */
  secret?: string;
  /** Loom lane colour (one of `LANE_COLORS`). Absent means assigned by order at display time. */
  color?: string;
  history?: HistoryEntry[];
  /** Other names the recaps use for this NPC, e.g. "Verrin" for "Lady Sabeth Verrin". */
  aliases?: string[];
};

export type Location = {
  id: string;
  campaignId: string;
  name: string;
  description: string;
  lastSeenSession?: number;
  imageUrl?: string;
  aliases?: string[];
};

/**
 * One panel of an issue's three-panel strip. `image` panels show art; `word`
 * panels are a spot-colour fill with one big word ("BETRAYED.").
 */
export type SessionBeat = {
  kind: 'image' | 'word';
  caption: string;
  word?: string;
  imageUrl?: string;
};

/**
 * A session, displayed as an issue: "Issue #N" is a label over
 * `sessionNumber`, not a separate field.
 *
 * There is no `status: 'next'` placeholder document: the next issue is derived
 * (latest played + 1) and its title and date come from `sessionPrep/current`.
 * A placeholder would break the assumption that `sessions[0]` is the latest
 * *played* session, which numbering a new session relies on.
 *
 * Mentions are not stored. The Loom and "Mentioned in" are derived at read time
 * from the recap text by `lib/mentions.ts`, so adding or renaming an entity
 * can never leave an old issue's index stale. Only the DM's decisions about
 * auto-detected names are stored, in `mentionOverrides`.
 */
export type Session = {
  id: string;
  campaignId: string;
  sessionNumber: number;
  date: FieldValue | string;
  /**
   * The recap as v3 wrote it. During the redesign every writer sets `summary`
   * and `recap` to the same text, so v3 screens and the new ones agree; read it
   * through `recapOf()` rather than directly.
   */
  summary: string;
  aiSummary?: string;
  title?: string;
  logline?: string;
  coverUrl?: string;
  /** At most three. */
  beats?: SessionBeat[];
  /** Markdown with `[[Name]]` links. Backfilled from `summary` by the migration. */
  recap?: string;
  /** Archived at END SESSION from the live session, for drafting the recap later. */
  notes?: string;
  captures?: Capture[];
  /**
   * `confirm`: refs the DM has affirmed, including entities in the issue that
   * the text never names. `ignore`: auto-detected names that are false hits.
   * Explicit `[[links]]` can't be ignored; edit the link out instead.
   */
  mentionOverrides?: { confirm?: MentionRef[]; ignore?: MentionRef[] };
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
  /** Notes from the command bar's `+` capture. Persisted with the rest of this doc. */
  captures?: Capture[];
};

export type PrepSceneRole = 'open' | 'pressure' | 'turn' | 'cliffhanger';

/** One card in Prep's "The Script". */
export type PrepScene = {
  role: PrepSceneRole;
  title: string;
  where: string;
  beat: string;
  /** NPC or PC ids. The flow emits names; the client maps them to ids. */
  castIds: string[];
};

/**
 * The last generated prep document, kept so switching tabs doesn't discard an
 * AI-generated document the DM hasn't copied anywhere yet.
 * `prep` mirrors SessionPrepOutput from the prep flow, plus the optional
 * Director's Cut fields.
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
    /**
     * Thread ids from the Director's Cut on. Prep saved before then holds
     * thread titles, so readers treat a value matching no thread id as a title.
     */
    openThreadsToPull: string[];
    scenes?: PrepScene[];
    /**
     * Indexes into `prepReminders` the DM has ticked off. Lives inside `prep`
     * on purpose: a redraft brings new reminders, so it should reset.
     */
    done?: number[];
  } | null;
  /** When the next issue is due to be played. Client ISO string. */
  scheduledAt?: string;
  updatedAt?: FieldValue | string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Rules — house rules live in Firestore, per user (shared across campaigns).
// Core 5e rules and conditions are code constants; a core rule only gets a
// document once the DM pins it or flags it for tonight, so "At hand" stays one
// query over this collection.
// ─────────────────────────────────────────────────────────────────────────────

export type RuleCategory = 'combat' | 'magic' | 'exploration' | 'table';

/** The display shape, for house and core rules alike. */
export type Rule = {
  id: string;
  title: string;
  kind: 'house' | 'core';
  category: RuleCategory;
  text: string;
  /** House rules: the rule this one replaces, shown struck through. */
  replaces?: string;
  why?: string;
  sinceSession?: number;
  /** Core rules: book reference, e.g. "PHB 195". */
  ref?: string;
  pinned: boolean;
  /** Relevant to the current scene. Drives the TONIGHT filter. */
  tonight?: boolean;
};

/**
 * What's stored at `users/{uid}/rules/{id}`. A core rule's document id is the
 * id of the constant it annotates, and it holds only the per-table state.
 */
export type RuleDoc =
  | (Omit<Rule, 'id' | 'kind'> & { kind: 'house'; createdAt: FieldValue | string; updatedAt?: FieldValue | string })
  | { kind: 'core'; pinned: boolean; tonight?: boolean; updatedAt?: FieldValue | string };

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
  imageUrl?: string;
  aliases?: string[];
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
  /** Loom lane colour (one of `LANE_COLORS`). Absent means assigned by order at display time. */
  color?: string;
  /**
   * Marked "● PULLING" in Prep. Draws the dashed line and hollow ring into the
   * Loom's NEXT column and fills the "Pull: …" line on Story. Optional because
   * threads saved before the Director's Cut have none; absent reads as false.
   */
  pullNext?: boolean;
  /** The Page's two sections for a thread. */
  body?: { whereItStands?: string; whatEachSideOffers?: string };
  secret?: string;
  /** "HOW IT'S UNFOLDED" rows on the Page. */
  history?: HistoryEntry[];
  /**
   * Phrases the recaps use for this thread. Thread titles rarely appear
   * verbatim in prose, so without `[[links]]` or aliases a thread's Loom lane
   * stays empty.
   */
  aliases?: string[];
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
