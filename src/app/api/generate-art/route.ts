import { type NextRequest } from 'next/server';
import { FlowInputError } from '@/ai/errors';
import { generateArt } from '@/ai/flows/generate-art-flow';
import { GeminiUserError } from '@/ai/gemini-client';
import { authErrorMessage, authErrorStatus, requireUser } from '@/firebase/require-user';

export const runtime = 'nodejs';
// Image models think before they draw: 15–40 s is normal at 1K. 60 is the
// most every Vercel plan allows; a higher value can fail the deploy.
export const maxDuration = 60;

/**
 * A route rather than a server action because the answer is an image: it goes
 * back as raw bytes (no base64 inflation) and the client hands the Blob
 * straight to the same upload path a dropped file takes.
 */
export async function POST(req: NextRequest) {
  const idToken = req.headers.get('Authorization')?.replace('Bearer ', '');
  let uid: string;
  try {
    uid = await requireUser(idToken);
  } catch (e) {
    return new Response(authErrorMessage(e), { status: authErrorStatus(e) });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  try {
    const image = await generateArt(body, uid);
    return new Response(new Uint8Array(Buffer.from(image.data, 'base64')), {
      headers: { 'Content-Type': image.mimeType, 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    // Both carry messages written for the DM.
    if (e instanceof FlowInputError || e instanceof GeminiUserError) {
      return new Response(e.message, { status: 422 });
    }
    console.error('[generate-art]', e);
    return new Response('Could not generate the image. Try again.', { status: 502 });
  }
}
