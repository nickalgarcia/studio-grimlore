'use server';

/**
 * @fileOverview A flow that generates a detailed Non-Player Character (NPC).
 *
 * - generateNpc - A function that generates an NPC.
 * - GenerateNpcInput - The input type for the generateNpc function.
 * - GenerateNpcOutput - The return type for the generateNpc function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateNpcInputSchema = z.object({
  campaignContext: z
    .string()
    .describe('A summary of the campaign and recent events.'),
  locationContext: z.string().optional().describe('The specific location or situation where the NPC is needed (e.g., "a tavern in a port city", "a guard at a castle gate").')
});
export type GenerateNpcInput = z.infer<typeof GenerateNpcInputSchema>;

const GenerateNpcOutputSchema = z.object({
  name: z.string().describe('The full name of the NPC.'),
  description: z.string().describe("A rich description of the NPC's appearance, personality, mannerisms, and a brief backstory."),
  location: z.string().describe("The NPC's likely location or where they were generated.").optional(),
});
export type GenerateNpcOutput = z.infer<typeof GenerateNpcOutputSchema>;

export async function generateNpc(
  input: GenerateNpcInput
): Promise<GenerateNpcOutput> {
  return generateNpcFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateNpcPrompt',
  input: {schema: GenerateNpcInputSchema},
  output: {schema: GenerateNpcOutputSchema},
  prompt: `You are an expert Dungeon Master who excels at creating memorable Non-Player Characters (NPCs).

  Based on the provided campaign context and the specific location/situation, generate a new, unique NPC.

  The NPC should feel like they belong in the world described. Provide a name and a detailed description including their appearance, personality, a brief backstory, and a potential secret or motivation.

  Campaign Context:
  {{campaignContext}}

  {{#if locationContext}}
  Specific Situation:
  {{locationContext}}
  {{/if}}

  Generate an NPC that fits this context.
  `,
});

const generateNpcFlow = ai.defineFlow(
  {
    name: 'generateNpcFlow',
    inputSchema: GenerateNpcInputSchema,
    outputSchema: GenerateNpcOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if(input.locationContext && !output?.location) {
        output!.location = input.locationContext;
    }
    return output!;
  }
);
