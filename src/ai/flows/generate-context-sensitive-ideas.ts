/**
 * @fileOverview Generates context-sensitive plot hooks, encounter ideas, NPC concepts,
 * and dialog snippets — fully campaign-aware, powered by Claude.
 *
 * Key improvement over the original: accepts full campaign lore, all session history,
 * active NPCs, current location, and faction context so ideas feel native to *your* world.
 */

import { callClaudeJson } from '@/ai/anthropic-client';
import { z } from 'zod';

export const GenerateContextSensitiveIdeasInputSchema = z.object({
  // What's happening RIGHT NOW at the table
  partyActions: z
    .string()
    .min(1)
    .describe("The DM's description of what's happening this moment — the unexpected event, player choice, or situation they need help with."),

  // Campaign identity
  campaignName: z.string().optional(),
  campaignDescription: z.string().optional(),
  currentLocation: z.string().optional().describe('Where the party is right now (e.g., "Mirathen, a ruined city in the Sunscar Basin").'),

  // History — all sessions, not just 3
  sessionLog: z
    .string()
    .optional()
    .describe('Full session history as a single string, newest first.'),

  // Cast
  characters: z
    .array(z.object({ name: z.string(), class: z.string().optional(), species: z.string().optional(), backstory: z.string().optional() }))
    .optional(),
  activeNpcs: z
    .array(z.object({ name: z.string(), description: z.string().optional(), location: z.string().optional() }))
    .optional(),

  // World context
  factionContext: z.string().optional().describe('Active factions and their current agendas.'),
  loreContext: z.string().optional().describe('Relevant world lore, geography, or cosmology.'),
  activePlotThreads: z.string().optional().describe('Current unresolved plot threads and character arcs.'),
});
export type GenerateContextSensitiveIdeasInput = z.infer<typeof GenerateContextSensitiveIdeasInputSchema>;

const GenerateContextSensitiveIdeasOutputSchema = z.object({
  plotHook: z.string().describe('A plot hook that grows organically from the current situation and existing campaign threads.'),
  encounterIdea: z.string().describe('A tactically and narratively interesting encounter idea grounded in this world.'),
  npcConcept: z.string().describe('An NPC concept with a name, brief appearance, and a clear motivation tied to the current scene.'),
  dialogIdea: z.string().describe("A specific line of dialog an NPC might say — evocative and world-specific, not generic."),
  dmNote: z.string().describe('A short private DM note: a consequence, foreshadowing opportunity, or callback to a past session the DM could weave in.'),
});
export type GenerateContextSensitiveIdeasOutput = z.infer<typeof GenerateContextSensitiveIdeasOutputSchema>;

export async function generateContextSensitiveIdeas(
  input: GenerateContextSensitiveIdeasInput
): Promise<GenerateContextSensitiveIdeasOutput> {
  const parsed = GenerateContextSensitiveIdeasInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  const {
    partyActions,
    campaignName,
    campaignDescription,
    currentLocation,
    sessionLog,
    characters,
    activeNpcs,
    factionContext,
    loreContext,
    activePlotThreads,
  } = parsed.data;

  // Build a rich context block — Claude thrives on structure
  const contextSections: string[] = [];

  if (campaignName) contextSections.push(`CAMPAIGN: ${campaignName}`);
  if (campaignDescription) contextSections.push(`PREMISE: ${campaignDescription}`);
  if (currentLocation) contextSections.push(`CURRENT LOCATION: ${currentLocation}`);

  if (characters?.length) {
    contextSections.push(
      `PLAYER CHARACTERS:\n${characters
        .map(c => `- ${c.name}${c.class ? ` (${c.class})` : ''}${c.species ? ` [${c.species}]` : ''}${c.backstory ? `: ${c.backstory}` : ''}`)
        .join('\n')}`
    );
  }

  if (activeNpcs?.length) {
    contextSections.push(
      `ACTIVE NPCs IN PLAY:\n${activeNpcs
        .map(n => `- ${n.name}${n.location ? ` @ ${n.location}` : ''}${n.description ? `: ${n.description}` : ''}`)
        .join('\n')}`
    );
  }

  if (factionContext) contextSections.push(`ACTIVE FACTIONS:\n${factionContext}`);
  if (activePlotThreads) contextSections.push(`OPEN PLOT THREADS:\n${activePlotThreads}`);
  if (loreContext) contextSections.push(`WORLD LORE:\n${loreContext}`);
  if (sessionLog) contextSections.push(`SESSION HISTORY (newest first):\n${sessionLog}`);

  const systemPrompt = `You are a seasoned Dungeon Master collaborating live with another DM during an active session. 
Your job is to generate ideas that feel NATIVE to this specific campaign — not generic D&D filler. 
Every suggestion must use proper nouns, locations, and NPCs from the campaign context provided.
If a plot thread, faction, or character arc is mentioned in context, find a way to weave it in.
Respond ONLY with a valid JSON object matching this exact shape:
{
  "plotHook": string,
  "encounterIdea": string,
  "npcConcept": string,
  "dialogIdea": string,
  "dmNote": string
}
No preamble. No markdown. Raw JSON only.`;

  const userPrompt = `${contextSections.join('\n\n')}

---
WHAT'S HAPPENING RIGHT NOW (prioritize this above all else):
${partyActions}

Generate ideas that are specific, evocative, and immediately usable at the table.`;

  return callClaudeJson<GenerateContextSensitiveIdeasOutput>({
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    temperature: 0.8,
    max_tokens: 1500,
  });
}
