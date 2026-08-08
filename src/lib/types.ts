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
};

export type NpcStatus = 'Active' | 'Inactive' | 'Dead' | 'Unknown';
export type NpcImportance = 'Key' | 'Minor';

export type Npc = {
  id: string;
  campaignId: string;
  name: string;
  description: string;
  location?: string;
  // New fields
  status?: NpcStatus;
  importance?: NpcImportance;
  factionId?: string;   // references a Faction id
  factionName?: string; // denormalized for display without extra fetch
};

export type Location = {
  id: string;
  campaignId: string;
  name: string;
  description: string;
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
// Faction — new type
// ─────────────────────────────────────────────────────────────────────────────

export type FactionDisposition =
  | 'Hostile'
  | 'Unfriendly'
  | 'Neutral'
  | 'Friendly'
  | 'Allied';

export type Faction = {
  id: string;
  campaignId: string;
  name: string;
  description: string;
  leader?: string;
  homeBase?: string;
  color?: string; // hex color for visual identification
  // Dynamic — updated each session
  disposition: FactionDisposition;
  currentAgenda?: string;   // what are they actively doing right now?
  whatTheyKnow?: string;    // what do they know about the party?
  createdAt: FieldValue | string;
};
