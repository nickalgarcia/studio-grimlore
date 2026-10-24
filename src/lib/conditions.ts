import type { Condition } from '@/lib/types';

/**
 * One line per condition for the Rulebook's quick-reference grid. Covers the
 * whole `Condition` union, including Concentrating, which 5e treats as a rule
 * rather than a condition but the combat tracker tracks like one.
 * Summarised from the SRD 5.1 (CC-BY-4.0).
 */
export const CONDITION_EFFECTS: Record<Condition, string> = {
  Blinded: "Can't see. Attacks against it have advantage; its attacks have disadvantage.",
  Charmed: "Can't attack the charmer. The charmer has advantage on social checks against it.",
  Concentrating: 'Holding a spell. Damage forces a Con save, DC 10 or half the damage.',
  Deafened: "Can't hear. Automatically fails checks that rely on hearing.",
  Exhausted: 'Six cumulative levels, from disadvantage on checks to death. A long rest removes one.',
  Frightened: "Disadvantage on checks and attacks while the source is in sight. Can't move closer.",
  Grappled: 'Speed 0. Ends if the grappler is incapacitated or it is moved out of reach.',
  Incapacitated: "Can't take actions or reactions.",
  Invisible: 'Attacks against it have disadvantage; its attacks have advantage.',
  Paralyzed: 'Incapacitated. Fails Str and Dex saves. Hits from within 5 ft are critical.',
  Petrified: 'Stone. Incapacitated, resists all damage, fails Str and Dex saves.',
  Poisoned: 'Disadvantage on attack rolls and ability checks.',
  Prone: 'Crawls or stands (half speed). Melee attacks against it have advantage; ranged, disadvantage.',
  Restrained: 'Speed 0. Attacks against it have advantage; its attacks and Dex saves have disadvantage.',
  Stunned: 'Incapacitated, falters when speaking. Fails Str and Dex saves; attacks against it have advantage.',
  Unconscious: 'Drops everything, falls prone. Fails Str and Dex saves. Hits from within 5 ft are critical.',
};

export const CONDITIONS = (Object.keys(CONDITION_EFFECTS) as Condition[]).sort();

/** `#cond-blinded` on /rules. */
export const conditionAnchor = (c: Condition) => `cond-${c.toLowerCase()}`;
