/**
 * @fileOverview Generates a polished session recap from raw DM notes
 * and the Live Session conversation history.
 *
 * Called at the end of a session — takes everything that happened
 * and writes a "Previously on..." style recap ready to save as a session log.
 */

import { callClaude } from '@/ai/anthropic-client';
import { z } from 'zod';

export const GenerateSessionRecapInputSchema = z.object({
  campaignName: z.string(),
  sessionNumber: z.number(),
  dmNotes: z.string().describe('Raw notes the DM typed during the session.'),
  conversationHighlights: z.string().optional().describe('Key exchanges from the Live Session AI conversation.'),
  characters: z.array(z.object({ name: z.string(), class: z.string().optional() })).optional(),
  previousSummary: z.string().optional().describe('The existing campaign summary for continuity.'),
});
export type GenerateSessionRecapInput = z.infer<typeof GenerateSessionRecapInputSchema>;

export type GenerateSessionRecapOutput = {
  recap: string;
};

export async function generateSessionRecap(
  input: GenerateSessionRecapInput
): Promise<GenerateSessionRecapOutput> {
  const parsed = GenerateSessionRecapInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input');

  const { campaignName, sessionNumber, dmNotes, conversationHighlights, characters, previousSummary } = parsed.data;

  const sections: string[] = [
    `Campaign: ${campaignName}`,
    `Session Number: ${sessionNumber}`,
  ];

  if (characters?.length) {
    sections.push(`Active Characters: ${characters.map(c => `${c.name}${c.class ? ` (${c.class})` : ''}`).join(', ')}`);
  }

  if (previousSummary) {
    sections.push(`Previous Story So Far:\n${previousSummary.slice(0, 600)}`);
  }

  sections.push(`DM's Raw Session Notes:\n${dmNotes}`);

  if (conversationHighlights) {
    sections.push(`Key Moments from Session AI Log:\n${conversationHighlights}`);
  }

  sections.push(`
Write a polished session recap in the style of a "Previously on ${campaignName}..." segment.
- 2-4 paragraphs of vivid narrative prose
- Use character names, not pronouns alone  
- Capture decisions made, consequences triggered, and any new mysteries introduced
- End with the current situation the party is in
- Write in past tense, storytelling voice
- No bullet points — pure narrative prose`);

  const recap = await callClaude({
    system: `You are a master campaign chronicler for tabletop RPGs. 
You transform raw session notes into compelling narrative recaps that make players excited to return to the table.
Write with literary flair — specific details, vivid verbs, emotional resonance.
Never invent facts not present in the notes. Extrapolate tone, not events.`,
    messages: [{ role: 'user', content: sections.join('\n\n') }],
    temperature: 0.7,
    max_tokens: 800,
  });

  return { recap };
}
