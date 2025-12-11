'use server';

/**
 * @fileOverview A flow that generates random prompts to inspire Dungeon Masters.
 *
 * - generateInspirationPrompt - A function that generates a random prompt.
 * - InspirationPromptOutput - The return type for the generateInspirationPrompt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const InspirationPromptOutputSchema = z.object({
  prompt: z.string().describe('A random prompt to inspire the Dungeon Master.'),
});
export type InspirationPromptOutput = z.infer<typeof InspirationPromptOutputSchema>;

export async function generateInspirationPrompt(): Promise<InspirationPromptOutput> {
  return generateInspirationPromptFlow();
}

const prompt = ai.definePrompt({
  name: 'inspirationPromptPrompt',
  output: {schema: InspirationPromptOutputSchema},
  prompt: `You are a D&D creative writing assistant for dungeon masters.

Generate a random prompt to inspire the Dungeon Master. This prompt should be open-ended and encourage creative thinking about plot hooks, encounter ideas, or NPC concepts.

Output:
Prompt:`, // Ensure the output is prefixed with "Prompt:"
});

const generateInspirationPromptFlow = ai.defineFlow({
  name: 'generateInspirationPromptFlow',
  outputSchema: InspirationPromptOutputSchema,
}, async () => {
  const {output} = await prompt({});
  return output!;
});
