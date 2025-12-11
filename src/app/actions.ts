
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

const MAX_TEXT_LENGTH = 6000;
const MAX_SESSION_SUMMARY_LENGTH = 800;
const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = { value: T; expires: number };
const inspirationCache = new Map<string, CacheEntry<InspirationPromptOutput>>();
const ruleCache = new Map<string, CacheEntry<LookupRuleOutput>>();

function trimText(value: string, max: number = MAX_TEXT_LENGTH) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max)}... [truncated]` : value;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

function getCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export async function getContextualIdeas(
  partyActions: string
): Promise<{ data: GenerateContextSensitiveIdeasOutput | null; error: string | null }> {
  if (!partyActions.trim()) {
    return { data: null, error: 'Please describe the party actions.' };
  }
  try {
    const ideas = await generateContextSensitiveIdeas({ partyActions: trimText(partyActions) });
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
  const cached = getCache(inspirationCache, 'inspiration');
  if (cached) return { data: cached, error: null };

  try {
    const inspiration = await generateInspirationPrompt();
    setCache(inspirationCache, 'inspiration', inspiration);
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
    const normalized = term.trim().toLowerCase();
    const cached = getCache(ruleCache, normalized);
    if (cached) return { data: cached, error: null };
    try {
        const result = await lookupRule({ term: normalized });
        setCache(ruleCache, normalized, result);
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
    const npc = await generateNpc({ 
      campaignContext: trimText(campaignContext),
      locationContext: trimText(locationContext || '', 500)
    });
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
    const character = await generateCharacter({ 
      campaignContext: trimText(campaignContext),
      prompt: trimText(prompt, 1200)
    });
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
    const trimmedSessions = input.sessions
      .sort((a, b) => a.sessionNumber - b.sessionNumber)
      .slice(-10)
      .map(s => ({
        sessionNumber: s.sessionNumber,
        summary: trimText(s.summary, MAX_SESSION_SUMMARY_LENGTH),
      }));

    const trimmedCharacters = input.characters.map(c => ({
      name: c.name,
      class: c.class,
      species: c.species,
      backstory: trimText(c.backstory, 1000),
    }));

    const summary = await summarizeCampaign({
      campaignName: trimText(input.campaignName, 200),
      campaignDescription: trimText(input.campaignDescription, 800),
      sessions: trimmedSessions,
      characters: trimmedCharacters,
    });
    return { data: summary, error: null };
  } catch (e) {
    console.error(e);
    return { data: null, error: 'Failed to generate campaign summary. Please try again.' };
  }
}
    
