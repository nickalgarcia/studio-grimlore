'use server';

/**
 * @fileOverview A flow that looks up and explains D&D 5e rules.
 *
 * - lookupRule - A function that fetches a rule explanation.
 * - LookupRuleInput - The input type for the lookupRule function.
 * - LookupRuleOutput - The return type for the lookupRule function.
 */

import { getOpenAIClient, MODEL } from '@/ai/openai-client';
import { z } from 'genkit';

const LookupRuleInputSchema = z.object({
  term: z
    .string()
    .min(1, 'Enter a rule, condition, or term to explain.')
    .describe('The D&D 5e rule, condition, or term to be explained.'),
});
export type LookupRuleInput = z.infer<typeof LookupRuleInputSchema>;

const LookupRuleOutputSchema = z.object({
  explanation: z.string().describe('A clear and concise explanation of the D&D 5e rule or term.'),
});
export type LookupRuleOutput = z.infer<typeof LookupRuleOutputSchema>;

export async function lookupRule(
  input: LookupRuleInput
): Promise<LookupRuleOutput> {
  const parsed = LookupRuleInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  const term = parsed.data.term.trim();

  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert D&D 5th Edition Dungeon Master. Provide clear, concise, and accurate explanations of rules and terms. Use short paragraphs and bullet points where helpful.',
      },
      { role: 'user', content: `Explain the rule/term: ${term}` },
    ],
    temperature: 0,
  });

  const explanation = completion.choices[0]?.message?.content ?? '';
  return { explanation };
}
