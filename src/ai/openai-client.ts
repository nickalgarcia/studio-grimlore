import OpenAI from 'openai';

/**
 * Central place to configure OpenAI client and default model.
 * Adjust OPENAI_MODEL in your env to change models without editing every flow.
 */
export const MODEL = process.env.OPENAI_MODEL || 'gpt-4';

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set. Add it to .env.local and restart.');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    project: process.env.OPENAI_PROJECT_ID,
    organization: process.env.OPENAI_ORG_ID,
    baseURL: 'https://api.openai.com/v1',
  });
}
