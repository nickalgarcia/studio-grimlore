'use server';

/**
 * @fileOverview Generates context-sensitive plot hooks, encounter ideas, NPC concepts, and dialog snippets based on party actions.
 *
 * - generateContextSensitiveIdeas - A function that generates ideas based on input.
 * - GenerateContextSensitiveIdeasInput - The input type for the generateContextSensitiveIdeas function.
 * - GenerateContextSensitiveIdeasOutput - The return type for the generateContextSensitiveIdeas function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateContextSensitiveIdeasInputSchema = z.object({
  partyActions: z
    .string()
    .describe("A description of the party's recent actions and decisions, potentially including the entire campaign log."),
});
export type GenerateContextSensitiveIdeasInput = z.infer<
  typeof GenerateContextSensitiveIdeasInputSchema
>;

const GenerateContextSensitiveIdeasOutputSchema = z.object({
  plotHook: z.string().describe('A plot hook based on the party actions and campaign log.'),
  encounterIdea: z.string().describe('An encounter idea based on the party actions and campaign log.'),
  npcConcept: z.string().describe('An NPC concept based on the party actions and campaign log.'),
  dialogIdea: z.string().describe('A snippet of dialog an NPC might say in response to the party\'s actions.'),
});
export type GenerateContextSensitiveIdeasOutput = z.infer<
  typeof GenerateContextSensitiveIdeasOutputSchema
>;

export async function generateContextSensitiveIdeas(
  input: GenerateContextSensitiveIdeasInput
): Promise<GenerateContextSensitiveIdeasOutput> {
  return generateContextSensitiveIdeasFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateContextSensitiveIdeasPrompt',
  input: {schema: GenerateContextSensitiveIdeasInputSchema},
  output: {schema: GenerateContextSensitiveIdeasOutputSchema},
  prompt: `You are an experienced Dungeon Master helping another DM generate ideas for their D&D campaign.

  You have been provided with a log of the campaign so far, and a description of the party's most recent actions.
  {{partyActions}}

  Based on all of this context, generate a plot hook, an encounter idea, an NPC concept, and a snippet of dialogue that the DM can use in their next session.

  The plotHook, encounterIdea, npcConcept, and dialogIdea values should be compelling and creative, and appropriately related to the provided context.
  `,
});

const generateContextSensitiveIdeasFlow = ai.defineFlow(
  {
    name: 'generateContextSensitiveIdeasFlow',
    inputSchema: GenerateContextSensitiveIdeasInputSchema,
    outputSchema: GenerateContextSensitiveIdeasOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
