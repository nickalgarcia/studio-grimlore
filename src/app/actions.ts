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
// Gate
// ─────────────────────────────────────────────────────────────────────────────

type Result<T> = { data: T | null; error: string | null };

/** Thrown inside an action body for a message the user should see as written. */
class InputError extends Error {}

/**
 * The body of every action in this file. New actions go through it too.
 *
 * Every export here is a public POST endpoint: its id ships in the client
 * bundle, which loads before the auth gate. So nothing runs until the token is
 * verified, and that includes input checks and the cache, not just the model
 * call. Keeping `run` inside the try also means a malformed argument comes back
 * as `{ error }` rather than a rejected promise, which the callers (who set a
 * loading flag and then await) would never recover from.
 */
async function gated<T>(
  idToken: string,
  label: string,
  failure: string,
  run: () => Promise<T>
): Promise<Result<T>> {
  try {
    await requireUser(idToken);
  } catch (e) {
    return { data: null, error: authErrorMessage(e) };
  }
  try {
    return { data: await run(), error: null };
  } catch (e) {
    if (e instanceof InputError) return { data: null, error: e.message };
    console.error(`[${label}]`, e);
    return { data: null, error: failure };
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
): Promise<Result<GenerateContextSensitiveIdeasOutput>> {
  return gated(idToken, 'getContextualIdeas', 'Failed to generate ideas. Please try again.', async () => {
    if (!input.partyActions.trim()) {
      throw new InputError('Please describe what is happening at the table.');
    }
    return generateContextSensitiveIdeas(input);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Session (conversational, maintains message history)
// ─────────────────────────────────────────────────────────────────────────────

export async function getLiveSessionResponse(
  idToken: string,
  input: LiveSessionInput
): Promise<Result<LiveSessionOutput>> {
  return gated(idToken, 'getLiveSessionResponse', 'Failed to get a response. Please try again.', () =>
    runLiveSession(input)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inspiration (cached)
// ─────────────────────────────────────────────────────────────────────────────

export async function getInspiration(idToken: string): Promise<Result<InspirationPromptOutput>> {
  return gated(idToken, 'getInspiration', 'Failed to generate inspiration. Please try again.', async () => {
    const cached = getCache(inspirationCache, 'inspiration');
    if (cached) return cached;
    return setCache(inspirationCache, 'inspiration', await generateInspirationPrompt());
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule Lookup
// ─────────────────────────────────────────────────────────────────────────────

export async function getRuleInfo(
  idToken: string,
  term: string
): Promise<Result<LookupRuleOutput>> {
  return gated(idToken, 'getRuleInfo', 'Failed to look up rule. Please try again.', async () => {
    if (!term.trim()) throw new InputError('Please enter a term to look up.');
    return lookupRule({ term });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NPC Generator
// ─────────────────────────────────────────────────────────────────────────────

export async function getNpc(
  idToken: string,
  input: GenerateNpcInput
): Promise<Result<GenerateNpcOutput>> {
  return gated(idToken, 'getNpc', 'Failed to generate NPC. Please try again.', () =>
    generateNpc(input)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Campaign Summary
// ─────────────────────────────────────────────────────────────────────────────

export async function getCampaignSummary(
  idToken: string,
  input: SummarizeCampaignInput
): Promise<Result<SummarizeCampaignOutput>> {
  return gated(idToken, 'getCampaignSummary', 'Failed to generate campaign summary. Please try again.', () =>
    summarizeCampaign(input)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Recap
// ─────────────────────────────────────────────────────────────────────────────

export async function getSessionRecap(
  idToken: string,
  input: GenerateSessionRecapInput
): Promise<Result<GenerateSessionRecapOutput>> {
  return gated(idToken, 'getSessionRecap', 'Failed to generate session recap. Please try again.', () =>
    generateSessionRecap(input)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Prep
// ─────────────────────────────────────────────────────────────────────────────

export async function getSessionPrep(
  idToken: string,
  input: SessionPrepInput
): Promise<Result<SessionPrepOutput>> {
  return gated(idToken, 'getSessionPrep', 'Failed to generate session prep. Please try again.', () =>
    generateSessionPrep(input)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Obsidian Import
// ─────────────────────────────────────────────────────────────────────────────

export async function parseObsidianSessionAction(
  idToken: string,
  input: ParseObsidianSessionInput
): Promise<Result<ParseObsidianSessionOutput>> {
  return gated(idToken, 'parseObsidianSessionAction', 'Failed to parse session file. Please try again.', () =>
    parseObsidianSession(input)
  );
}
