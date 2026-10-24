/**
 * @fileOverview Drafts an issue's three-panel strip: two or three caption
 * beats, at most one of them a "word" panel. A draft for the DM to edit; it is
 * never saved without them.
 */

import { callClaudeJson } from '@/ai/anthropic-client';
import { z } from 'zod';
import { FlowInputError } from '@/ai/errors';

export const DraftBeatsInputSchema = z.object({
  campaignName: z.string().max(200),
  sessionNumber: z.number().int().min(0).max(10_000),
  title: z.string().max(200).optional(),
  logline: z.string().max(400).optional(),
  recap: z.string().min(1, 'This issue has no recap to draw from yet.').max(16_000),
});
export type DraftBeatsInput = z.infer<typeof DraftBeatsInputSchema>;

export type DraftBeat = { kind: 'image' | 'word'; caption: string; word?: string };
export type DraftBeatsOutput = { beats: DraftBeat[] };

export async function draftBeats(input: DraftBeatsInput): Promise<DraftBeatsOutput> {
  const parsed = DraftBeatsInputSchema.safeParse(input);
  if (!parsed.success) throw new FlowInputError(parsed.error.errors[0]?.message ?? 'Invalid input');
  const { campaignName, sessionNumber, title, logline, recap } = parsed.data;

  const prompt = `Campaign: ${campaignName}
Issue #${sessionNumber}${title ? `: ${title}` : ''}
${logline ? `Logline: ${logline}\n` : ''}
Recap:
${recap}

Break this issue into exactly three comic panels, in story order: the setup, the turn, the
cliffhanger. Each panel has a caption box, written like a comic narrator: present tense,
terse, 6-18 words, no quotation marks.

Two panels are "image" panels (the DM will draw or find art for them). Exactly one, usually
the turn or the cliffhanger, is a "word" panel: one huge word or two-word phrase, uppercase,
ending in punctuation, like "BETRAYED." or "THE KEY!". Only word panels have a "word".

Return ONLY this JSON, no fences:
{"beats": [{"kind": "image", "caption": "..."}, {"kind": "word", "caption": "...", "word": "..."}, {"kind": "image", "caption": "..."}]}`;

  const result = await callClaudeJson<{ beats?: Partial<DraftBeat>[] }>({
    system: 'You storyboard tabletop sessions as comic pages. You never invent events that are not in the recap.',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 500,
  });

  const beats = (Array.isArray(result.beats) ? result.beats : [])
    .slice(0, 3)
    .map((b): DraftBeat => {
      const caption = String(b.caption ?? '').trim().slice(0, 200);
      const word = String(b.word ?? '').trim().toUpperCase().slice(0, 28);
      return b.kind === 'word' && word ? { kind: 'word', caption, word } : { kind: 'image', caption };
    })
    .filter(b => b.caption || b.word);

  if (beats.length === 0) throw new Error('The draft came back empty.');
  return { beats };
}
