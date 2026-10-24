/**
 * @fileOverview Generates a structured session prep document for an upcoming D&D session.
 *
 * Takes the DM's goals + full campaign context and produces a practical,
 * immediately usable prep guide — scene openings, complications, NPC
 * motivations, character spotlights, and tone reminders.
 */

import { callClaudeJson } from '@/ai/anthropic-client';
import { z } from 'zod';
import { FlowInputError } from '@/ai/errors';

export const SessionPrepInputSchema = z.object({
  // Campaign identity
  campaignName: z.string().max(200),
  campaignDescription: z.string().max(2_000).optional(),

  // What the DM wants from this session
  sessionGoals: z.string().min(1, 'Tell the co-pilot what this issue is for.').max(2_000).describe('What do you want to accomplish this session? Can be vague — "explore Mirathen" or specific — "reveal the Circle agent".'),
  location: z.string().max(300).optional().describe('Where does the session take place?'),
  tone: z.string().max(300).optional().describe('What feeling should this session have? e.g. "tense investigation", "action-heavy", "emotional character moment"'),
  extraNotes: z.string().max(2_000).optional().describe('Anything else to factor in — player absences, pacing notes, things to avoid.'),

  // Campaign context
  sessionLog: z.string().max(24_000).optional().describe('Recent session history, newest first.'),
  characters: z.array(z.object({
    name: z.string().max(120),
    class: z.string().max(120).optional(),
    backstory: z.string().max(4_000).optional(),
  })).max(12).optional(),
  activeNpcs: z.array(z.object({
    name: z.string().max(160),
    description: z.string().max(1_000).optional(),
  })).max(40).optional(),
  campaignSummary: z.string().max(4_000).optional(),
  /** Unresolved threads, so the prep can pick which to pull by id. */
  openThreads: z.array(z.object({
    id: z.string().max(64),
    title: z.string().max(300),
    status: z.string().max(20).optional(),
  })).max(40).optional(),
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
  /** Ids from `openThreads` worth pulling, then the titles of any new threads it suggests. */
  openThreadsToPull: z.array(z.string()).describe('2-3 unresolved threads from previous sessions that could naturally surface this session.'),
  /** The comic script: four scenes. `cast` is names; the client maps them to page ids. */
  scenes: z.array(z.object({
    role: z.enum(['open', 'pressure', 'turn', 'cliffhanger']),
    title: z.string(),
    where: z.string(),
    beat: z.string(),
    cast: z.array(z.string()),
  })),
});
export type SessionPrepOutput = z.infer<typeof SessionPrepOutputSchema>;

export async function generateSessionPrep(
  input: SessionPrepInput
): Promise<SessionPrepOutput> {
  const parsed = SessionPrepInputSchema.safeParse(input);
  if (!parsed.success) throw new FlowInputError(parsed.error.errors[0]?.message ?? 'Invalid input');

  const {
    campaignName, campaignDescription, sessionGoals, location,
    tone, extraNotes, sessionLog, characters, activeNpcs, campaignSummary, openThreads,
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

  if (openThreads?.length) {
    sections.push(`OPEN THREADS (id: title):\n${openThreads.map(t => `${t.id}: ${t.title}${t.status ? ` [${t.status}]` : ''}`).join('\n')}`);
  }

  sections.push(`\nDM'S SESSION GOALS:\n${sessionGoals}`);
  if (location) sections.push(`LOCATION: ${location}`);
  if (tone) sections.push(`INTENDED TONE: ${tone}`);
  if (extraNotes) sections.push(`DM NOTES: ${extraNotes}`);

  const prompt = `${sections.join('\n\n')}

Generate a complete session prep document grounded in THIS campaign and THESE characters.
Every suggestion must use real names, locations, and threads — no generic D&D advice.
Keep each field CONCISE — 2-4 sentences max per field. Do not write long paragraphs.
The complications should feel organic given recent events.
Character spotlights must connect to individual backstories.
Prep reminders should be short punchy notes, not full sentences.

Return ONLY this JSON object, nothing else — no preamble, no markdown fences:
{
  "sessionTitle": "<4-6 word evocative title>",
  "openingScene": "<2-3 sentence vivid scene opener — specific, immediate, atmospheric>",
  "alternateOpening": "<2-3 sentence alternate scene opener>",
  "complications": [
    { "title": "<3-5 word name>", "description": "<1-2 sentences — what happens and why it matters>" },
    { "title": "<3-5 word name>", "description": "<1-2 sentences>" },
    { "title": "<3-5 word name>", "description": "<1-2 sentences>" }
  ],
  "npcMotivations": [
    { "name": "<name>", "currentGoal": "<one sentence>", "howTheyActToday": "<one sentence>" }
  ],
  "characterSpotlights": [
    { "character": "<pc name>", "opportunity": "<one sentence specific moment>" }
  ],
  "prepReminders": ["<short note>", "<short note>", "<short note>", "<short note>"],
  "openThreadsToPull": ["<id from OPEN THREADS>", "<id from OPEN THREADS>"],
  "newThreads": ["<only if no listed thread fits: a one-sentence new thread>"],
  "scenes": [
    { "role": "open", "title": "<2-5 words>", "where": "<place · time of day>", "beat": "<1-2 sentences>", "cast": ["<names of NPCs or PCs in the scene>"] },
    { "role": "pressure", "title": "...", "where": "...", "beat": "...", "cast": [] },
    { "role": "turn", "title": "...", "where": "...", "beat": "...", "cast": [] },
    { "role": "cliffhanger", "title": "...", "where": "...", "beat": "...", "cast": [] }
  ]
}
The four scenes are the issue's script, in order. Scene 1 is the opening scene above, as a card.
For openThreadsToPull use the ids from OPEN THREADS exactly; put genuinely new threads in newThreads.`;

  const result = await callClaudeJson<{
    sessionTitle?: string;
    openingScene?: string;
    alternateOpening?: string;
    complications?: Array<{ title: string; description: string }>;
    npcMotivations?: Array<{ name: string; currentGoal: string; howTheyActToday: string }>;
    characterSpotlights?: Array<{ character: string; opportunity: string }>;
    prepReminders?: string[];
    openThreadsToPull?: string[];
    newThreads?: string[];
    scenes?: Array<{ role?: string; title?: string; where?: string; beat?: string; cast?: string[] }>;
  }>({
    system: `You are an expert Dungeon Master helping another DM prepare for their next session.
Your prep documents are specific, immediately usable, and grounded in the campaign's actual history.
Be CONCISE — every field should be 1-3 sentences maximum. Brevity is a feature, not a bug.
Return ONLY valid JSON. No explanation, no markdown fences, no text before or after the JSON object.`,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.75,
    max_tokens: 3200,
  });

  return {
    sessionTitle: result.sessionTitle ?? 'Session Prep',
    openingScene: result.openingScene ?? '',
    alternateOpening: result.alternateOpening ?? '',
    complications: Array.isArray(result.complications) ? result.complications : [],
    npcMotivations: Array.isArray(result.npcMotivations) ? result.npcMotivations : [],
    characterSpotlights: Array.isArray(result.characterSpotlights) ? result.characterSpotlights : [],
    prepReminders: Array.isArray(result.prepReminders) ? result.prepReminders : [],
    // Listed ids first, then new-thread titles. Readers treat a value that
    // matches no thread id as a title (see SessionPrepState).
    openThreadsToPull: [
      ...(Array.isArray(result.openThreadsToPull) ? result.openThreadsToPull : [])
        .filter(id => !openThreads || openThreads.some(t => t.id === id)),
      ...(Array.isArray(result.newThreads) ? result.newThreads : []).filter(t => typeof t === 'string' && t.trim()),
    ].slice(0, 6),
    scenes: (Array.isArray(result.scenes) ? result.scenes : []).slice(0, 4).map((sc, i) => ({
      role: (['open', 'pressure', 'turn', 'cliffhanger'] as const).find(r => r === sc.role) ?? (['open', 'pressure', 'turn', 'cliffhanger'] as const)[i],
      title: String(sc.title ?? '').slice(0, 120),
      where: String(sc.where ?? '').slice(0, 160),
      beat: String(sc.beat ?? '').slice(0, 600),
      cast: Array.isArray(sc.cast) ? sc.cast.filter(c => typeof c === 'string').slice(0, 10) : [],
    })),
  };
}
