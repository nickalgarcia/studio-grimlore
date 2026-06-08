'use server';

/**
 * @fileOverview A flow that generates random prompts to inspire Dungeon Masters.
 *
 * - generateInspirationPrompt - A function that generates a random prompt.
 * - InspirationPromptOutput - The return type for the generateInspirationPrompt function.
 */

import { callClaudeJson } from '@/ai/anthropic-client';
import { z } from 'genkit';

const InspirationPromptOutputSchema = z.object({
  prompt: z.string().describe('A random prompt to inspire the Dungeon Master.'),
});
export type InspirationPromptOutput = z.infer<typeof InspirationPromptOutputSchema>;

export async function generateInspirationPrompt(): Promise<InspirationPromptOutput> {
  const result = await callClaudeJson<InspirationPromptOutput>({
    system:
      'You are a D&D creative writing assistant for Dungeon Masters. Generate a single, vivid prompt that inspires plot hooks, encounter ideas, or NPC concepts. Return only JSON with a "prompt" field.',
    messages: [{ role: 'user', content: 'Give me one random prompt for a DM.' }],
    temperature: 0.9,
  });

  try {
    return InspirationPromptOutputSchema.parse(result);
  } catch {
    return { prompt: String(result) };
  }
}
