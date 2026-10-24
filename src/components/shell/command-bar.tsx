'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { CodexEntryDialog } from '@/components/codex/codex-entry-dialog';
import { useToast } from '@/hooks/use-toast';
import { captureLinks } from '@/lib/mentions';
import { issueTitle, recapOf } from '@/lib/issues';
import { CONDITION_EFFECTS, CONDITIONS, conditionAnchor } from '@/lib/conditions';
import { ruleAnchor } from '@/lib/core-rules';
import {
  DISPLAY_KIND, GLYPH, glyphFor, issueHref, pageHref, pageKindOf, rulesHref, type PageKind,
} from '@/lib/pages';
import { cn } from '@/lib/utils';
import type { CodexKind, Faction } from '@/lib/types';

const MAX_RESULTS = 7;

type Row = {
  key: string;
  glyph: string;
  title: string;
  subtitle?: string;
  type: string;
  run: () => void;
};

type Candidate = {
  key: string;
  glyph: string;
  title: string;
  subtitle?: string;
  type: string;
  href: string;
  /** Searched after the title, at a lower score: recap text, descriptions. */
  body?: string;
};

/**
 * Title matches outrank body matches; within titles, a prefix beats a word
 * start beats anywhere. Zero means no match.
 */
function score(c: Candidate, q: string): number {
  const t = c.title.toLowerCase();
  if (t.startsWith(q)) return 4;
  if (t.split(/[\s'’-]+/).some(w => w.startsWith(q))) return 3;
  if (t.includes(q)) return 2;
  if (c.subtitle?.toLowerCase().includes(q)) return 1.5;
  if (c.body?.toLowerCase().includes(q)) return 1;
  return 0;
}

/** A window of body text around the match, so a recap hit says why it matched. */
function snippetAround(text: string, q: string, radius = 48): string {
  const i = text.toLowerCase().indexOf(q);
  if (i === -1) return '';
  const start = Math.max(0, i - radius);
  const end = Math.min(text.length, i + q.length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
}

/** Kinds a page can be started for from the no-results state. */
const NEW_PAGE_KINDS: { kind: CodexKind; label: string }[] = [
  { kind: 'npc', label: 'person' },
  { kind: 'party', label: 'party member' },
  { kind: 'place', label: 'place' },
  { kind: 'faction', label: 'faction' },
];

/**
 * The always-visible field that replaced the ⌘K Spotlight modal.
 *
 * Two modes, chosen by the first character: search (the default), or `+` to
 * capture a note to the next issue's notes, from any screen.
 */
export function CommandBar() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeCampaign, codex, threads, issues, rules, matcher, live, nextIssueNumber } = useCampaign();

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [value, setValue] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);

  // Stub for creating a page until the inline-editing designs land.
  const [newPage, setNewPage] = React.useState<{ kind: CodexKind; name: string } | null>(null);
  // Stable identity matters: the dialog resets its form whenever `initial` changes.
  const newPageInitial = React.useMemo(() => (newPage ? { name: newPage.name } : null), [newPage]);

  const capturing = value.startsWith('+');
  const captureText = capturing ? value.slice(1).trim() : '';
  const q = capturing ? '' : value.trim().toLowerCase();

  const reset = React.useCallback(() => {
    setValue('');
    setHighlight(0);
    inputRef.current?.blur();
  }, []);

  const go = React.useCallback((href: string) => {
    reset();
    router.push(href);
  }, [reset, router]);

  // ── Shortcuts: `/` when not already typing, and ⌘K / Ctrl-K anywhere. ──
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
      );
      if (typing) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Search index. Rebuilt when the data changes, not per keystroke. ──
  const candidates = React.useMemo<Candidate[]>(() => {
    const out: Candidate[] = [];
    for (const e of codex.entries) {
      const kind = pageKindOf(e.kind);
      if (!kind) continue;
      out.push({
        key: `${kind}:${e.id}`,
        glyph: glyphFor(kind),
        title: e.name,
        subtitle: e.where,
        type: DISPLAY_KIND[kind],
        href: pageHref({ kind, id: e.id }),
        body: [e.wants, e.knows].filter(Boolean).join(' '),
      });
    }
    for (const t of threads ?? []) {
      out.push({
        key: `thread:${t.id}`,
        glyph: GLYPH.thread,
        title: t.title,
        subtitle: t.note || t.status.toUpperCase(),
        type: 'THREAD',
        href: pageHref({ kind: 'thread' as PageKind, id: t.id }),
      });
    }
    for (const s of issues) {
      out.push({
        key: `issue:${s.id}`,
        glyph: GLYPH.issue,
        title: `#${s.sessionNumber} ${issueTitle(s)}`,
        subtitle: s.logline,
        type: 'RECAP',
        href: issueHref(s.sessionNumber),
        body: recapOf(s),
      });
    }
    for (const r of rules) {
      out.push({
        key: `rule:${r.id}`,
        glyph: GLYPH.rule,
        title: r.title,
        subtitle: r.kind === 'house' ? 'House rule' : `5e core · ${r.ref ?? ''}`,
        type: 'RULE',
        href: rulesHref({ anchor: ruleAnchor(r.id) }),
        body: r.text,
      });
    }
    for (const c of CONDITIONS) {
      out.push({
        key: `cond:${c}`,
        glyph: GLYPH.rule,
        title: c,
        subtitle: CONDITION_EFFECTS[c],
        type: 'CONDITION',
        href: rulesHref({ anchor: conditionAnchor(c) }),
      });
    }
    return out;
  }, [codex.entries, threads, issues, rules]);

  const rows = React.useMemo<Row[]>(() => {
    if (capturing || !q) return [];

    const matches = candidates
      .map(c => ({ c, s: score(c, q) }))
      .filter(m => m.s > 0)
      .sort((a, b) => b.s - a.s || a.c.title.localeCompare(b.c.title))
      .slice(0, MAX_RESULTS - 1)
      .map(({ c, s }): Row => ({
        key: c.key,
        glyph: c.glyph,
        title: c.title,
        // A body-only match explains itself with the matching text.
        subtitle: s === 1 && c.body ? snippetAround(c.body, q) : c.subtitle,
        type: c.type,
        run: () => go(c.href),
      }));

    const name = value.trim();
    const out = matches.length > 0 ? matches : NEW_PAGE_KINDS.map(({ kind, label }): Row => ({
      key: `new:${kind}`,
      glyph: '+',
      title: `New ${label} “${name}”`,
      subtitle: 'Start a page for it',
      type: 'NEW',
      run: () => { reset(); setNewPage({ kind, name }); },
    }));

    // Anything the Rulebook doesn't cover goes to the co-pilot, the one place
    // AI lives. It opens with the question typed in, not sent: sending costs.
    out.push({
      key: 'ask-copilot',
      glyph: GLYPH.copilot,
      title: `Ask the co-pilot: “${name}”`,
      subtitle: 'Opens the Table with the question ready to send',
      type: 'CO-PILOT',
      run: () => go(`/table?ask=${encodeURIComponent(name)}`),
    });
    return out;
  }, [capturing, q, value, candidates, go, reset]);

  const noMatches = rows.length > 0 && rows[0].type === 'NEW';
  const captureLinked = React.useMemo(
    () => (captureText ? captureLinks(captureText, matcher) : []),
    [captureText, matcher],
  );

  React.useEffect(() => { setHighlight(0); }, [q, capturing]);

  const doCapture = () => {
    if (!captureText || !activeCampaign) return;
    live.addCapture(captureText, captureLinked);
    const linked = captureLinked.length ? ` · LINKED ${captureLinked.join(' · ').toUpperCase()}` : '';
    toast({ title: `CAPTURED TO #${nextIssueNumber}${linked}` });
    reset();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      reset();
      return;
    }
    if (capturing) {
      if (e.key === 'Enter') { e.preventDefault(); doCapture(); }
      return;
    }
    if (rows.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => (h + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => (h - 1 + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      rows[Math.min(highlight, rows.length - 1)]?.run();
    }
  };

  const open = focused && value.trim().length > 0;
  const listId = 'command-results';

  return (
    <div className="relative flex-1 min-w-0 max-w-[620px] ml-auto">
      <div
        className={cn(
          'h-[42px] flex items-center gap-2 px-3 bg-panel border-[1.5px]',
          capturing ? 'border-spot' : 'border-line2',
        )}
      >
        <span aria-hidden="true" className={cn('font-mono w-4 text-center', capturing ? 'text-spot' : 'text-mute')}>
          {capturing ? '+' : '⌕'}
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search anything — or start with + to capture a note"
          aria-label="Search, or start with + to capture a note"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && !capturing && rows[highlight] ? `cmd-${rows[highlight].key}` : undefined}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 min-w-0 bg-transparent outline-none text-[18px] placeholder:text-mute"
        />
        <kbd className="font-mono text-[11px] px-1.5 border border-line2 text-mute">/</kbd>
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={capturing ? 'Capture' : 'Search results'}
          className="absolute left-0 right-0 top-[48px] z-50 bg-bg border-2 border-ink shadow-print"
          // Keep focus in the input so a click doesn't blur and close the list first.
          onMouseDown={e => e.preventDefault()}
        >
          {capturing ? (
            <button
              type="button"
              role="option"
              aria-selected="true"
              onClick={doCapture}
              disabled={!captureText}
              className="w-full text-left px-4 py-3 bg-panel disabled:opacity-60"
            >
              <div className="flex justify-between font-mono text-[11px] font-bold tracking-[0.16em] text-spot">
                <span>{GLYPH.note} CAPTURE TO SESSION {nextIssueNumber} NOTES</span>
                <span>ENTER ↵</span>
              </div>
              <div className="text-[19px] mt-1">{captureText || 'Type the note…'}</div>
              {captureLinked.length > 0 && (
                <div className="font-mono text-[11px] tracking-[0.14em] text-mute mt-1">
                  WILL LINK → {captureLinked.join(' · ').toUpperCase()}
                </div>
              )}
            </button>
          ) : (
            <>
              {noMatches && (
                <p className="px-4 py-3 italic text-[15px] text-mute">
                  No page yet. Start with + to capture it as a note.
                </p>
              )}
              {rows.map((r, i) => (
                <button
                  key={r.key}
                  id={`cmd-${r.key}`}
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  onClick={r.run}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    'w-full grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left',
                    i === highlight && 'bg-panel',
                  )}
                >
                  <span aria-hidden="true" className="text-center">{r.glyph}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-[18px] truncate">{r.title}</span>
                    {r.subtitle && (
                      <span className="block italic text-[15px] text-mute truncate">{r.subtitle}</span>
                    )}
                  </span>
                  <span className={cn('font-mono text-[11px] tracking-[0.14em]', r.type === 'CO-PILOT' ? 'text-holo' : 'text-mute')}>{r.type}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {activeCampaign && (
        <CodexEntryDialog
          open={!!newPage}
          onOpenChange={o => { if (!o) setNewPage(null); }}
          kind={newPage?.kind ?? 'npc'}
          campaignId={activeCampaign.id}
          initial={newPageInitial}
          factions={(codex.raw.factions ?? []) as Faction[]}
          onSaved={id => {
            const kind = newPage && pageKindOf(newPage.kind);
            if (id && kind) router.push(pageHref({ kind, id }));
          }}
        />
      )}
    </div>
  );
}
