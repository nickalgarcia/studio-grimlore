import type { MentionRef, Npc, Thread } from '@/lib/types';
import { refKey } from '@/lib/mentions';

/**
 * Loom geometry, kept apart from rendering so the rules in the spec live in
 * one testable function rather than in JSX conditionals.
 *
 * A lane is one thread or key NPC. Its appearances come from
 * `indexCampaign().appearances` (lib/mentions.ts); nothing about a lane's
 * history is stored on the entity.
 */

/** Lane colours: fixed and palette-independent. Reused across THREADS and PEOPLE. */
export const LANE_COLORS = ['#ff5a2a', '#ffc629', '#4fd6ff', '#b48cff', '#5ee38a', '#ff6fb1'] as const;

/**
 * A stored colour wins; otherwise one is assigned by the lane's position in
 * its group. Assigned colours are not written back, so adding a thread never
 * rewrites the others' documents.
 */
export function laneColor(stored: string | undefined, index: number): string {
  return stored || LANE_COLORS[index % LANE_COLORS.length];
}

/**
 * Two appearances this many issues apart (or more) are joined by a dashed
 * "dormant" line instead of a solid one. Measured in issue numbers, the way
 * the prototype does it: appearances in #2 and #5 are 3 apart, so dashed.
 */
export const DORMANT_GAP = 3;

/**
 * `solid` and `dashed` are drawn in the lane colour; `pull` is the dashed
 * `--spot` line running from the last appearance into NEXT.
 */
export type LoomSegmentStyle = 'solid' | 'dashed' | 'pull';

export type LoomCell = {
  column: number | 'next';
  /** `appears`: filled node in the lane colour. `ring`: the hollow PULL NEXT ring. */
  node: 'appears' | 'ring' | null;
  /**
   * The horizontal line through this cell, as percentages of the cell width.
   * It starts at 50% in the first appearance's cell and ends at 50% in the last.
   */
  segment: { style: LoomSegmentStyle; from: 0 | 50; to: 50 | 100 } | null;
};

/**
 * One cell per played issue in `columns` (ascending issue numbers), then NEXT.
 *
 * Appearances outside `columns` are ignored, so a lane can't draw a line to an
 * issue that isn't on screen.
 */
export function loomCells(
  appearances: readonly number[],
  columns: readonly number[],
  pullNext: boolean,
): LoomCell[] {
  const onScreen = new Set(columns);
  const apps = [...new Set(appearances)].filter(n => onScreen.has(n)).sort((a, b) => a - b);
  const appSet = new Set(apps);
  const first = apps[0];
  const last = apps[apps.length - 1];

  const cells: LoomCell[] = columns.map(n => {
    const node = appSet.has(n) ? 'appears' : null;
    if (first === undefined || n < first || (!pullNext && n > last)) {
      return { column: n, node, segment: null };
    }

    const from = n === first ? 50 : 0;
    const to = !pullNext && n === last ? 50 : 100;
    // A single appearance with no pull has no line, only its node.
    if (from === 50 && to === 50) return { column: n, node, segment: null };

    let style: LoomSegmentStyle;
    if (n > last) {
      style = 'pull';
    } else {
      // The appearances on either side of this cell. On an appearance both
      // are the cell itself, so a node always sits on solid line.
      const prev = apps.filter(a => a <= n).pop()!;
      const next = apps.find(a => a >= n)!;
      style = next - prev >= DORMANT_GAP ? 'dashed' : 'solid';
    }
    return { column: n, node, segment: { style, from, to } };
  });

  // The NEXT column. Pulling with no appearances shows the ring alone.
  cells.push({
    column: 'next',
    node: pullNext ? 'ring' : null,
    segment: pullNext && first !== undefined ? { style: 'pull', from: 0, to: 50 } : null,
  });

  return cells;
}

/**
 * Prep's Pull row: whether the lane appears in each of the last `count`
 * played issues (oldest first), and how many issues it has been quiet.
 * `quiet` is 0 when it appeared in the latest issue ("TOUCHED LAST ISSUE").
 */
export function recentTicks(
  appearances: readonly number[],
  columns: readonly number[],
  count = 5,
): { ticks: { issue: number; on: boolean }[]; quiet: number | null } {
  const set = new Set(appearances);
  const recent = columns.slice(-count);
  const ticks = recent.map(issue => ({ issue, on: set.has(issue) }));

  const latest = columns[columns.length - 1];
  const lastSeen = [...appearances].filter(n => n <= latest).sort((a, b) => a - b).pop();
  // Never seen: no age to show rather than a misleading number.
  const quiet = latest === undefined || lastSeen === undefined
    ? null
    : columns.filter(n => n > lastSeen).length;

  return { ticks, quiet };
}

export type LaneTone = 'spot' | 'sand' | 'mute';

export type LoomLane = {
  ref: MentionRef;
  group: 'threads' | 'people';
  name: string;
  color: string;
  /** Uppercase label for the lane: LIVE / SEEDED / COLD, or a disposition. */
  status: string;
  /** LIVE and HOSTILE are spot; SEEDED and UNFRIENDLY are sand; the rest mute. */
  tone: LaneTone;
  pullNext: boolean;
  /** Issue numbers, ascending. */
  appearances: number[];
};

function toneOf(status: string): LaneTone {
  if (status === 'LIVE' || status === 'HOSTILE') return 'spot';
  if (status === 'SEEDED' || status === 'UNFRIENDLY') return 'sand';
  return 'mute';
}

/** First appearance ascending; lanes that never appear go last, in input order. */
function byFirstAppearance(a: LoomLane, b: LoomLane): number {
  const fa = a.appearances[0] ?? Infinity;
  const fb = b.appearances[0] ?? Infinity;
  return fa === fb ? 0 : fa - fb;
}

/**
 * The Loom's rows: every thread, then every key NPC. Colours are assigned
 * after sorting, so a lane keeps its colour as long as its first appearance
 * doesn't move.
 */
export function buildLanes({
  threads, npcs, appearances,
}: {
  threads: readonly Thread[] | null | undefined;
  npcs: readonly Npc[] | null | undefined;
  appearances: ReadonlyMap<string, number[]>;
}): LoomLane[] {
  const lane = (
    ref: MentionRef, group: LoomLane['group'], name: string, stored: string | undefined,
    status: string, pullNext: boolean,
  ): LoomLane & { stored?: string } => ({
    ref, group, name, color: '', stored, status, tone: toneOf(status), pullNext,
    appearances: appearances.get(refKey(ref)) ?? [],
  });

  const threadLanes = (threads ?? [])
    .map(t => lane({ kind: 'thread', id: t.id }, 'threads', t.title, t.color, t.status.toUpperCase(), !!t.pullNext))
    .sort(byFirstAppearance);

  const peopleLanes = (npcs ?? [])
    .filter(n => n.importance === 'Key')
    .map(n => lane(
      { kind: 'npc', id: n.id }, 'people', n.name, n.color,
      (n.disposition ?? n.status ?? '').toUpperCase(), false,
    ))
    .sort(byFirstAppearance);

  return [threadLanes, peopleLanes].flatMap(group =>
    group.map(({ stored, ...l }, i) => ({ ...l, color: laneColor(stored, i) })),
  );
}
