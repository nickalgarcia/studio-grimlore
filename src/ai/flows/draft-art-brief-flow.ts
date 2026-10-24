/**
 * @fileOverview Turns a recap, a panel caption or a prep scene into a brief
 * for one illustration, and picks which characters (at most four) belong in
 * it. A draft: the DM edits it in the Generate dialog before anything is drawn.
 */

import { callClaudeJson } from '@/ai/anthropic-client';
import { z } from 'zod';
import { FlowInputError } from '@/ai/errors';
import { ART_KINDS, ART_LABEL, MAX_CAST, type ArtKind } from '@/lib/art';

export const DraftArtBriefInputSchema = z.object({
  kind: z.enum(ART_KINDS),
  campaignName: z.string().max(200),
  /** "Issue #9: The Warden's Door", "Scene 2 · Pressure", an NPC's name. */
  title: z.string().max(200).optional(),
  /** A panel's caption: the brief must show exactly this moment. */
  caption: z.string().max(400).optional(),
  context: z.string().trim().min(1, 'There is nothing written here to draw from yet.').max(16_000),
  /** Names the brief may use: the characters and NPCs the app has. */
  castNames: z.array(z.string().max(120)).max(60),
});
export type DraftArtBriefInput = z.infer<typeof DraftArtBriefInputSchema>;
export type DraftArtBriefOutput = { brief: string; cast: string[] };

const AIM: Record<ArtKind, string> = {
  cover: 'The issue\'s single most iconic moment, or the question it leaves hanging. One focal point.',
  teaser: 'The next issue\'s mood and place. The players can see this screen at the table, so show no outcome, '
    + 'no twist and nothing they have not already seen.',
  panel: 'Exactly the moment in the caption, nothing before or after it.',
  scene: 'The location and its mood as the party walks in. No plot reveals, figures small or absent.',
  portrait: 'The character as they would pose for a portrait: expression, bearing and signature gear.',
  place: 'The location as the party first sees it.',
  faction: 'What the faction looks like from outside: its people, banners or seat of power.',
};

export async function draftArtBrief(input: DraftArtBriefInput): Promise<DraftArtBriefOutput> {
  const parsed = DraftArtBriefInputSchema.safeParse(input);
  if (!parsed.success) throw new FlowInputError(parsed.error.errors[0]?.message ?? 'Invalid input');
  const { kind, campaignName, title, caption, context, castNames } = parsed.data;

  const prompt = `Campaign: ${campaignName}
Image: ${ART_LABEL[kind]}${title ? ` for ${title}` : ''}
${caption ? `Panel caption: ${caption}\n` : ''}
Source:
${context}

Named characters with reference art: ${castNames.length ? castNames.join(', ') : '(none)'}

Write the brief for one illustration. Aim: ${AIM[kind]}

The brief is 2 to 4 sentences of concrete visual description for an artist: who is where doing
what, the camera (wide, medium or close; the angle), the light and the mood. Use names only from
the list above; describe anyone else instead of naming them. At most ${MAX_CAST} named characters,
fewer is better. Never invent events that are not in the source.

Return ONLY this JSON, no fences:
{"brief": "...", "cast": ["Name", "..."]}`;

  const result = await callClaudeJson<{ brief?: unknown; cast?: unknown }>({
    system: 'You art-direct a comic series adapted from a tabletop campaign. You write briefs an illustrator can draw from without reading the source.',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 500,
  });

  const brief = String(result.brief ?? '').trim().slice(0, 2_000);
  if (!brief) throw new Error('The brief came back empty.');

  // Keep only names the app knows, in its own spelling, so the dialog can match them to portraits.
  const known = new Map(castNames.map(n => [n.trim().toLowerCase(), n]));
  const cast = [...new Set((Array.isArray(result.cast) ? result.cast : [])
    .map(n => known.get(String(n).trim().toLowerCase()))
    .filter((n): n is string => !!n))]
    .slice(0, MAX_CAST);

  return { brief, cast };
}
