
import { FieldValue } from "firebase/firestore";

export type SavedConcept = {
  id: string;
  userId: string;
  type: 'Plot Hook' | 'Encounter Idea' | 'NPC Concept' | 'Inspiration' | 'Dialog';
  content: string;
  context?: string; // For context-sensitive ideas
  createdAt: string | FieldValue;
};

export type Campaign = {
    id: string;
    name: string;
    description: string;
    createdAt: FieldValue | string;
    aiSummary?: string; // New field for the AI-generated summary
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

export type Npc = {
    id: string;
    campaignId: string;
    name: string;
    description: string;
    location?: string;
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

    
