'use server';

/**
 * @fileOverview Summarizes a D&D campaign using Claude.
 * Produces a rich "Previously on..." narrative recap that weaves together
 * session events, character arcs, and open plot threads.
 */

import { callClaude } from '@/ai/anthropic-client';
import { z } from 'zod';

export const SummarizeCampaignInputSchema = z.object({
  campaignName: z.string(),
  campaignDescription: z.string(),
  sessions: z.array(z.object({ sessionNumber: z.number(), summary: z.string() })),
  characters: z.array(z.object({
    name: z.string(),
    species: z.string().optional(),
    class: z.string().optional(),
    backstory: z.string(),
  })),
});
export type SummarizeCampaignInput = z.infer<typeof SummarizeCampaignInputSchema>;

export const SummarizeCampaignOutputSchema = z.object({
  campaignSummary: z.string(),
});
export type SummarizeCampaignOutput = z.infer<typeof SummarizeCampaignOutputSchema>;

export async function summarizeCampaign(input: SummarizeCampaignInput): Promise<SummarizeCampaignOutput> {
  const parsed = SummarizeCampaignInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input');

  const { campaignName, campaignDescription, sessions, characters } = parsed.data;

  const characterList = characters
    .map(c => `• ${c.name}${c.species ? ` (${c.species}` : ''}${c.class ? `${c.species ? ' ' : ' ('}${c.class}` : ''}${c.species || c.class ? ')' : ''}: ${c.backstory}`)
    .join('\n');

  const sessionList = sessions
    .sort((a, b) => a.sessionNumber - b.sessionNumber)
    .map(s => `Session ${s.sessionNumber}: ${s.summary}`)
    .join('\n\n');

  const prompt = `Campaign: ${campaignName}
Premise: ${campaignDescription}

Heroes:
${characterList}

Session Logs:
${sessionList}

Write a compelling "Previously on ${campaignName}..." narrative recap. 
Synthesize the session events into a cohesive story that highlights:
- The major plot developments and how they connect
- Character moments and how they've grown
- Unresolved tensions and looming threats
- The emotional and thematic throughlines

Write in a vivid, present-tense storytelling voice — like a fantasy novel's chapter recap. 
3-5 paragraphs. No bullet points. Immersive prose only.`;

  const campaignSummary = await callClaude({
    system: `You are a master storyteller and campaign chronicler for tabletop RPGs. 
Your recaps make players excited to return to the table and help the DM feel the narrative momentum of their campaign.
Write with literary flair — evocative verbs, specific details, rising tension.`,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1200,
  });

  return { campaignSummary };
}
