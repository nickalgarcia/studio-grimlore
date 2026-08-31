'use client';

import * as React from 'react';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KIND_LABEL, KIND_LABEL_PLURAL, KIND_ORDER, type CodexFilter } from '@/lib/codex';
import type { CodexEntry } from '@/lib/types';

/**
 * Columns are `minmax(120px, 1.6fr) 84px minmax(0, 1fr) 68px`.
 *
 * The `minmax(120px, …)` on the name is required — a bare `1fr` collapses it to
 * an ellipsis — and every `1fr` beside a fixed track must be `minmax(0, 1fr)`
 * or it refuses to shrink below min-content and overflows horizontally.
 */
const COLS = 'grid-cols-[minmax(120px,1.6fr)_84px_minmax(0,1fr)_68px]';

export function CodexIndex({
  entries, isLoading, filter, onFilterChange, query, onQueryChange, selectedId, onSelect,
}: {
  entries: CodexEntry[];
  isLoading: boolean;
  filter: CodexFilter;
  onFilterChange: (f: CodexFilter) => void;
  query: string;
  onQueryChange: (q: string) => void;
  selectedId: string | null;
  onSelect: (entry: CodexEntry) => void;
}) {
  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(e => {
      if (filter !== 'All' && e.kind !== filter) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || (e.where ?? '').toLowerCase().includes(q);
    });
  }, [entries, filter, query]);

  const counts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) map.set(e.kind, (map.get(e.kind) ?? 0) + 1);
    return map;
  }, [entries]);

  const filters: CodexFilter[] = ['All', ...KIND_ORDER];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 flex-shrink-0">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-bone-faint" />
          <input
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Search the codex…"
            aria-label="Search the codex"
            className="w-full h-8 pl-8 pr-2 outline-none bg-[hsl(var(--background)/0.72)]
                       border border-border/[0.09] text-[12.5px] text-bone-body placeholder:text-bone-faint
                       focus:border-oxblood transition-colors"
          />
        </div>
        <div className="flex gap-0.5 flex-wrap">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              aria-pressed={filter === f}
              className={cn(
                'font-mono text-[10px] font-bold tracking-[0.12em] px-[11px] py-[5px] border transition-all duration-150',
                filter === f
                  ? 'text-bone bg-oxblood border-oxblood'
                  : 'text-bone-faint border-border/[0.12] hover:text-bone-dim',
              )}
            >
              {f === 'All' ? 'ALL' : KIND_LABEL_PLURAL[f].toUpperCase()}
              {f !== 'All' && counts.get(f) ? (
                <span className="ml-1.5 opacity-60">{counts.get(f)}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className={cn(
        'grid gap-3 px-4 py-[9px] flex-shrink-0',
        'bg-[hsl(var(--oxblood)/0.16)] border-b border-[hsl(var(--oxblood)/0.4)]',
        COLS,
      )}>
        {['NAME', 'TYPE', 'WHERE', 'SEEN'].map((h, i) => (
          <span
            key={h}
            className={cn(
              'font-mono text-[9px] font-extrabold tracking-[0.2em] text-oxblood-pale',
              i === 3 && 'text-right',
            )}
          >
            {h}
          </span>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-oxblood-bright mx-auto" />
          </div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-bone-faint">
            {entries.length === 0
              ? 'Nothing in the codex yet. Add an NPC, place, faction, or party member.'
              : 'No entries match that filter.'}
          </div>
        ) : (
          visible.map((e, i) => (
            <button
              key={`${e.kind}:${e.id}`}
              type="button"
              onClick={() => onSelect(e)}
              aria-current={selectedId === e.id ? 'true' : undefined}
              className={cn(
                'w-full grid gap-3 px-4 py-[11px] items-center text-left',
                'border-b border-border/[0.05] border-l-[3px] transition-colors',
                COLS,
                selectedId === e.id
                  ? 'bg-[hsl(var(--oxblood)/0.2)] border-l-oxblood'
                  : 'border-l-transparent hover:bg-[hsl(var(--oxblood)/0.12)]',
              )}
              style={{ animationDelay: `${(0.12 + Math.min(i, 12) * 0.03).toFixed(2)}s` }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-[3px] h-[17px] flex-shrink-0"
                  style={{ background: e.accent }}
                  aria-hidden="true"
                />
                <span className="truncate text-[13.5px] text-bone-body">{e.name}</span>
              </span>
              <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-bone-faint">
                {KIND_LABEL[e.kind].toUpperCase()}
              </span>
              <span className="truncate text-[12.5px] text-bone-dim">{e.where ?? '—'}</span>
              <span className="font-mono text-[10.5px] text-bone-faint text-right">{e.lastSeen ?? ''}</span>
            </button>
          ))
        )}
      </div>
    </>
  );
}
