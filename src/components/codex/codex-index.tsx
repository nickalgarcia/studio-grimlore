'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KIND_LABEL, KIND_LABEL_PLURAL, KIND_ORDER, type CodexFilter } from '@/lib/codex';
import type { CodexEntry } from '@/lib/types';

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
      return (
        e.name.toLowerCase().includes(q) ||
        (e.where ?? '').toLowerCase().includes(q)
      );
    });
  }, [entries, filter, query]);

  const counts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) map.set(e.kind, (map.get(e.kind) ?? 0) + 1);
    return map;
  }, [entries]);

  const filters: CodexFilter[] = ['All', ...KIND_ORDER];

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Search the codex…"
            className="pl-8 h-9"
            aria-label="Search the codex"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {filters.map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => onFilterChange(f)}
              className="h-8 text-xs"
            >
              {f === 'All' ? 'All' : KIND_LABEL_PLURAL[f]}
              {f !== 'All' && counts.get(f) ? (
                <span className="ml-1.5 opacity-60">{counts.get(f)}</span>
              ) : null}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(120px,1.6fr)_84px_minmax(0,1fr)_68px] gap-3 px-3 py-2 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground font-headline">
        <span>Name</span>
        <span>Type</span>
        <span>Where</span>
        <span className="text-right">Seen</span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground font-body italic">
            {entries.length === 0
              ? 'Nothing in the codex yet. Add an NPC, place, faction, or party member.'
              : 'No entries match that filter.'}
          </div>
        ) : (
          visible.map(e => (
            <button
              key={`${e.kind}:${e.id}`}
              type="button"
              onClick={() => onSelect(e)}
              aria-current={selectedId === e.id ? 'true' : undefined}
              className={cn(
                'w-full grid grid-cols-[minmax(120px,1.6fr)_84px_minmax(0,1fr)_68px] gap-3 px-3 py-2.5',
                'items-center text-left border-b border-border/40 transition-colors',
                selectedId === e.id ? 'bg-primary/10' : 'hover:bg-white/5',
              )}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="w-[3px] h-4 flex-shrink-0"
                  style={{ background: e.accent }}
                  aria-hidden="true"
                />
                <span className="truncate text-sm">{e.name}</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {KIND_LABEL[e.kind]}
              </span>
              <span className="truncate text-xs text-muted-foreground">{e.where ?? '—'}</span>
              <span className="text-xs text-muted-foreground text-right">{e.lastSeen ?? ''}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
