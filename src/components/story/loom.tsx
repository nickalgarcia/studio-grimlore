'use client';

import * as React from 'react';
import Link from 'next/link';
import { loomCells, type LoomCell, type LoomLane } from '@/lib/loom';
import { pageHref } from '@/lib/pages';
import { cn } from '@/lib/utils';

const TONE_CLASS = { spot: 'text-spot', sand: 'text-sand', mute: 'text-mute' } as const;

function segmentBackground(style: 'solid' | 'dashed' | 'pull', color: string): string {
  if (style === 'solid') return color;
  const c = style === 'pull' ? 'hsl(var(--spot))' : color;
  return `repeating-linear-gradient(90deg, ${c} 0 5px, transparent 5px 10px)`;
}

function Cell({
  cell, lane, selected, onSelect, onNext, dim, onHover,
}: {
  cell: LoomCell;
  lane: LoomLane;
  selected: boolean;
  onSelect: (n: number) => void;
  onNext: () => void;
  dim: boolean;
  onHover: () => void;
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
      onMouseEnter={onHover}
      onFocus={onHover}
      className={cn('relative h-10 border-b border-line', selected && 'bg-panel')}
    >
      <span className={cn('absolute inset-0 transition-opacity duration-150', dim && 'opacity-[0.28]')}>
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
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[15px] h-[15px] rounded-full border-[3px] border-bg"
          style={{ background: lane.color }}
        />
      )}
      {cell.node === 'ring' && (
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[15px] h-[15px] rounded-full border-[2.5px] border-spot bg-bg"
        />
      )}
      </span>
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
  const [hover, setHover] = React.useState<string | null>(null);

  if (lanes.length === 0) {
    return (
      <p className="border-[3px] border-dashed border-line2 p-6 italic text-mute">
        Nothing on the Loom yet. Threads and key NPCs get a lane here once a recap mentions them.
      </p>
    );
  }

  let lastGroup: LoomLane['group'] | null = null;
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[860px]" style={grid} onMouseLeave={() => setHover(null)}>
        <span />
        {columns.map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onSelect(n)}
            aria-pressed={n === selected}
            className={cn(
              'h-[30px] font-mono font-bold text-[12px]',
              n === selected ? 'bg-spot text-spot-on' : 'text-mute',
            )}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={onNext}
          className="h-[30px] font-mono font-bold text-[12px] text-spot outline outline-[1.5px] outline-dashed outline-spot -outline-offset-[1.5px]"
        >
          NEXT
        </button>

        {lanes.map(lane => {
          const head = lane.group !== lastGroup;
          lastGroup = lane.group;
          const cells = loomCells(lane.appearances, columns, lane.pullNext);
          const key = `${lane.ref.kind}:${lane.ref.id}`;
          const dim = hover !== null && hover !== key;
          return (
            <React.Fragment key={key}>
              {head && (
                <div className="col-span-full pt-3.5 pb-1.5 font-mono font-bold text-[11px] tracking-[0.16em] text-mute">
                  {lane.group === 'threads' ? 'THREADS' : 'PEOPLE'}
                </div>
              )}
              <Link
                href={pageHref(lane.ref)}
                onMouseEnter={() => setHover(key)}
                onFocus={() => setHover(key)}
                className={cn(
                  'h-10 flex items-center gap-2 pr-3 border-b border-line min-w-0 transition-opacity duration-150',
                  dim && 'opacity-[0.28]',
                )}
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
                  dim={dim}
                  onHover={() => setHover(key)}
                />
              ))}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/** The Loom's key, drawn with the same marks the lanes use. */
export function LoomLegend() {
  const item = 'inline-flex items-center gap-1.5';
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono font-bold text-[11px] tracking-[0.14em] text-mute">
      <span className={item}><span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-ink" />APPEARS</span>
      <span className={item}><span aria-hidden="true" className="w-5 h-[3px] bg-ink" />ACTIVE</span>
      <span className={item}>
        <span aria-hidden="true" className="w-5 h-[3px]" style={{ background: 'repeating-linear-gradient(90deg, hsl(var(--ink)) 0 4px, transparent 4px 8px)' }} />
        DORMANT
      </span>
      <span className={item}><span aria-hidden="true" className="w-2.5 h-2.5 rounded-full border-2 border-spot" />PULL NEXT</span>
    </span>
  );
}
