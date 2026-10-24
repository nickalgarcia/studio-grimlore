import 'server-only';

/**
 * Google's Gemini image model ("Nano Banana"), called with raw `fetch` like
 * the Anthropic client. Server-only: GEMINI_API_KEY must never reach the
 * browser, so nothing under components/ may import this file.
 *
 * The model id lives here and nowhere else. Nano Banana 2.1 keeps up to four
 * characters consistent across reference images, which is the whole reason
 * this integration exists (seven PCs, recurring NPCs).
 */
export const GEMINI_IMAGE_MODEL = 'gemini-nano-banana-2.1';

/** Thrown for failures the DM can act on. The message is shown as written. */
export class GeminiUserError extends Error {}

export type InlineImage = { mimeType: string; data: string };

/** Interleaved prompt: text and reference images in the order the model reads them. */
export type GeminiPart = { text: string } | { inlineData: InlineImage };

export type ImageAspect = '2:3' | '3:4' | '4:5' | '21:9';

// Finish reasons that mean "the model chose not to draw this", as opposed to
// a fault. Rewording the brief usually gets past them.
const REFUSED = new Set([
  'SAFETY', 'IMAGE_SAFETY', 'PROHIBITED_CONTENT', 'IMAGE_PROHIBITED_CONTENT',
  'BLOCKLIST', 'RECITATION', 'IMAGE_RECITATION', 'SPII',
]);

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new GeminiUserError('Image generation is not set up: GEMINI_API_KEY is missing on the server.');
  }
  return key;
}

type GeminiResponse = {
  promptFeedback?: { blockReason?: string };
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; thought?: boolean; inlineData?: InlineImage; inline_data?: { mime_type?: string; data?: string } }[] };
  }[];
};

/**
 * One image from an interleaved prompt. Asks for 1K: every slot in the app
 * shows art at 400px or less and uploads are downscaled to 1600px anyway, and
 * a 1K PNG keeps the route's response well under Vercel's 4.5 MB body limit.
 */
export async function generateGeminiImage(parts: GeminiPart[], aspectRatio: ImageAspect): Promise<InlineImage> {
  const key = apiKey();

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio, imageSize: '1K' },
          },
        }),
      },
    );
  } catch (e) {
    console.error('[gemini] network error:', e);
    throw new Error('Network error calling Gemini');
  }

  if (!response.ok) {
    // Google's error bodies describe the request, not the key, so logging them is safe.
    const err = await response.text();
    console.error(`[gemini] ${response.status}:`, err.slice(0, 2_000));
    if (response.status === 429) {
      // Google sends 429 for two different problems. A quota of zero (what a
      // project without billing gets for image models) can't be waited out,
      // so it must not read like a rate limit.
      if (/limit:\s*0\b|free_tier|billing/i.test(err)) {
        throw new GeminiUserError('This Gemini key has no image quota. Image generation needs billing enabled on the Google AI Studio project the key belongs to.');
      }
      if (/per ?day/i.test(err)) {
        throw new GeminiUserError('Gemini’s daily image quota for this key is used up. It resets tomorrow.');
      }
      const wait = err.match(/"retryDelay":\s*"(\d+)(?:\.\d+)?s"/)?.[1];
      throw new GeminiUserError(`Gemini is rate-limiting requests. Try again in ${wait ? `${wait} seconds` : 'a minute'}.`);
    }
    if (/API key not valid|API_KEY_INVALID/i.test(err)) throw new GeminiUserError('Gemini rejected the API key. Check GEMINI_API_KEY.');
    if (/billing|FAILED_PRECONDITION/i.test(err)) throw new GeminiUserError('Gemini refused the request. Image generation needs billing enabled on the Google AI Studio project.');
    throw new Error(`Gemini API error ${response.status}`);
  }

  const data = (await response.json()) as GeminiResponse;

  const blocked = data.promptFeedback?.blockReason;
  if (blocked) {
    throw new GeminiUserError(`Gemini declined this brief (${blocked}). Reword it and try again.`);
  }

  const candidate = data.candidates?.[0];
  // With thinking on, the model can return draft images marked `thought`; the
  // last non-thought image is the answer.
  const images = (candidate?.content?.parts ?? [])
    .filter(p => !p.thought)
    .map(p => p.inlineData ?? (p.inline_data?.data ? { mimeType: p.inline_data.mime_type ?? 'image/png', data: p.inline_data.data } : undefined))
    .filter((p): p is InlineImage => !!p?.data);
  const image = images[images.length - 1];
  if (image) return image;

  const reason = candidate?.finishReason ?? 'NO_IMAGE';
  if (REFUSED.has(reason)) {
    throw new GeminiUserError(`Gemini declined to draw this (${reason}). Reword the brief and try again.`);
  }
  console.error('[gemini] no image in response, finishReason:', reason);
  throw new GeminiUserError('Gemini returned no image. Try again, or simplify the brief.');
}
