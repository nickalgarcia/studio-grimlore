'use server';

/**
 * @fileOverview Generates a detailed, campaign-grounded NPC using Claude.
 * Key improvement: NPC motivations, secrets, and speech patterns are tied to
 * the active campaign's factions, lore, and current events.
 */

import { callClaudeJson } from '@/ai/anthropic-client';
import { z } from 'zod';

export const GenerateNpcInputSchema = z.object({
  campaignContext: z.string().describe('A summary of the campaign and recent events.'),
  locationContext: z.string().optional().describe('Where the NPC is encountered.'),
  npcRole: z.string().optional().describe('Optional role hint, e.g. "city guard", "merchant", "cultist".'),
  factionAffiliation: z.string().optional().describe('Optional faction this NPC belongs to.'),
});
export type GenerateNpcInput = z.infer<typeof GenerateNpcInputSchema>;

export const GenerateNpcOutputSchema = z.object({
  name: z.string(),
  appearance: z.string().describe("A vivid 1-2 sentence physical description."),
  personality: z.string().describe("Core personality traits and mannerisms."),
  backstory: z.string().describe("Brief backstory connecting them to the campaign world."),
  motivation: z.string().describe("What do they want right now? What drives them?"),
  secret: z.string().describe("Something they're hiding or that would surprise the party."),
  speechPattern: z.string().describe("A note on how they speak — catchphrase, accent, verbal tic."),
  location: z.string().optional(),
});
export type GenerateNpcOutput = z.infer<typeof GenerateNpcOutputSchema>;

export async function generateNpc(input: GenerateNpcInput): Promise<GenerateNpcOutput> {
  const parsed = GenerateNpcInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input');

  const { campaignContext, locationContext, npcRole, factionAffiliation } = parsed.data;

  const userPrompt = [
    `Campaign context:\n${campaignContext}`,
    locationContext ? `Location: ${locationContext}` : null,
    npcRole ? `Requested NPC role: ${npcRole}` : null,
    factionAffiliation ? `Faction affiliation: ${factionAffiliation}` : null,
    `\nGenerate a vivid, memorable NPC who feels native to this world. 
Their motivation and secret should connect to active campaign events or factions where possible.
Return only a JSON object with fields: name, appearance, personality, backstory, motivation, secret, speechPattern, location (optional).`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return callClaudeJson<GenerateNpcOutput>({
    system: `You are a master Dungeon Master and fiction writer. Create richly detailed NPCs that feel lived-in and specific. 
Every NPC should have a hook that makes them memorable. 
Tie their existence to the campaign world — use faction names, locations, and lore when available.
Return ONLY raw JSON. No preamble, no markdown fences.`,
    messages: [{ role: 'user', content: userPrompt }],
    temperature: 0.85,
    max_tokens: 800,
  });
}
