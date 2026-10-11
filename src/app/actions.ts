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

import {
  generateSessionRecap,
  type GenerateSessionRecapInput,
  type GenerateSessionRecapOutput,
} from '@/ai/flows/generate-session-recap-flow';

import {
  generateSessionPrep,
  type SessionPrepInput,
  type SessionPrepOutput,
} from '@/ai/flows/generate-session-prep-flow';

import {
  parseObsidianSession,
  type ParseObsidianSessionInput,
  type ParseObsidianSessionOutput,
} from '@/ai/flows/parse-obsidian-session-flow';

import { requireUser, authErrorMessage } from '@/firebase/require-user';

// Re-export types so components can import from one place
export type { GenerateContextSensitiveIdeasOutput, InspirationPromptOutput, LookupRuleOutput, GenerateNpcOutput, LiveSessionOutput, LiveSessionMessage, GenerateSessionRecapOutput, SessionPrepOutput, ParseObsidianSessionOutput };

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every export below is a public POST endpoint: its id ships in the client
 * bundle, which loads before the auth gate. Each one therefore starts by
 * calling this, ahead of validation, caches and anything that spends tokens.
 * Returns the message to hand back, or null when the caller may proceed.
 */
async function denyReason(idToken: string): Promise<string | null> {
  try {
    await requireUser(idToken);
    return null;
  } catch (e) {
    return authErrorMessage(e);
  }
}

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
  idToken: string,
  input: GenerateContextSensitiveIdeasInput
): Promise<{ data: GenerateContextSensitiveIdeasOutput | null; error: string | null }> {
  const denied = await denyReason(idToken);
  if (denied) return { data: null, error: denied };
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
  idToken: string,
  input: LiveSessionInput
): Promise<{ data: LiveSessionOutput | null; error: string | null }> {
  const denied = await denyReason(idToken);
  if (denied) return { data: null, error: denied };
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

export async function getInspiration(idToken: string): Promise<{
  data: InspirationPromptOutput | null;
  error: string | null;
}> {
  const denied = await denyReason(idToken);
  if (denied) return { data: null, error: denied };

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
  idToken: string,
  term: string
): Promise<{ data: LookupRuleOutput | null; error: string | null }> {
  const denied = await denyReason(idToken);
  if (denied) return { data: null, error: denied };
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
  idToken: string,
  input: GenerateNpcInput
): Promise<{ data: GenerateNpcOutput | null; error: string | null }> {
  const denied = await denyReason(idToken);
  if (denied) return { data: null, error: denied };
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
  idToken: string,
  input: SummarizeCampaignInput
): Promise<{ data: SummarizeCampaignOutput | null; error: string | null }> {
  const denied = await denyReason(idToken);
  if (denied) return { data: null, error: denied };
  try {
    const data = await summarizeCampaign(input);
    return { data, error: null };
  } catch (e) {
    console.error('[getCampaignSummary]', e);
    return { data: null, error: 'Failed to generate campaign summary. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Recap
// ─────────────────────────────────────────────────────────────────────────────

export async function getSessionRecap(
  idToken: string,
  input: GenerateSessionRecapInput
): Promise<{ data: GenerateSessionRecapOutput | null; error: string | null }> {
  const denied = await denyReason(idToken);
  if (denied) return { data: null, error: denied };
  try {
    const data = await generateSessionRecap(input);
    return { data, error: null };
  } catch (e) {
    console.error('[getSessionRecap]', e);
    return { data: null, error: 'Failed to generate session recap. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Prep
// ─────────────────────────────────────────────────────────────────────────────

export async function getSessionPrep(
  idToken: string,
  input: SessionPrepInput
): Promise<{ data: SessionPrepOutput | null; error: string | null }> {
  const denied = await denyReason(idToken);
  if (denied) return { data: null, error: denied };
  try {
    const data = await generateSessionPrep(input);
    return { data, error: null };
  } catch (e) {
    console.error('[getSessionPrep]', e);
    return { data: null, error: 'Failed to generate session prep. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Obsidian Import
// ─────────────────────────────────────────────────────────────────────────────

export async function parseObsidianSessionAction(
  idToken: string,
  input: ParseObsidianSessionInput
): Promise<{ data: ParseObsidianSessionOutput | null; error: string | null }> {
  const denied = await denyReason(idToken);
  if (denied) return { data: null, error: denied };
  try {
    const data = await parseObsidianSession(input);
    return { data, error: null };
  } catch (e) {
    console.error('[parseObsidianSessionAction]', e);
    return { data: null, error: 'Failed to parse session file. Please try again.' };
  }
}
