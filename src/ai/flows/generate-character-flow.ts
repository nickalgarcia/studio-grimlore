
'use server';

/**
 * @fileOverview A flow that generates a detailed D&D character from a user prompt.
 *
 * - generateCharacter - A function that generates a character.
 * - GenerateCharacterInput - The input type for the generateCharacter function.
 * - GenerateCharacterOutput - The return type for the generateCharacter function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCharacterInputSchema = z.object({
  campaignContext: z
    .string()
    .describe('A summary of the campaign setting, tone, and any relevant world details.'),
  prompt: z
    .string()
    .describe('The user\'s initial concept for the character (e.g., "a haunted elf rogue who is on the run after a heist went wrong").'),
});
export type GenerateCharacterInput = z.infer<typeof GenerateCharacterInputSchema>;

const GenerateCharacterOutputSchema = z.object({
  name: z.string().describe("The character's full name. It should be creative and fitting for a fantasy setting."),
  species: z.string().describe("The character's species (e.g., Human, Elf, Dwarf, Dragonborn). Should be based on the user's prompt if provided, otherwise chosen to fit the concept."),
  class: z.string().describe("The character's class (e.g., Fighter, Wizard, Rogue). Should be based on the user's prompt if provided, otherwise chosen to fit the concept."),
  backstory: z.string().describe("A detailed backstory for the character, incorporating the user's prompt and adding creative details. Should be at least 3-4 paragraphs."),
  originCity: z.string().optional().describe("The character's city of origin, if it can be inferred or is creatively appropriate."),
});
export type GenerateCharacterOutput = z.infer<typeof GenerateCharacterOutputSchema>;

export async function generateCharacter(
  input: GenerateCharacterInput
): Promise<GenerateCharacterOutput> {
  return generateCharacterFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCharacterPrompt',
  input: {schema: GenerateCharacterInputSchema},
  output: {schema: GenerateCharacterOutputSchema},
  prompt: `You are an expert Dungeon Master tasked with co-creating a new Dungeons & Dragons character with a player.

  The player has provided an initial concept. Your job is to expand upon it and generate a compelling character that fits into the specified campaign world.

  Flesh out the narrative details of the character, including a creative name, species, class, origin city, and a rich backstory. Do not include game mechanics like stats.

  Campaign Context:
  {{{campaignContext}}}

  Player's Character Concept:
  "{{prompt}}"

  Generate a character based on this information.
  `,
});

const generateCharacterFlow = ai.defineFlow(
  {
    name: 'generateCharacterFlow',
    inputSchema: GenerateCharacterInputSchema,
    outputSchema: GenerateCharacterOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
