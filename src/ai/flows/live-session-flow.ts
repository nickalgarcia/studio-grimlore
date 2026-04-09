'use server';

/**
 * @fileOverview The Live Session Assistant — a conversational, campaign-aware AI co-DM.
 *
 * This is the core new feature. Unlike the idea generator (one-shot prompts),
 * this flow maintains a conversation history so the DM can ask follow-up questions,
 * iterate on ideas, and get increasingly specific help — all grounded in campaign context.
 *
 * The campaign context is injected once as the system prompt, then the DM types
 * natural language requests like:
 *   "The rogue just pickpocketed a Sundering agent — what happens?"
 *   "Give me a tense NPC for the market district of Mirathen"
 *   "How would Kazar Velthorn react if he found out the party is here?"
 */

import { callClaude } from '@/ai/anthropic-client';
import { z } from 'zod';

export const LiveSessionMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
export type LiveSessionMessage = z.infer<typeof LiveSessionMessageSchema>;

export const LiveSessionInputSchema = z.object({
  // Conversational history — send the full array each time
  messages: z.array(LiveSessionMessageSchema).min(1),

  // Campaign context — built once when the session starts, sent with every request
  campaignContext: z.object({
    campaignName: z.string(),
    campaignDescription: z.string().optional(),
    currentLocation: z.string().optional(),
    sessionNumber: z.number().optional(),
    sessionLog: z.string().optional().describe('Full session history, newest first.'),
    characters: z
      .array(z.object({ name: z.string(), class: z.string().optional(), species: z.string().optional(), backstory: z.string().optional() }))
      .optional(),
    activeNpcs: z
      .array(z.object({ name: z.string(), description: z.string().optional(), location: z.string().optional() }))
      .optional(),
    factionContext: z.string().optional(),
    loreContext: z.string().optional(),
    activePlotThreads: z.string().optional(),
  }),
});
export type LiveSessionInput = z.infer<typeof LiveSessionInputSchema>;

export type LiveSessionOutput = {
  response: string;
};

function buildCampaignSystemPrompt(ctx: LiveSessionInput['campaignContext']): string {
  const sections: string[] = [
    `You are an expert Dungeon Master assisting another DM who is running an active session RIGHT NOW.`,
    `You have complete knowledge of their campaign and should respond as a trusted creative partner.`,
    `Be concise and immediately actionable — the DM is at the table and needs fast, usable ideas.`,
    `Use specific names, locations, and lore from the campaign. Never give generic D&D advice.`,
    `You can answer follow-up questions, iterate on ideas, and build on what was discussed earlier in this conversation.`,
    `Format responses for quick scanning: use short paragraphs, bolded names, and bullet points for options when helpful.`,
    '',
    '=== CAMPAIGN BRIEFING ===',
  ];

  sections.push(`CAMPAIGN: ${ctx.campaignName}`);
  if (ctx.campaignDescription) sections.push(`PREMISE: ${ctx.campaignDescription}`);
  if (ctx.currentLocation) sections.push(`CURRENT LOCATION: ${ctx.currentLocation}`);
  if (ctx.sessionNumber) sections.push(`ACTIVE SESSION: #${ctx.sessionNumber}`);

  if (ctx.characters?.length) {
    sections.push(
      `\nPLAYER CHARACTERS:\n${ctx.characters
        .map(c => `• ${c.name}${c.class ? ` — ${c.class}` : ''}${c.species ? ` (${c.species})` : ''}${c.backstory ? `\n  ${c.backstory}` : ''}`)
        .join('\n')}`
    );
  }

  if (ctx.activeNpcs?.length) {
    sections.push(
      `\nACTIVE NPCs:\n${ctx.activeNpcs
        .map(n => `• ${n.name}${n.location ? ` @ ${n.location}` : ''}${n.description ? `: ${n.description}` : ''}`)
        .join('\n')}`
    );
  }

  if (ctx.activePlotThreads) {
    sections.push(`\nOPEN PLOT THREADS:\n${ctx.activePlotThreads}`);
  }

  if (ctx.factionContext) {
    sections.push(`\nACTIVE FACTIONS:\n${ctx.factionContext}`);
  }

  if (ctx.loreContext) {
    sections.push(`\nWORLD LORE:\n${ctx.loreContext}`);
  }

  if (ctx.sessionLog) {
    sections.push(`\nSESSION HISTORY (newest first):\n${ctx.sessionLog}`);
  }

  return sections.join('\n');
}

export async function runLiveSession(
  input: LiveSessionInput
): Promise<LiveSessionOutput> {
  const parsed = LiveSessionInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  const systemPrompt = buildCampaignSystemPrompt(parsed.data.campaignContext);

  const response = await callClaude({
    system: systemPrompt,
    messages: parsed.data.messages,
    temperature: 0.75,
    max_tokens: 1024,
  });

  return { response };
}
