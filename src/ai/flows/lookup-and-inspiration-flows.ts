// ============================================================
// Rule Lookup Flow
// ============================================================

import { callClaude, callClaudeJson } from '@/ai/anthropic-client';
import { z } from 'zod';

export const LookupRuleOutputSchema = z.object({
  explanation: z.string(),
});
export type LookupRuleOutput = z.infer<typeof LookupRuleOutputSchema>;

export async function lookupRule(input: { term: string }): Promise<LookupRuleOutput> {
  if (!input.term.trim()) throw new Error('Enter a rule, condition, or term to explain.');

  const explanation = await callClaude({
    system: `You are an expert D&D 5th Edition Dungeon Master. 
Provide clear, accurate explanations of rules and terms. 
Use short paragraphs and bullet points where helpful.
Be practical — include when the rule matters most at the table, common edge cases, and any important DM rulings.`,
    messages: [{ role: 'user', content: `Explain the D&D 5e rule or term: ${input.term.trim()}` }],
    temperature: 0,
    max_tokens: 600,
  });

  return { explanation };
}

// ============================================================
// Inspiration Prompt Flow
// ============================================================

const InspirationPromptOutputSchema = z.object({
  prompt: z.string(),
  category: z.enum(['Plot Hook', 'Encounter', 'NPC', 'Location', 'Complication']),
  tags: z.array(z.string()),
});
export type InspirationPromptOutput = z.infer<typeof InspirationPromptOutputSchema>;

export async function generateInspirationPrompt(): Promise<InspirationPromptOutput> {
  return callClaudeJson<InspirationPromptOutput>({
    system: `You are a D&D creative writing assistant. Generate a single, specific, vivid prompt for a Dungeon Master.
The prompt should spark immediate creative ideas — not generic tropes, but surprising twists or specific setups.
Return ONLY raw JSON with fields: prompt (string), category (one of: Plot Hook, Encounter, NPC, Location, Complication), tags (array of 2-4 short strings).`,
    messages: [{ role: 'user', content: 'Give me one surprising, specific D&D inspiration prompt.' }],
    temperature: 0.95,
    max_tokens: 300,
  });
}
