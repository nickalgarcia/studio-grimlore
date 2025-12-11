'use server';

/**
 * @fileOverview Generates context-sensitive plot hooks, encounter ideas, NPC concepts, and dialog snippets based on party actions.
 *
 * - generateContextSensitiveIdeas - A function that generates ideas based on input.
 * - GenerateContextSensitiveIdeasInput - The input type for the generateContextSensitiveIdeas function.
 * - GenerateContextSensitiveIdeasOutput - The return type for the generateContextSensitiveIdeas function.
 */

import OpenAI from 'openai';
import { z } from 'genkit';

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
  dialogIdea: z.string().describe("A snippet of dialog an NPC might say in response to the party's actions."),
});
export type GenerateContextSensitiveIdeasOutput = z.infer<
  typeof GenerateContextSensitiveIdeasOutputSchema
>;

const MODEL = 'gpt-4';

export async function generateContextSensitiveIdeas(
  input: GenerateContextSensitiveIdeasInput
): Promise<GenerateContextSensitiveIdeasOutput> {
  const parsed = GenerateContextSensitiveIdeasInputSchema.safeParse(input);
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
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content:
          'You are an experienced Dungeon Master helping another DM generate ideas. PRIORITIZE the Recent Party Actions section; use campaign/character context only as flavor. If there is any conflict, follow Recent Party Actions. Respond with JSON only: plotHook, encounterIdea, npcConcept, dialogIdea.',
      },
      {
        role: 'user',
        content: `Context:\n${parsed.data.partyActions}\n\nReturn JSON with keys: plotHook, encounterIdea, npcConcept, dialogIdea.`,
      },
    ],
  });

  const json = completion.choices[0]?.message?.content;
  if (!json) throw new Error('No content returned from model');
  try {
    const parsedJson = GenerateContextSensitiveIdeasOutputSchema.parse(JSON.parse(json));
    return parsedJson;
  } catch {
    // Fallback: attempt to extract fields from plain text
    return GenerateContextSensitiveIdeasOutputSchema.parse({
      plotHook: json,
      encounterIdea: json,
      npcConcept: json,
      dialogIdea: json,
    });
  }
}
