/**
 * @fileOverview Generates a structured session prep document for an upcoming D&D session.
 *
 * Takes the DM's goals + full campaign context and produces a practical,
 * immediately usable prep guide — scene openings, complications, NPC
 * motivations, character spotlights, and tone reminders.
 */

import { callClaude } from '@/ai/anthropic-client';
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

  const prompt = `${sections.join('\n\n')}

Generate a complete session prep document grounded in THIS campaign and THESE characters.
Every suggestion must use real names, locations, and threads — no generic D&D advice.
The complications should feel organic given recent events.
Character spotlights must connect to individual backstories.
Prep reminders should sound like notes a wise DM writes to themselves.

Return ONLY this JSON object, nothing else — no preamble, no markdown fences:
{
  "sessionTitle": "<evocative working title for the session>",
  "openingScene": "<vivid specific scene to open with — set stage, establish immediate tension>",
  "alternateOpening": "<second opening option if the first is too on-the-nose>",
  "complications": [
    { "title": "<short name>", "description": "<what happens and why it matters>" },
    { "title": "<short name>", "description": "<what happens and why it matters>" },
    { "title": "<short name>", "description": "<what happens and why it matters>" }
  ],
  "npcMotivations": [
    { "name": "<npc name>", "currentGoal": "<what they want right now>", "howTheyActToday": "<how this affects their behavior>" }
  ],
  "characterSpotlights": [
    { "character": "<pc name>", "opportunity": "<specific moment that could spotlight their arc>" }
  ],
  "prepReminders": ["<short DM reminder>", "<short DM reminder>", "<short DM reminder>", "<short DM reminder>"],
  "openThreadsToPull": ["<unresolved thread from past sessions>", "<unresolved thread>"]
}`;

  const raw = await callClaude({
    system: `You are an expert Dungeon Master helping another DM prepare for their next session.
Your prep documents are specific, immediately usable, and grounded in the campaign's actual history.
Return ONLY valid JSON. No explanation, no markdown fences, no text before or after the JSON object.`,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.75,
    max_tokens: 2000,
  });

  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('No JSON found in session prep response:', cleaned.slice(0, 500));
    throw new Error('Could not extract JSON from session prep response');
  }

  try {
    const result = JSON.parse(jsonMatch[0]);
    return {
      sessionTitle: result.sessionTitle ?? `Session Prep`,
      openingScene: result.openingScene ?? '',
      alternateOpening: result.alternateOpening ?? '',
      complications: Array.isArray(result.complications) ? result.complications : [],
      npcMotivations: Array.isArray(result.npcMotivations) ? result.npcMotivations : [],
      characterSpotlights: Array.isArray(result.characterSpotlights) ? result.characterSpotlights : [],
      prepReminders: Array.isArray(result.prepReminders) ? result.prepReminders : [],
      openThreadsToPull: Array.isArray(result.openThreadsToPull) ? result.openThreadsToPull : [],
    };
  } catch (e) {
    console.error('Session prep JSON parse failed:', jsonMatch[0].slice(0, 500));
    throw new Error('Failed to parse session prep response');
  }
}
