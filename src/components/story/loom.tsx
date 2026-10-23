'use client';

import * as React from 'react';
import Link from 'next/link';
import { loomCells, type LoomCell, type LoomLane } from '@/lib/loom';
import { pageHref } from '@/lib/pages';
import { cn } from '@/lib/utils';

const TONE_CLASS = { spot: 'text-primary', sand: 'text-accent', mute: 'text-muted-foreground' } as const;

function segmentBackground(style: 'solid' | 'dashed' | 'pull', color: string): string {
  if (style === 'solid') return color;
  const c = style === 'pull' ? 'hsl(var(--primary))' : color;
  return `repeating-linear-gradient(90deg, ${c} 0 5px, transparent 5px 10px)`;
}

function Cell({
  cell, lane, selected, onSelect, onNext,
}: {
  cell: LoomCell;
  lane: LoomLane;
  selected: boolean;
  onSelect: (n: number) => void;
  onNext: () => void;
}) {
  const isNext = cell.column === 'next';
  const label = isNext
    ? `${lane.name}: ${lane.pullNext ? 'pulling into' : 'not pulled into'} the next issue`
    : `${lane.name}, issue ${cell.column}: ${cell.node ? 'appears' : 'absent'}`;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => (isNext ? onNext() : onSelect(cell.column as number))}
      className={cn('relative h-10 border-b border-border/10', selected && 'bg-card')}
    >
      {cell.segment && (
        <span
          aria-hidden="true"
          className="absolute top-[19px] h-[3px]"
          style={{
            left: `${cell.segment.from}%`,
            right: `${100 - cell.segment.to}%`,
            background: segmentBackground(cell.segment.style, lane.color),
          }}
        />
      )}
      {cell.node === 'appears' && (
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[15px] h-[15px] rounded-full border-[3px] border-background"
          style={{ background: lane.color }}
        />
      )}
      {cell.node === 'ring' && (
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[15px] h-[15px] rounded-full border-[2.5px] border-primary bg-background"
        />
      )}
    </button>
  );
}

/**
 * Threads and key people across every issue, plus a NEXT column. The geometry
 * comes from `loomCells`; this only draws it.
 */
export function Loom({
  lanes, columns, selected, onSelect, onNext,
}: {
  lanes: LoomLane[];
  /** Played issue numbers, ascending. */
  columns: number[];
  selected: number | null;
  onSelect: (n: number) => void;
  onNext: () => void;
}) {
  const grid = { gridTemplateColumns: `230px repeat(${columns.length + 1}, minmax(0,1fr))` };

  if (lanes.length === 0) {
    return (
      <p className="border-[3px] border-dashed border-border/30 p-6 italic text-muted-foreground">
        Nothing on the Loom yet. Threads and key NPCs get a lane here once a recap mentions them.
      </p>
    );
  }

  let lastGroup: LoomLane['group'] | null = null;
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[860px]" style={grid}>
        <span />
        {columns.map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onSelect(n)}
            aria-pressed={n === selected}
            className={cn(
              'h-[30px] font-mono font-bold text-[12px]',
              n === selected ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={onNext}
          className="h-[30px] font-mono font-bold text-[12px] text-primary outline outline-[1.5px] outline-dashed outline-primary -outline-offset-[1.5px]"
        >
          NEXT
        </button>

        {lanes.map(lane => {
          const head = lane.group !== lastGroup;
          lastGroup = lane.group;
          const cells = loomCells(lane.appearances, columns, lane.pullNext);
          return (
            <React.Fragment key={`${lane.ref.kind}:${lane.ref.id}`}>
              {head && (
                <div className="col-span-full pt-3.5 pb-1.5 font-mono font-bold text-[11px] tracking-[0.16em] text-muted-foreground">
                  {lane.group === 'threads' ? 'THREADS' : 'PEOPLE'}
                </div>
              )}
              <Link
                href={pageHref(lane.ref)}
                className="h-10 flex items-center gap-2 pr-3 border-b border-border/10 min-w-0"
              >
                <span aria-hidden="true" className="flex-none w-4 h-1" style={{ background: lane.color }} />
                <span className="flex-1 min-w-0 truncate font-semibold text-[16px]">{lane.name}</span>
                {lane.status && (
                  <span className={cn('flex-none font-mono text-[11px] tracking-[0.1em]', TONE_CLASS[lane.tone])}>
                    {lane.status}
                  </span>
                )}
              </Link>
              {cells.map(cell => (
                <Cell
                  key={String(cell.column)}
                  cell={cell}
                  lane={lane}
                  selected={cell.column === selected}
                  onSelect={onSelect}
                  onNext={onNext}
                />
              ))}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
