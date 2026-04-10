/**
 * @fileOverview Parses raw Obsidian markdown from a session recap
 * into a clean, structured session summary ready to save to Firestore.
 *
 * Handles any markdown format — headers, bullets, callouts, wikilinks,
 * read-aloud blocks, DM notes — and extracts just the narrative content.
 */

import { callClaude, callClaudeJson } from '@/ai/anthropic-client';
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

  // Trim aggressively — long files with stat blocks blow the context
  const trimmedMarkdown = markdown.slice(0, 6000);

  const prompt = [
    campaignName ? `Campaign: ${campaignName}` : '',
    hintSessionNumber ? `Expected session number if not found in content: ${hintSessionNumber}` : '',
    '',
    'Parse this Obsidian session document. Extract only what HAPPENED narratively.',
    'Ignore: DM-only prep notes, stat blocks, read-aloud markers, wiki links [[like this]], callout boxes, puzzle mechanics.',
    'Focus on: the narrative events, party decisions, revelations, NPC interactions.',
    '',
    '--- MARKDOWN ---',
    trimmedMarkdown,
    '--- END ---',
    '',
    `Return ONLY this JSON object, nothing else:
{
  "sessionNumber": <number>,
  "title": "<short evocative title>",
  "summary": "<2-3 paragraph narrative prose of what happened, no markdown>",
  "keyMoments": ["<moment 1>", "<moment 2>", "<moment 3>"],
  "npcsIntroduced": ["<name>"],
  "openThreads": ["<thread>"]
}`,
  ].filter(Boolean).join('\n');

  const raw = await callClaude({
    system: `You are a D&D campaign archivist. Extract clean session data from raw Obsidian markdown.
The summary must be narrative prose in past tense — no bullet points, no markdown formatting.
Return ONLY valid JSON. No explanation, no markdown fences, no preamble.`,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 1500,
  });

  // Strip any markdown fences Claude might add despite instructions
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Find the JSON object — sometimes Claude adds text before/after
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('No JSON found in Claude response:', cleaned.slice(0, 500));
    throw new Error('Could not extract JSON from response');
  }

  try {
    const result = JSON.parse(jsonMatch[0]);
    // Ensure required fields have fallbacks
    return {
      sessionNumber: result.sessionNumber ?? hintSessionNumber ?? 1,
      title: result.title ?? `Session ${result.sessionNumber ?? hintSessionNumber ?? 1}`,
      summary: result.summary ?? raw,
      keyMoments: Array.isArray(result.keyMoments) ? result.keyMoments : [],
      npcsIntroduced: Array.isArray(result.npcsIntroduced) ? result.npcsIntroduced : [],
      openThreads: Array.isArray(result.openThreads) ? result.openThreads : [],
    };
  } catch (e) {
    console.error('JSON parse failed:', jsonMatch[0].slice(0, 500));
    throw new Error('Failed to parse session data from response');
  }
}
