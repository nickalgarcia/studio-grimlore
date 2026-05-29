import { type NextRequest } from 'next/server';
import { getAnthropicHeaders, CLAUDE_MODEL } from '@/ai/anthropic-client';
import { LiveSessionInputSchema, buildCampaignSystemPrompt } from '@/ai/flows/live-session-flow';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const parsed = LiveSessionInputSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.errors[0]?.message ?? 'Invalid input', { status: 400 });
  }

  const systemPrompt = buildCampaignSystemPrompt(parsed.data.campaignContext);

  const headers = {
    ...getAnthropicHeaders(),
    'anthropic-beta': 'prompt-caching-2024-07-31',
  };

  let upstream: Response;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        temperature: 0.75,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: parsed.data.messages,
        stream: true,
      }),
    });
  } catch (e) {
    console.error('[live-session stream] Network error:', e);
    return new Response('Upstream network error', { status: 502 });
  }

  if (!upstream.ok) {
    const err = await upstream.text();
    console.error(`[live-session stream] Anthropic ${upstream.status}:`, err);
    return new Response(err, { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
