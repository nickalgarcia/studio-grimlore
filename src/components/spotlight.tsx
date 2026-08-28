'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Markdown } from '@/components/markdown';
import { getRuleInfo } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, HelpCircle, Loader2, Scroll, Search, Sparkles, User } from 'lucide-react';
import { KIND_LABEL } from '@/lib/codex';
import { cn } from '@/lib/utils';
import type { Campaign, CodexEntry, CodexKind } from '@/lib/types';

type Row =
  | { type: 'entry'; key: string; title: string; meta?: string; kind: string; entry: CodexEntry }
  | { type: 'campaign'; key: string; title: string; meta?: string; kind: string; campaign: Campaign }
  | { type: 'rule'; key: string; title: string; meta?: string; kind: string; term: string };

const KIND_ICON: Partial<Record<CodexKind, React.ReactNode>> = {
  npc: <User className="h-3.5 w-3.5" />,
  session: <Scroll className="h-3.5 w-3.5" />,
};

/**
 * ⌘K over everything: codex entries, campaigns, and a D&D rule lookup.
 *
 * This is the "I need this NPC *now*" path, and it is also where Rules lives —
 * the old top-level Rules tab was a whole screen for one search box.
 */
export function Spotlight({
  open, onOpenChange, entries, campaigns, onSelectEntry, onSelectCampaign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: CodexEntry[];
  campaigns: Campaign[];
  onSelectEntry: (entry: CodexEntry) => void;
  onSelectCampaign: (campaign: Campaign) => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = React.useState('');
  const [cursor, setCursor] = React.useState(0);
  const [ruleTerm, setRuleTerm] = React.useState<string | null>(null);
  const [ruleText, setRuleText] = React.useState<string | null>(null);
  const [ruleLoading, setRuleLoading] = React.useState(false);

  // Reset on every open so the palette never reopens showing the last search.
  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    setRuleTerm(null);
    setRuleText(null);
  }, [open]);

  const q = query.trim().toLowerCase();

  const rows = React.useMemo<Row[]>(() => {
    const out: Row[] = [];

    for (const e of entries) {
      if (q && !e.name.toLowerCase().includes(q) && !(e.where ?? '').toLowerCase().includes(q)) continue;
      out.push({
        type: 'entry',
        key: `entry:${e.kind}:${e.id}`,
        title: e.name,
        meta: e.where,
        kind: KIND_LABEL[e.kind],
        entry: e,
      });
      if (out.length >= 30) break;
    }

    for (const c of campaigns) {
      if (q && !c.name.toLowerCase().includes(q)) continue;
      out.push({
        type: 'campaign',
        key: `campaign:${c.id}`,
        title: c.name,
        meta: c.description?.slice(0, 60),
        kind: 'Campaign',
        campaign: c,
      });
    }

    if (q) {
      out.push({
        type: 'rule',
        key: `rule:${q}`,
        title: `Look up “${query.trim()}”`,
        meta: 'D&D 5e rule, condition, or term',
        kind: 'Rule',
        term: query.trim(),
      });
    }

    return out;
  }, [entries, campaigns, q, query]);

  React.useEffect(() => { setCursor(0); }, [q]);

  const runRuleLookup = React.useCallback(async (term: string) => {
    setRuleTerm(term);
    setRuleText(null);
    setRuleLoading(true);
    const { data, error } = await getRuleInfo(term);
    setRuleLoading(false);
    if (error || !data) {
      toast({ variant: 'destructive', title: 'Lookup failed', description: error ?? 'Try again.' });
      setRuleTerm(null);
      return;
    }
    setRuleText(data.explanation);
  }, [toast]);

  const activate = React.useCallback((row: Row) => {
    if (row.type === 'entry') {
      onSelectEntry(row.entry);
      onOpenChange(false);
      return;
    }
    if (row.type === 'campaign') {
      onSelectCampaign(row.campaign);
      onOpenChange(false);
      return;
    }
    // Rules resolve inside the palette — leaving it open is the point, since
    // you are mid-sentence at the table when you ask.
    void runRuleLookup(row.term);
  }, [onSelectEntry, onSelectCampaign, onOpenChange, runRuleLookup]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[cursor];
      if (row) activate(row);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[660px] p-0 gap-0 top-[11vh] translate-y-0
                                border-border/[0.12] border-t-4 border-t-oxblood shadow-modal animate-rise">
        <DialogTitle className="sr-only">Search everything</DialogTitle>

        <div className="flex items-center gap-3 px-[17px] py-[15px] border-b border-border/[0.09]">
          {ruleTerm ? (
            <button
              type="button"
              onClick={() => { setRuleTerm(null); setRuleText(null); }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Back to search results"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <Search className="h-[15px] w-[15px] text-oxblood-bright flex-shrink-0" aria-hidden="true" />
          )}
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Anything — a name, a place, a rule, a session…"
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-[15px] bg-transparent
                       text-bone-body placeholder:text-bone-faint"
            autoFocus
            aria-label="Search everything"
          />
          <span className="font-mono text-[9.5px] text-bone-faint border border-border/[0.14] px-1.5 py-0.5">
            ESC
          </span>
        </div>

        <div className="max-h-[54vh] overflow-y-auto">
          {ruleTerm ? (
            <div className="p-4 space-y-3">
              <div className="label-forge flex items-center gap-2">
                <HelpCircle className="h-3.5 w-3.5" /> {ruleTerm}
              </div>
              {ruleLoading ? (
                <div className="py-8 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                </div>
              ) : ruleText ? (
                <Markdown content={ruleText} className="text-sm text-foreground/90" />
              ) : null}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground font-body italic">
              {entries.length === 0 && campaigns.length === 0
                ? 'Nothing to search yet.'
                : 'Start typing to search.'}
            </div>
          ) : (
            rows.map((row, i) => (
              <button
                key={row.key}
                type="button"
                onClick={() => activate(row)}
                onMouseEnter={() => setCursor(i)}
                className={cn(
                  'w-full flex items-center gap-3 px-[17px] py-2 text-left border-l-[3px] transition-colors',
                  i === cursor
                    ? 'bg-[hsl(var(--oxblood)/0.16)] border-l-oxblood'
                    : 'border-l-transparent hover:bg-[hsl(var(--oxblood)/0.1)]',
                )}
              >
                <span className="text-muted-foreground flex-shrink-0" aria-hidden="true">
                  {row.type === 'rule'
                    ? <HelpCircle className="h-3.5 w-3.5" />
                    : row.type === 'campaign'
                      ? <Sparkles className="h-3.5 w-3.5" />
                      : KIND_ICON[row.entry.kind] ?? <Scroll className="h-3.5 w-3.5" />}
                </span>
                <span className="text-[13.5px] text-bone-body flex-shrink-0">{row.title}</span>
                <span className="text-[12px] text-bone-faint truncate flex-1 min-w-0">{row.meta}</span>
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-bone-faint flex-shrink-0">
                  {row.kind}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 px-[17px] py-2 border-t border-border/[0.09]
                        bg-[hsl(var(--background)/0.6)] font-mono text-[9.5px] uppercase tracking-[0.14em] text-bone-faint">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
