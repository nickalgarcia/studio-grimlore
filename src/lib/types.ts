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
