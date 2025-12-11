
'use server';

/**
 * @fileOverview A flow that summarizes a D&D campaign based on its description, characters, and session logs.
 *
 * - summarizeCampaign - A function that generates a campaign summary.
 * - SummarizeCampaignInput - The input type for the summarizeCampaign function.
 * - SummarizeCampaignOutput - The return type for the summarizeCampaign function.
 */

import OpenAI from 'openai';
import { z } from 'genkit';

const MODEL = 'gpt-4';

const SummarizeCampaignInputSchema = z.object({
  campaignName: z.string().describe("The name of the campaign."),
  campaignDescription: z.string().describe("The overall description of the campaign."),
  sessions: z.array(z.object({
    sessionNumber: z.number(),
    summary: z.string(),
  })).describe("An array of all session logs, in chronological order."),
  characters: z.array(z.object({
    name: z.string(),
    species: z.string().optional(),
    class: z.string().optional(),
    backstory: z.string(),
  })).describe("An array of the player characters in the campaign."),
});
export type SummarizeCampaignInput = z.infer<typeof SummarizeCampaignInputSchema>;

const SummarizeCampaignOutputSchema = z.object({
  campaignSummary: z.string().describe("A comprehensive, narrative summary of the campaign so far. It should synthesize the main plot points from the session logs and connect them to the characters' backstories and the campaign's overall theme. This should read like a 'previously on...' recap of a TV show."),
});
export type SummarizeCampaignOutput = z.infer<typeof SummarizeCampaignOutputSchema>;

export async function summarizeCampaign(
  input: SummarizeCampaignInput
): Promise<SummarizeCampaignOutput> {
  const parsed = SummarizeCampaignInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    project: process.env.OPENAI_PROJECT_ID,
    organization: process.env.OPENAI_ORG_ID,
  });

  const { campaignName, campaignDescription, sessions, characters } = parsed.data;

  const prompt = [
    `Campaign: ${campaignName}`,
    `Description: ${campaignDescription}`,
    '',
    'Heroes:',
    ...characters.map(
      c => `- ${c.name}${c.species ? ` (${c.species}` : ''}${c.class ? `${c.species ? ' ' : ' ('}${c.class}` : ''}${c.species || c.class ? ')' : ''}: ${c.backstory}`
    ),
    '',
    'Session Logs:',
    ...sessions.map(s => `Session ${s.sessionNumber}: ${s.summary}`),
    '',
    'Write a cohesive, engaging recap like a "Previously on..." segment.',
  ].join('\n');

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.6,
    messages: [
      {
        role: 'system',
        content:
          'You are a master storyteller and campaign chronicler for Dungeons & Dragons. Generate a narrative recap that ties plot points and characters together.',
      },
      { role: 'user', content: prompt },
    ],
  });

  const summary = completion.choices[0]?.message?.content ?? '';
  return { campaignSummary: summary };
}
