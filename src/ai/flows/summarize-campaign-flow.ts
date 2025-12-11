
'use server';

/**
 * @fileOverview A flow that summarizes a D&D campaign based on its description, characters, and session logs.
 *
 * - summarizeCampaign - A function that generates a campaign summary.
 * - SummarizeCampaignInput - The input type for the summarizeCampaign function.
 * - SummarizeCampaignOutput - The return type for the summarizeCampaign function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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
  return summarizeCampaignFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeCampaignPrompt',
  input: {schema: SummarizeCampaignInputSchema},
  output: {schema: SummarizeCampaignOutputSchema},
  prompt: `You are a master storyteller and campaign chronicler for Dungeons & Dragons. Your task is to create a "living summary" of a campaign, weaving together all available information into a compelling narrative recap.

  Use the campaign name, description, character backstories, and all session logs to generate a comprehensive summary. This summary should feel like a "Previously on..." segment of a TV show, catching the reader up on the most important plot points, character arcs, and unresolved mysteries.

  **Campaign:** {{{campaignName}}}
  *Description:* {{{campaignDescription}}}

  **The Heroes:**
  {{#each characters}}
  - **{{name}}** ({{species}} {{class}}): {{{backstory}}}
  {{/each}}

  **The Chronicle So Far (Session Logs):**
  {{#each sessions}}
  *Session {{sessionNumber}}:* {{{summary}}}
  ---
  {{/each}}

  Based on all of the above, synthesize the story into a single, engaging narrative summary.
  `,
});

const summarizeCampaignFlow = ai.defineFlow(
  {
    name: 'summarizeCampaignFlow',
    inputSchema: SummarizeCampaignInputSchema,
    outputSchema: SummarizeCampaignOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

