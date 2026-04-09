/**
 * Central place to configure the Anthropic client and default model.
 * Add ANTHROPIC_API_KEY to your .env.local to use.
 *
 * We use claude-sonnet-4-5 — fast, smart, large context window.
 * Ideal for campaign-aware DM assistance.
 */

export const runtime = 'nodejs';

export const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';

export function getAnthropicHeaders() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to .env.local and restart.');
  }
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
}

export async function callClaude(params: {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  temperature?: number;
  max_tokens?: number;
}): Promise<string> {
  const headers = getAnthropicHeaders();

  const body = JSON.stringify({
    model: CLAUDE_MODEL,
    max_tokens: params.max_tokens ?? 2048,
    temperature: params.temperature ?? 0.7,
    system: params.system,
    messages: params.messages,
  });

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body,
    });
  } catch (networkError) {
    console.error('Network error calling Anthropic:', networkError);
    throw new Error(`Network error: ${networkError}`);
  }

  if (!response.ok) {
    const err = await response.text();
    console.error(`Anthropic API ${response.status} error:`, err);
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = data.content?.[0];
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response format from Anthropic API');
  }
  return content.text;
}

/**
 * Calls Claude expecting a JSON response. Strips markdown fences if present.
 */
export async function callClaudeJson<T>(params: {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  temperature?: number;
  max_tokens?: number;
}): Promise<T> {
  const raw = await callClaude(params);
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Failed to parse JSON from Claude response: ${cleaned.slice(0, 200)}`);
  }
}