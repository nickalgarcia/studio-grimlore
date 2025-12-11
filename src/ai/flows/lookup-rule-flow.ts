'use server';

/**
 * @fileOverview A flow that looks up and explains D&D 5e rules.
 *
 * - lookupRule - A function that fetches a rule explanation.
 * - LookupRuleInput - The input type for the lookupRule function.
 * - LookupRuleOutput - The return type for the lookupRule function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const LookupRuleInputSchema = z.object({
  term: z.string().describe('The D&D 5e rule, condition, or term to be explained.'),
});
export type LookupRuleInput = z.infer<typeof LookupRuleInputSchema>;

const LookupRuleOutputSchema = z.object({
  explanation: z.string().describe('A clear and concise explanation of the D&D 5e rule or term.'),
});
export type LookupRuleOutput = z.infer<typeof LookupRuleOutputSchema>;

export async function lookupRule(
  input: LookupRuleInput
): Promise<LookupRuleOutput> {
  return lookupRuleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'lookupRulePrompt',
  input: {schema: LookupRuleInputSchema},
  output: {schema: LookupRuleOutputSchema},
  prompt: `You are an expert D&D 5th Edition Dungeon Master. A user will provide a game term, rule, or condition, and you must provide a clear, concise, and accurate explanation for it based on the official rules.

  Format your answer clearly, using markdown for structure if needed (like bullet points for lists).

  Rule to explain: {{term}}
  `,
});

const lookupRuleFlow = ai.defineFlow(
  {
    name: 'lookupRuleFlow',
    inputSchema: LookupRuleInputSchema,
    outputSchema: LookupRuleOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
