import type { Rule } from '@/lib/types';

/**
 * The 5e core rules a table checks most, summarised. Code constants rather
 * than Firestore documents: they're the same for every campaign, and the
 * per-table state (pinned, tonight) lives in a small `rules/{id}` document
 * keyed by the id here.
 *
 * Summarised from the System Reference Document 5.1 by Wizards of the Coast,
 * licensed under CC-BY-4.0. Page references are to the 2014 Player's Handbook.
 */
export type CoreRule = Omit<Rule, 'pinned' | 'tonight' | 'kind'> & { kind: 'core' };

export const SRD_CREDIT =
  'Core rules summarised from the System Reference Document 5.1 by Wizards of the Coast, licensed under CC-BY-4.0.';

export const CORE_RULES: CoreRule[] = [
  {
    id: 'opportunity-attacks', kind: 'core', category: 'combat', ref: 'PHB 195', title: 'Opportunity attacks',
    text: 'When a hostile creature you can see moves out of your reach, you can use your reaction to make one melee attack against it. Disengaging or teleporting does not provoke.',
  },
  {
    id: 'grappling', kind: 'core', category: 'combat', ref: 'PHB 195', title: 'Grappling',
    text: "Replace one attack with a Strength (Athletics) check against the target's Athletics or Acrobatics. Win and it is grappled. You need a free hand, and it can be at most one size larger. Escaping takes an action and the same contest.",
  },
  {
    id: 'shoving', kind: 'core', category: 'combat', ref: 'PHB 195', title: 'Shoving',
    text: "Replace one attack with a Strength (Athletics) check against the target's Athletics or Acrobatics. Win and you knock it prone or push it 5 feet. It can be at most one size larger.",
  },
  {
    id: 'cover', kind: 'core', category: 'combat', ref: 'PHB 196', title: 'Cover',
    text: 'Half cover: +2 to AC and Dex saves. Three-quarters cover: +5. Total cover: it can’t be targeted directly.',
  },
  {
    id: 'death-saves', kind: 'core', category: 'combat', ref: 'PHB 197', title: 'Death saving throws',
    text: 'At 0 HP, roll a d20 at the start of each turn: 10 or higher succeeds. Three successes, stable; three failures, dead. A 1 is two failures; a 20 regains 1 HP. Taking damage at 0 HP is a failure, a critical hit two.',
  },
  {
    id: 'ready', kind: 'core', category: 'combat', ref: 'PHB 193', title: 'Ready',
    text: 'Choose a trigger and a response. When the trigger happens before your next turn, take the response with your reaction. A readied spell is held with concentration.',
  },
  {
    id: 'help', kind: 'core', category: 'combat', ref: 'PHB 192', title: 'Help',
    text: "Give an ally advantage on their next check for the task, or on their next attack against a creature within 5 feet of you, before your next turn.",
  },
  {
    id: 'two-weapon-fighting', kind: 'core', category: 'combat', ref: 'PHB 195', title: 'Two-weapon fighting',
    text: "After attacking with a light melee weapon, a bonus action lets you attack with a different light melee weapon in your other hand. Don't add your ability modifier to that damage unless it is negative.",
  },
  {
    id: 'concentration', kind: 'core', category: 'magic', ref: 'PHB 203', title: 'Concentration',
    text: 'One concentration spell at a time. Taking damage forces a Constitution save, DC 10 or half the damage, whichever is higher. Being incapacitated or killed ends it.',
  },
  {
    id: 'hiding', kind: 'core', category: 'exploration', ref: 'PHB 177', title: 'Hiding',
    text: "Dexterity (Stealth) against the searcher's Wisdom (Perception). You can't hide from a creature that can see you clearly, and noise or an attack gives you away.",
  },
  {
    id: 'falling', kind: 'core', category: 'exploration', ref: 'PHB 183', title: 'Falling',
    text: '1d6 bludgeoning damage per 10 feet fallen, up to 20d6. You land prone unless you avoid all the damage.',
  },
  {
    id: 'resting', kind: 'core', category: 'exploration', ref: 'PHB 186', title: 'Resting',
    text: 'Short rest: at least an hour; spend Hit Dice to heal. Long rest: at least 8 hours; regain all HP and up to half your Hit Dice. One long rest per 24 hours.',
  },
  {
    id: 'advantage', kind: 'core', category: 'table', ref: 'PHB 173', title: 'Advantage and disadvantage',
    text: 'Roll two d20s and take the higher (advantage) or lower (disadvantage). Any amount of both cancels out to a single roll.',
  },
  {
    id: 'inspiration', kind: 'core', category: 'table', ref: 'PHB 125', title: 'Inspiration',
    text: "The DM awards it for playing your character well. Spend it for advantage on one attack, save or check. You either have it or you don't.",
  },
];

/** `#rule-grappling` on /rules. */
export const ruleAnchor = (id: string) => `rule-${id}`;
