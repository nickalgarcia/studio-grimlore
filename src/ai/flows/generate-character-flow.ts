
'use server';

/**
 * @fileOverview A flow that generates a detailed D&D character from a user prompt.
 *
 * - generateCharacter - A function that generates a character.
 * - GenerateCharacterInput - The input type for the generateCharacter function.
 * - GenerateCharacterOutput - The return type for the generateCharacter function.
 */

import OpenAI from 'openai';
import { z } from 'genkit';

const MODEL = 'gpt-4';

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
  const parsed = GenerateCharacterInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    project: process.env.OPENAI_PROJECT_ID,
    organization: process.env.OPENAI_ORG_ID,
  });

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.8,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert Dungeon Master. Generate a D&D character with name, species, class, originCity, and a rich backstory. No mechanics or stats. Return only JSON with fields: name, species, class, backstory, originCity.',
      },
      {
        role: 'user',
        content: `Campaign Context:\n${parsed.data.campaignContext}\n\nPlayer concept:\n${parsed.data.prompt}\n\nReturn a JSON object with fields: name, species, class, backstory, originCity (optional).`,
      },
    ],
  });

  const json = completion.choices[0]?.message?.content;
  if (!json) throw new Error('No content returned from model');
  try {
    return GenerateCharacterOutputSchema.parse(JSON.parse(json));
  } catch {
    // Fallback: best-effort parse into fields if the model did not return strict JSON.
    return GenerateCharacterOutputSchema.parse({
      name: 'Generated Character',
      species: '',
      class: '',
      backstory: json,
      originCity: undefined,
    });
  }
}
