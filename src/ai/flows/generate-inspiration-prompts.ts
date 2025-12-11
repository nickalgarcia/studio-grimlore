'use server';

/**
 * @fileOverview A flow that generates random prompts to inspire Dungeon Masters.
 *
 * - generateInspirationPrompt - A function that generates a random prompt.
 * - InspirationPromptOutput - The return type for the generateInspirationPrompt function.
 */

import OpenAI from 'openai';
import { z } from 'genkit';

const InspirationPromptOutputSchema = z.object({
  prompt: z.string().describe('A random prompt to inspire the Dungeon Master.'),
});
export type InspirationPromptOutput = z.infer<typeof InspirationPromptOutputSchema>;

const MODEL = 'gpt-4';

export async function generateInspirationPrompt(): Promise<InspirationPromptOutput> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    project: process.env.OPENAI_PROJECT_ID,
    organization: process.env.OPENAI_ORG_ID,
  });

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.9,
    messages: [
      {
        role: 'system',
        content:
          'You are a D&D creative writing assistant for Dungeon Masters. Generate a single, vivid prompt that inspires plot hooks, encounter ideas, or NPC concepts. Return only JSON with a "prompt" field.',
      },
      { role: 'user', content: 'Give me one random prompt for a DM.' },
    ],
  });

  const json = completion.choices[0]?.message?.content;
  if (!json) throw new Error('No content returned from model');
  try {
    return InspirationPromptOutputSchema.parse(JSON.parse(json));
  } catch {
    return { prompt: json };
  }
}
