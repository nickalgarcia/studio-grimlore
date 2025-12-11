import { genkit } from 'genkit';
import openAI from '@genkit-ai/compat-oai';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error('OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server.');
}

export const ai = genkit({
  // Keep the config minimal to avoid header/namespace mismatches.
  plugins: [openAI({ apiKey, baseURL: 'https://api.openai.com/v1' })],
  // Use a model from your listed set; no namespace.
  model: 'gpt-4-0613',
});
