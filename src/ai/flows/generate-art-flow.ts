/**
 * @fileOverview One illustration from Gemini: the campaign's art direction,
 * reference portraits for up to four named characters, and the DM's brief.
 *
 * Gemini keeps nothing between calls, so everything that makes the art
 * consistent (style text, style reference images, portraits, each
 * character's Look) is sent again on every request.
 */

import 'server-only';
import { z } from 'zod';
import { FlowInputError } from '@/ai/errors';
import { generateGeminiImage, type GeminiPart, type InlineImage } from '@/ai/gemini-client';
import { ART_ASPECT, ART_KINDS, DEFAULT_ART_STYLE, MAX_CAST, MAX_STYLE_REFS, type ArtKind } from '@/lib/art';

const storageUrl = z.string().url().max(2_000);

export const GenerateArtInputSchema = z.object({
  kind: z.enum(ART_KINDS),
  campaignName: z.string().max(200),
  brief: z.string().trim().min(1, 'Describe what the image should show.').max(2_000),
  style: z.string().max(1_500).optional(),
  styleRefUrls: z.array(storageUrl).max(MAX_STYLE_REFS).optional(),
  cast: z
    .array(z.object({
      name: z.string().trim().min(1).max(120),
      look: z.string().max(800).optional(),
      portraitUrl: storageUrl.optional(),
    }))
    .max(MAX_CAST, `Pick at most ${MAX_CAST} characters: more than that and faces drift.`)
    .optional(),
});
export type GenerateArtInput = z.infer<typeof GenerateArtInputSchema>;

// ── Reference images ────────────────────────────────────────────────────────

const STORAGE_HOST = 'firebasestorage.googleapis.com';
const MAX_REF_BYTES = 8 * 1024 * 1024;

/**
 * The server fetches reference images itself (the browser sending the bytes
 * would blow past the request size limit), so the URLs it accepts are pinned
 * to Firebase Storage objects under the caller's own `users/{uid}/` folder.
 * Anything else would let the route be pointed at arbitrary hosts.
 */
function ownStorageUrl(raw: string, uid: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new FlowInputError('A reference image has a malformed address.'); }
  const match = url.pathname.match(/^\/v0\/b\/[^/]+\/o\/([^/]+)$/);
  let objectPath = '';
  try { objectPath = match ? decodeURIComponent(match[1]) : ''; } catch { /* stays empty */ }
  if (url.protocol !== 'https:' || url.hostname !== STORAGE_HOST || !objectPath.startsWith(`users/${uid}/`)) {
    throw new FlowInputError('A reference image is not stored in this app. Re-upload it and try again.');
  }
  return url;
}

async function fetchReference(raw: string, uid: string): Promise<InlineImage> {
  const url = ownStorageUrl(raw, uid);
  let res: Response;
  try {
    // redirect: 'error' so an allowed URL can't bounce the server somewhere else.
    res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new FlowInputError('A reference image could not be loaded. Check your connection and try again.');
  }
  if (!res.ok) throw new FlowInputError('A reference image could not be loaded. It may have been replaced; reopen the dialog.');

  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (type === 'image/gif') throw new FlowInputError('GIFs can’t be used as references. Use a still portrait.');
  if (!/^image\/(png|jpeg|webp)$/.test(type)) throw new FlowInputError('A reference file is not an image.');
  if (Number(res.headers.get('content-length') ?? 0) > MAX_REF_BYTES) throw new FlowInputError('A reference image is too large.');

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.byteLength > MAX_REF_BYTES) throw new FlowInputError('A reference image is too large.');
  return { mimeType: type, data: bytes.toString('base64') };
}

// ── Prompt ──────────────────────────────────────────────────────────────────

/**
 * Where each kind of image lands decides its composition: the app lays an
 * issue number over a cover's top-left corner, and a caption box and panel
 * number over a panel's top-left and bottom-right.
 */
const LAYOUT: Record<ArtKind, string> = {
  cover: 'A comic book cover for one issue of the series. One clear focal point that still reads at thumbnail size. '
    + 'An issue-number block covers the top-left corner: keep faces and key detail out of the top-left fifth.',
  teaser: 'A teaser cover for the NEXT issue: mood, place and tension, never an outcome. '
    + 'An issue-number block covers the top-left corner: keep faces and key detail out of the top-left fifth.',
  panel: 'A single panel from inside the comic. A caption box covers the top-left corner and a panel number covers '
    + 'the bottom-right corner: keep faces and key detail out of both.',
  scene: 'A very wide establishing shot of a location: environment and mood first, any figures small. '
    + 'Keep the focal point centred, because the left and right edges get cropped.',
  portrait: 'A character portrait: head and upper body, the character centred, a simple atmospheric background.',
  place: 'An establishing illustration of a location, as the party would first see it.',
  faction: 'An emblematic image of a faction: its people, banners or seat of power.',
};

// The diversity rule exists because, given no skin tone, the image model drew
// every character white. A character's Look and reference portrait still win
// (they keep a face consistent across images); the rule only sets the default.
// It says "this world", not a setting name: the prompt is shared by every campaign.
function buildParts(input: GenerateArtInput, styleRefs: InlineImage[], portraits: (InlineImage | null)[]): GeminiPart[] {
  const parts: GeminiPart[] = [];
  const style = input.style?.trim() || DEFAULT_ART_STYLE;

  parts.push({
    text: `You are the artist for "${input.campaignName || 'the campaign'}", a fantasy comic series based on a D&D campaign.

STYLE (keep it identical across every image in the series)
${style}

THIS IMAGE
${LAYOUT[input.kind]}
Aspect ratio ${ART_ASPECT[input.kind]}.

RULES
- No text, lettering, logos, speech bubbles, sound effects or signatures. The app adds titles and captions itself.
- No borders, frames, panel gutters or labels of any kind, and never write the aspect ratio. The art runs edge to edge.
- This world's people are diverse. Give every named character exactly the skin tone and features their description or reference portrait shows. Where neither sets it (crowds, background figures, a named character with no description and no portrait), show a natural range of skin tones, from deep brown to pale, across humans and every other species. Never default everyone to pale or white skin.`,
  });

  if (styleRefs.length) {
    parts.push({ text: 'STYLE REFERENCES. Match their art style, linework, colouring and texture. Do not copy their characters, setting or composition.' });
    for (const img of styleRefs) parts.push({ inlineData: img });
  }

  const cast = input.cast ?? [];
  if (cast.length) {
    parts.push({
      text: 'CHARACTERS IN THIS IMAGE. A reference portrait is the official look of that character: match face, species, '
        + 'colouring, hair, armour and signature gear exactly. Anyone else in the image is unnamed: a silhouette, seen from behind, or in the background.',
    });
    cast.forEach((c, i) => {
      const portrait = portraits[i];
      const look = c.look?.trim();
      parts.push({ text: `${c.name}${look ? `: ${look}` : ''}${portrait ? `. Reference portrait of ${c.name}:` : ''}` });
      if (portrait) parts.push({ inlineData: portrait });
    });
  }

  parts.push({ text: `WHAT TO DRAW\n${input.brief}` });
  return parts;
}

/** `uid` is the verified caller: reference URLs must sit under their Storage folder. */
export async function generateArt(raw: unknown, uid: string): Promise<InlineImage> {
  const parsed = GenerateArtInputSchema.safeParse(raw);
  if (!parsed.success) throw new FlowInputError(parsed.error.errors[0]?.message ?? 'Invalid input');
  const input = parsed.data;

  const [styleRefs, portraits] = await Promise.all([
    Promise.all((input.styleRefUrls ?? []).map(u => fetchReference(u, uid))),
    Promise.all((input.cast ?? []).map(c => (c.portraitUrl ? fetchReference(c.portraitUrl, uid) : Promise.resolve(null)))),
  ]);

  return generateGeminiImage(buildParts(input, styleRefs, portraits), ART_ASPECT[input.kind]);
}
