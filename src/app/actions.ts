
'use server';

import {
  generateContextSensitiveIdeas,
  type GenerateContextSensitiveIdeasOutput,
} from '@/ai/flows/generate-context-sensitive-ideas';
import {
  generateInspirationPrompt,
  type InspirationPromptOutput,
} from '@/ai/flows/generate-inspiration-prompts';
import {
  lookupRule,
  type LookupRuleOutput,
} from '@/ai/flows/lookup-rule-flow';
import { 
    generateNpc,
    type GenerateNpcOutput
} from '@/ai/flows/generate-npc-flow';
import {
    generateCharacter,
    type GenerateCharacterOutput
} from '@/ai/flows/generate-character-flow';
import { summarizeCampaign, type SummarizeCampaignOutput } from '@/ai/flows/summarize-campaign-flow';


export async function getContextualIdeas(
  partyActions: string
): Promise<{ data: GenerateContextSensitiveIdeasOutput | null; error: string | null }> {
  if (!partyActions.trim()) {
    return { data: null, error: 'Please describe the party actions.' };
  }
  try {
    const ideas = await generateContextSensitiveIdeas({ partyActions });
    return { data: ideas, error: null };
  } catch (e) {
    console.error(e);
    return { data: null, error: 'Failed to generate ideas. Please try again.' };
  }
}

export async function getInspiration(): Promise<{
  data: InspirationPromptOutput | null;
  error: string | null;
}> {
  try {
    const inspiration = await generateInspirationPrompt();
    return { data: inspiration, error: null };
  } catch (e) {
    console.error(e);
    return { data: null, error: 'Failed to generate inspiration. Please try again.' };
  }
}

export async function getRuleInfo(
    term: string
): Promise<{ data: LookupRuleOutput | null; error: string | null }> {
    if (!term.trim()) {
        return { data: null, error: 'Please enter a term to look up.' };
    }
    try {
        const result = await lookupRule({ term });
        return { data: result, error: null };
    } catch (e) {
        console.error(e);
        return { data: null, error: 'Failed to look up rule. Please try again.' };
    }
}

export async function generateNewNpc(
  campaignContext: string,
  locationContext?: string
): Promise<{ data: GenerateNpcOutput | null; error: string | null; }> {
  try {
    const npc = await generateNpc({ campaignContext, locationContext });
    return { data: npc, error: null };
  } catch (e) {
    console.error(e);
    return { data: null, error: 'Failed to generate NPC. Please try again.' };
  }
}

export async function generateNewCharacter(
  campaignContext: string,
  prompt: string
): Promise<{ data: GenerateCharacterOutput | null; error: string | null; }> {
  if (!prompt.trim()) {
    return { data: null, error: 'Please provide a character concept.' };
  }
  try {
    const character = await generateCharacter({ campaignContext, prompt });
    return { data: character, error: null };
  } catch (e) {
    console.error(e);
    return { data: null, error: 'Failed to generate character. Please try again.' };
  }
}

export async function getCampaignSummary(input: {
  campaignName: string;
  campaignDescription: string;
  sessions: { sessionNumber: number; summary: string }[];
  characters: { name: string; class?: string; species?: string; backstory: string }[];
}): Promise<{ data: SummarizeCampaignOutput | null; error: string | null }> {
  try {
    const summary = await summarizeCampaign(input);
    return { data: summary, error: null };
  } catch (e) {
    console.error(e);
    return { data: null, error: 'Failed to generate campaign summary. Please try again.' };
  }
}
    
