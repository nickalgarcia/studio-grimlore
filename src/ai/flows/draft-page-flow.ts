/**
 * @fileOverview Drafts a stub Page from what the recaps say about it: a lede,
 * the two kind-specific sections, and (for people and threads) a per-issue
 * history. A draft for the DM to edit before it is saved.
 */

import { callClaudeJson } from '@/ai/anthropic-client';
import { z } from 'zod';
import { FlowInputError } from '@/ai/errors';

export const DraftPageInputSchema = z.object({
  campaignName: z.string().max(200),
  kind: z.enum(['npc', 'faction', 'place', 'thread']),
  name: z.string().max(200),
  /** Whatever the page already says, so the draft builds on it rather than contradicting it. */
  known: z.string().max(4_000).optional(),
  excerpts: z.array(z.object({
    session: z.number().int().min(0).max(10_000),
    text: z.string().max(2_500),
  })).min(1, 'No recap mentions this yet, so there is nothing to draft from.').max(12),
});
export type DraftPageInput = z.infer<typeof DraftPageInputSchema>;

export type DraftPageOutput = {
  lede: string;
  /** npc: wants now · faction: agenda now · place: what's known · thread: where it stands */
  primary: string;
  /** npc: knows · faction: what they know · place: unused · thread: what each side offers */
  secondary: string;
  history: { session: number; text: string }[];
};

const SECTIONS: Record<DraftPageInput['kind'], { primary: string; secondary: string; history: boolean }> = {
  npc: { primary: 'what they want right now', secondary: 'what they know (about the party, the plot)', history: true },
  faction: { primary: 'their agenda right now', secondary: 'what they know about the party', history: false },
  place: { primary: "what's known about it", secondary: '(leave empty)', history: false },
  thread: { primary: 'where it stands now', secondary: 'what each side offers or wants', history: true },
};

const clip = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

export async function draftPage(input: DraftPageInput): Promise<DraftPageOutput> {
  const parsed = DraftPageInputSchema.safeParse(input);
  if (!parsed.success) throw new FlowInputError(parsed.error.errors[0]?.message ?? 'Invalid input');
  const { campaignName, kind, name, known, excerpts } = parsed.data;
  const spec = SECTIONS[kind];

  const prompt = `Campaign: ${campaignName}
Page: ${name} (${kind})
${known ? `Already on the page:\n${known}\n` : ''}
Every recap passage that mentions it, oldest first:
${excerpts.map(e => `[Issue #${e.session}]\n${e.text}`).join('\n\n')}

Draft this wiki page from those passages only.
- "lede": one italic-style sentence that says who or what this is.
- "primary": ${spec.primary}. 1-3 sentences.
- "secondary": ${spec.secondary}. 1-3 sentences.
${spec.history ? '- "history": one row per issue above where something happened to or with it: {"session": N, "text": "<one sentence>"}.' : '- "history": [].'}
Use "" for anything the passages don't support. Never invent facts.

Return ONLY this JSON, no fences:
{"lede": "...", "primary": "...", "secondary": "...", "history": []}`;

  const result = await callClaudeJson<Partial<DraftPageOutput>>({
    system: 'You keep the wiki for a tabletop campaign. You are accurate first and evocative second.',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 1200,
  });

  const sessions = new Set(excerpts.map(e => e.session));
  return {
    lede: clip(result.lede, 300),
    primary: clip(result.primary, 1_500),
    secondary: kind === 'place' ? '' : clip(result.secondary, 1_500),
    history: spec.history && Array.isArray(result.history)
      ? result.history
        .map(h => ({ session: Number(h?.session), text: clip(h?.text, 300) }))
        // Only issues it was actually given, so a hallucinated "#9" can't appear.
        .filter(h => sessions.has(h.session) && h.text)
        .slice(0, 12)
      : [],
  };
}
