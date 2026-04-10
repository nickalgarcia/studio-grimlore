/**
 * @fileOverview Parses raw Obsidian markdown from a session recap
 * into a clean, structured session summary ready to save to Firestore.
 *
 * Handles any markdown format — headers, bullets, callouts, wikilinks,
 * read-aloud blocks, DM notes — and extracts just the narrative content.
 */

import { callClaudeJson } from '@/ai/anthropic-client';
import { z } from 'zod';

export const ParseObsidianSessionInputSchema = z.object({
  markdown: z.string().describe('Raw markdown content from an Obsidian session file.'),
  campaignName: z.string().optional(),
  hintSessionNumber: z.number().optional().describe('The session number to assign if not found in the markdown.'),
});
export type ParseObsidianSessionInput = z.infer<typeof ParseObsidianSessionInputSchema>;

export const ParseObsidianSessionOutputSchema = z.object({
  sessionNumber: z.number().describe('The session number, extracted from the markdown or inferred.'),
  title: z.string().describe('A short evocative title for the session.'),
  summary: z.string().describe('A clean 2-4 paragraph narrative summary of what happened this session. No markdown formatting, no DM notes, no read-aloud blocks — pure narrative prose suitable for storing as a session log.'),
  keyMoments: z.array(z.string()).describe('3-5 bullet points of the most important moments, decisions, or revelations from the session.'),
  npcsIntroduced: z.array(z.string()).describe('Names of any new NPCs introduced this session.'),
  openThreads: z.array(z.string()).describe('Any new unresolved plot threads introduced this session.'),
});
export type ParseObsidianSessionOutput = z.infer<typeof ParseObsidianSessionOutputSchema>;

export async function parseObsidianSession(
  input: ParseObsidianSessionInput
): Promise<ParseObsidianSessionOutput> {
  const parsed = ParseObsidianSessionInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input');

  const { markdown, campaignName, hintSessionNumber } = parsed.data;

  const prompt = [
    campaignName ? `Campaign: ${campaignName}` : '',
    hintSessionNumber ? `Expected session number: ${hintSessionNumber}` : '',
    '',
    'Parse this Obsidian session document and extract the key information.',
    'Ignore: DM-only notes, read-aloud text markers, mechanical stat blocks, wiki links [[like this]], callout boxes, and preparation notes.',
    'Focus on: what actually happened narratively, who was involved, what decisions were made, what was revealed.',
    '',
    '--- MARKDOWN CONTENT ---',
    markdown.slice(0, 8000), // cap to avoid token overflow on huge files
    '--- END CONTENT ---',
    '',
    'Return ONLY a valid JSON object. No preamble, no markdown fences.',
  ].filter(Boolean).join('\n');

  return callClaudeJson<ParseObsidianSessionOutput>({
    system: `You are a D&D campaign archivist. Your job is to extract clean, structured session data from raw Obsidian markdown notes.
The DM's notes may be messy, contain preparation content mixed with recaps, or use various markdown conventions.
Extract only what actually HAPPENED during the session — not what was planned, not read-aloud boxed text, not mechanical notes.
The summary should read like a "previously on..." narrative, written in past tense.
If you cannot determine the session number from the content, use the hint provided.`,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 1200,
  });
}
