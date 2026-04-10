/**
 * @fileOverview Generates a structured session prep document for an upcoming D&D session.
 *
 * Takes the DM's goals + full campaign context and produces a practical,
 * immediately usable prep guide — scene openings, complications, NPC
 * motivations, character spotlights, and tone reminders.
 */

import { callClaudeJson } from '@/ai/anthropic-client';
import { z } from 'zod';

export const SessionPrepInputSchema = z.object({
  // Campaign identity
  campaignName: z.string(),
  campaignDescription: z.string().optional(),

  // What the DM wants from this session
  sessionGoals: z.string().describe('What do you want to accomplish this session? Can be vague — "explore Mirathen" or specific — "reveal the Circle agent".'),
  location: z.string().optional().describe('Where does the session take place?'),
  tone: z.string().optional().describe('What feeling should this session have? e.g. "tense investigation", "action-heavy", "emotional character moment"'),
  extraNotes: z.string().optional().describe('Anything else to factor in — player absences, pacing notes, things to avoid.'),

  // Campaign context
  sessionLog: z.string().optional().describe('Recent session history, newest first.'),
  characters: z.array(z.object({
    name: z.string(),
    class: z.string().optional(),
    backstory: z.string().optional(),
  })).optional(),
  activeNpcs: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
  })).optional(),
  campaignSummary: z.string().optional(),
});
export type SessionPrepInput = z.infer<typeof SessionPrepInputSchema>;

export const SessionPrepOutputSchema = z.object({
  sessionTitle: z.string().describe('A evocative working title for the session.'),
  openingScene: z.string().describe('A vivid, specific scene to open the session with — set the stage, establish immediate tension.'),
  alternateOpening: z.string().describe('A second opening option if the first feels too on-the-nose.'),
  complications: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })).describe('3 unexpected complications that could arise — things that would make the session more interesting without derailing it.'),
  npcMotivations: z.array(z.object({
    name: z.string(),
    currentGoal: z.string(),
    howTheyActToday: z.string(),
  })).describe('Key NPCs likely to appear and what they want right now.'),
  characterSpotlights: z.array(z.object({
    character: z.string(),
    opportunity: z.string(),
  })).describe('One moment per character that could spotlight their arc or pressure point.'),
  prepReminders: z.array(z.string()).describe('4-6 short DM reminders — tone cues, pacing notes, things not to forget.'),
  openThreadsToPull: z.array(z.string()).describe('2-3 unresolved threads from previous sessions that could naturally surface this session.'),
});
export type SessionPrepOutput = z.infer<typeof SessionPrepOutputSchema>;

export async function generateSessionPrep(
  input: SessionPrepInput
): Promise<SessionPrepOutput> {
  const parsed = SessionPrepInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input');

  const {
    campaignName, campaignDescription, sessionGoals, location,
    tone, extraNotes, sessionLog, characters, activeNpcs, campaignSummary,
  } = parsed.data;

  const sections: string[] = [`CAMPAIGN: ${campaignName}`];

  if (campaignDescription) sections.push(`PREMISE: ${campaignDescription}`);
  if (campaignSummary) sections.push(`STORY SO FAR:\n${campaignSummary.slice(0, 800)}`);
  if (sessionLog) sections.push(`RECENT SESSIONS:\n${sessionLog}`);

  if (characters?.length) {
    sections.push(`PLAYER CHARACTERS:\n${characters
      .map(c => `• ${c.name}${c.class ? ` (${c.class})` : ''}${c.backstory ? `: ${c.backstory.slice(0, 200)}` : ''}`)
      .join('\n')}`);
  }

  if (activeNpcs?.length) {
    sections.push(`ACTIVE NPCs:\n${activeNpcs
      .map(n => `• ${n.name}${n.description ? `: ${n.description.slice(0, 150)}` : ''}`)
      .join('\n')}`);
  }

  sections.push(`\nDM'S SESSION GOALS:\n${sessionGoals}`);
  if (location) sections.push(`LOCATION: ${location}`);
  if (tone) sections.push(`INTENDED TONE: ${tone}`);
  if (extraNotes) sections.push(`DM NOTES: ${extraNotes}`);

  return callClaudeJson<SessionPrepOutput>({
    system: `You are an expert Dungeon Master helping another DM prepare for their next session.
Your prep documents are specific, immediately usable, and grounded in the campaign's actual history and characters.
Never give generic D&D advice — every suggestion must use real names, locations, and threads from the campaign.
Think like a writer and a game designer: create pressure, not plot.
Respond ONLY with a valid JSON object matching the exact schema. No preamble, no markdown fences.`,
    messages: [{
      role: 'user',
      content: `${sections.join('\n\n')}

Generate a complete session prep document. Every field must be specific to THIS campaign and THESE characters.
The complications should feel organic — things that could plausibly happen given recent events.
The character spotlights should connect to their individual backstories and pressure points.
The prep reminders should sound like notes a wise DM would write to themselves.`,
    }],
    temperature: 0.75,
    max_tokens: 2000,
  });
}
