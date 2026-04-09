'use server';

import {
  generateContextSensitiveIdeas,
  type GenerateContextSensitiveIdeasInput,
  type GenerateContextSensitiveIdeasOutput,
} from '@/ai/flows/generate-context-sensitive-ideas';

import {
  generateInspirationPrompt,
  lookupRule,
  type InspirationPromptOutput,
  type LookupRuleOutput,
} from '@/ai/flows/lookup-and-inspiration-flows';

import { generateNpc, type GenerateNpcInput, type GenerateNpcOutput } from '@/ai/flows/generate-npc-flow';

import {
  runLiveSession,
  type LiveSessionInput,
  type LiveSessionOutput,
  type LiveSessionMessage,
} from '@/ai/flows/live-session-flow';

import { summarizeCampaign, type SummarizeCampaignInput, type SummarizeCampaignOutput } from '@/ai/flows/summarize-campaign-flow';

// Re-export types so components can import from one place
export type { GenerateContextSensitiveIdeasOutput, InspirationPromptOutput, LookupRuleOutput, GenerateNpcOutput, LiveSessionOutput, LiveSessionMessage };

// ─────────────────────────────────────────────────────────────────────────────
// Cache (inspiration only — rules and live session should not cache)
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
type CacheEntry<T> = { value: T; expires: number };
const inspirationCache = new Map<string, CacheEntry<InspirationPromptOutput>>();

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

function getCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Idea Generator (one-shot, campaign-aware)
// ─────────────────────────────────────────────────────────────────────────────

export async function getContextualIdeas(
  input: GenerateContextSensitiveIdeasInput
): Promise<{ data: GenerateContextSensitiveIdeasOutput | null; error: string | null }> {
  if (!input.partyActions.trim()) {
    return { data: null, error: 'Please describe what is happening at the table.' };
  }
  try {
    const ideas = await generateContextSensitiveIdeas(input);
    return { data: ideas, error: null };
  } catch (e) {
    console.error('[getContextualIdeas]', e);
    return { data: null, error: 'Failed to generate ideas. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Session (conversational, maintains message history)
// ─────────────────────────────────────────────────────────────────────────────

export async function getLiveSessionResponse(
  input: LiveSessionInput
): Promise<{ data: LiveSessionOutput | null; error: string | null }> {
  try {
    const result = await runLiveSession(input);
    return { data: result, error: null };
  } catch (e) {
    console.error('[getLiveSessionResponse]', e);
    return { data: null, error: 'Failed to get a response. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inspiration (cached)
// ─────────────────────────────────────────────────────────────────────────────

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
    console.error('[getInspiration]', e);
    return { data: null, error: 'Failed to generate inspiration. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule Lookup
// ─────────────────────────────────────────────────────────────────────────────

export async function getRuleInfo(
  term: string
): Promise<{ data: LookupRuleOutput | null; error: string | null }> {
  if (!term.trim()) return { data: null, error: 'Please enter a term to look up.' };
  try {
    const data = await lookupRule({ term });
    return { data, error: null };
  } catch (e) {
    console.error('[getRuleInfo]', e);
    return { data: null, error: 'Failed to look up rule. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NPC Generator
// ─────────────────────────────────────────────────────────────────────────────

export async function getNpc(
  input: GenerateNpcInput
): Promise<{ data: GenerateNpcOutput | null; error: string | null }> {
  try {
    const data = await generateNpc(input);
    return { data, error: null };
  } catch (e) {
    console.error('[getNpc]', e);
    return { data: null, error: 'Failed to generate NPC. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Campaign Summary
// ─────────────────────────────────────────────────────────────────────────────

export async function getCampaignSummary(
  input: SummarizeCampaignInput
): Promise<{ data: SummarizeCampaignOutput | null; error: string | null }> {
  try {
    const data = await summarizeCampaign(input);
    return { data, error: null };
  } catch (e) {
    console.error('[getCampaignSummary]', e);
    return { data: null, error: 'Failed to generate campaign summary. Please try again.' };
  }
}
