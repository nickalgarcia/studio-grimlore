/**
 * @fileOverview Drafts an issue's recap from the DM's notes, captures and the
 * co-pilot conversation.
 *
 * Returns a title and logline alongside the recap, and writes `[[Name]]` links
 * for the campaign's known names, which is what puts the issue on the Loom.
 * The result is a draft: the DM edits it before anything is saved.
 */

import { callClaudeJson } from '@/ai/anthropic-client';
import { z } from 'zod';
import { FlowInputError } from '@/ai/errors';

export const GenerateSessionRecapInputSchema = z.object({
  campaignName: z.string().max(200),
  sessionNumber: z.number().int().min(0).max(10_000),
  dmNotes: z.string().max(30_000).describe('Raw notes and captures the DM took during the session.'),
  conversationHighlights: z.string().max(8_000).optional().describe('Key exchanges from the co-pilot conversation.'),
  characters: z.array(z.object({ name: z.string().max(120), class: z.string().max(120).optional() })).max(12).optional(),
  previousSummary: z.string().max(4_000).optional().describe('The existing campaign summary for continuity.'),
  /** Names the recap may link with [[Name]]: NPCs, places, factions, PCs, thread titles. */
  linkNames: z.array(z.string().max(160)).max(300).optional(),
});
export type GenerateSessionRecapInput = z.infer<typeof GenerateSessionRecapInputSchema>;

export type GenerateSessionRecapOutput = {
  /** 2–5 words, for the Longbox. */
  title: string;
  /** One sentence. */
  logline: string;
  recap: string;
};

const clip = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

export async function generateSessionRecap(
  input: GenerateSessionRecapInput
): Promise<GenerateSessionRecapOutput> {
  const parsed = GenerateSessionRecapInputSchema.safeParse(input);
  if (!parsed.success) throw new FlowInputError(parsed.error.errors[0]?.message ?? 'Invalid input');

  const {
    campaignName, sessionNumber, dmNotes, conversationHighlights, characters, previousSummary, linkNames,
  } = parsed.data;

  const sections: string[] = [
    `Campaign: ${campaignName}`,
    `Issue (session) number: ${sessionNumber}`,
  ];
  if (characters?.length) {
    sections.push(`Player characters: ${characters.map(c => `${c.name}${c.class ? ` (${c.class})` : ''}`).join(', ')}`);
  }
  if (previousSummary) sections.push(`Story so far:\n${previousSummary.slice(0, 600)}`);
  if (linkNames?.length) sections.push(`Known names (link these):\n${linkNames.join('\n')}`);
  sections.push(`DM's notes from the session:\n${dmNotes}`);
  if (conversationHighlights) sections.push(`Moments from the co-pilot log:\n${conversationHighlights}`);

  sections.push(`Write this session up as an issue of the campaign's comic series.

- "recap": 2-4 paragraphs of past-tense narrative prose, no bullet points, no headings.
  Use names, not just pronouns. Capture decisions, consequences and new mysteries, and
  end on where the party stands now.
  Wrap a name in [[double brackets]] the first time it appears in each paragraph, but only
  names from the "Known names" list, written exactly as listed. Never bracket anything else.
- "title": a 2-5 word issue title, evocative, no quotes, no issue number.
- "logline": one sentence, under 25 words, that sells the issue.

Return ONLY this JSON, no fences or commentary:
{"title": "...", "logline": "...", "recap": "..."}`);

  const result = await callClaudeJson<Partial<GenerateSessionRecapOutput>>({
    system: `You are the chronicler of a tabletop campaign written as a comic series.
You turn raw session notes into recaps that make players want to come back.
Specific details, vivid verbs, emotional weight.
Never invent events that aren't in the notes: extrapolate tone, not facts.`,
    messages: [{ role: 'user', content: sections.join('\n\n') }],
    temperature: 0.7,
    max_tokens: 1400,
  });

  return {
    title: clip(result.title, 80),
    logline: clip(result.logline, 240),
    recap: clip(result.recap, 12_000),
  };
}
