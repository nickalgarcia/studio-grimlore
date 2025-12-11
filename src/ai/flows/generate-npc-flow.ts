'use server';

/**
 * @fileOverview A flow that generates a detailed Non-Player Character (NPC).
 *
 * - generateNpc - A function that generates an NPC.
 * - GenerateNpcInput - The input type for the generateNpc function.
 * - GenerateNpcOutput - The return type for the generateNpc function.
 */

import { getOpenAIClient, MODEL } from '@/ai/openai-client';
import { z } from 'genkit';

const GenerateNpcInputSchema = z.object({
  campaignContext: z
    .string()
    .describe('A summary of the campaign and recent events.'),
  locationContext: z.string().optional().describe('The specific location or situation where the NPC is needed (e.g., "a tavern in a port city", "a guard at a castle gate").')
});
export type GenerateNpcInput = z.infer<typeof GenerateNpcInputSchema>;

const GenerateNpcOutputSchema = z.object({
  name: z.string().describe('The full name of the NPC.'),
  description: z.string().describe("A rich description of the NPC's appearance, personality, mannerisms, and a brief backstory."),
  location: z.string().describe("The NPC's likely location or where they were generated.").optional(),
});
export type GenerateNpcOutput = z.infer<typeof GenerateNpcOutputSchema>;

export async function generateNpc(
  input: GenerateNpcInput
): Promise<GenerateNpcOutput> {
  const parsed = GenerateNpcInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.8,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert Dungeon Master creating a vivid NPC with name, description, and location if applicable. Include appearance, personality, brief backstory, and a potential secret or motivation. Return only JSON with fields: name, description, location (optional).',
      },
      {
        role: 'user',
        content: `Campaign context:\n${parsed.data.campaignContext}\n\nLocation/situation: ${parsed.data.locationContext || 'unspecified'}\n\nReturn JSON with fields: name, description, location (optional).`,
      },
    ],
  });

  const json = completion.choices[0]?.message?.content;
  if (!json) throw new Error('No content returned from model');
  try {
    const parsedJson = GenerateNpcOutputSchema.parse(JSON.parse(json));
    if (parsed.data.locationContext && !parsedJson.location) {
      parsedJson.location = parsed.data.locationContext;
    }
    return parsedJson;
  } catch {
    return GenerateNpcOutputSchema.parse({
      name: 'Generated NPC',
      description: json,
      location: parsed.data.locationContext,
    });
  }
}
