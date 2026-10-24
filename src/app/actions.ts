'use server';

// The co-pilot streams through app/api/live-session; only its message type is shared here.
import type { LiveSessionMessage } from '@/ai/flows/live-session-flow';

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

import { draftBeats, type DraftBeatsInput, type DraftBeatsOutput } from '@/ai/flows/draft-beats-flow';
import { draftPage, type DraftPageInput, type DraftPageOutput } from '@/ai/flows/draft-page-flow';
import { draftArtBrief, type DraftArtBriefInput, type DraftArtBriefOutput } from '@/ai/flows/draft-art-brief-flow';

import { requireUser, authErrorMessage } from '@/firebase/require-user';
import { FlowInputError } from '@/ai/errors';

// Re-export types so components can import from one place
export type { DraftArtBriefOutput, DraftBeatsOutput, DraftPageOutput, LiveSessionMessage, GenerateSessionRecapOutput, SessionPrepOutput, ParseObsidianSessionOutput };

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
    if (e instanceof InputError || e instanceof FlowInputError) return { data: null, error: e.message };
    console.error(`[${label}]`, e);
    return { data: null, error: failure };
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// Co-pilot drafts (Director's Cut). Drafts only: the client shows them in an
// editor and nothing is saved until the DM does.
// ─────────────────────────────────────────────────────────────────────────────

export async function getBeatsDraft(
  idToken: string,
  input: DraftBeatsInput
): Promise<Result<DraftBeatsOutput>> {
  return gated(idToken, 'getBeatsDraft', 'Could not draft the panels. Please try again.', () =>
    draftBeats(input)
  );
}

export async function getPageDraft(
  idToken: string,
  input: DraftPageInput
): Promise<Result<DraftPageOutput>> {
  return gated(idToken, 'getPageDraft', 'Could not draft the page. Please try again.', () =>
    draftPage(input)
  );
}

/**
 * The brief for one generated image. Drawing it is a separate step, through
 * app/api/generate-art (it returns image bytes, which a server action can't
 * stream back efficiently).
 */
export async function getArtBriefDraft(
  idToken: string,
  input: DraftArtBriefInput
): Promise<Result<DraftArtBriefOutput>> {
  return gated(idToken, 'getArtBriefDraft', 'Could not draft the brief. Please try again.', () =>
    draftArtBrief(input)
  );
}
