'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { CodexEntryDialog } from '@/components/codex/codex-entry-dialog';
import { Markdown } from '@/components/markdown';
import { MonoLabel, SectionHeader } from '@/components/shared/section-header';
import { agoLabel, issueLabel, issueTitle, plainLinks, recapOf, sessionDate } from '@/lib/issues';
import { refKey } from '@/lib/mentions';
import { DISPLAY_KIND, GLYPH, issueHref, pageHref } from '@/lib/pages';
import { cn } from '@/lib/utils';
import type { Faction } from '@/lib/types';

const navButton = 'h-[34px] inline-flex items-center px-3 border-[1.5px] border-line2 font-mono font-bold text-[12px] tracking-[0.14em]';

export default function IssuePage() {
  const { n } = useParams<{ n: string }>();
  const number = Number(n);
  const {
    activeCampaign, issues, latestIssue, nextIssueNumber, mentions, matcher, lanes, threads, codex,
  } = useCampaign();
  // Captured when EDIT is pressed, not derived: the dialog resets its form
  // whenever `initial` changes, and a live snapshot would do that mid-edit.
  const [editInitial, setEditInitial] = React.useState<Record<string, unknown> | null>(null);

  const index = issues.findIndex(s => s.sessionNumber === number);
  const issue = index === -1 ? null : issues[index];
  const prev = index > 0 ? issues[index - 1] : null;
  const next = index !== -1 && index < issues.length - 1 ? issues[index + 1] : null;

  if (!codex.isLoading && !issue) {
    return (
      <div className="max-w-[1240px] mx-auto w-full px-[clamp(20px,3vw,48px)] pt-8 pb-24">
        <Link href="/" className="font-mono text-[12px] text-mute">← STORY</Link>
        <p className="mt-6 italic text-mute">There is no {issueLabel(number)} in this campaign.</p>
      </div>
    );
  }
  if (!issue) return null;

  const recap = recapOf(issue);
  const idx = mentions.byIssue.get(issue.sessionNumber);
  const laneColor = new Map(lanes.map(l => [refKey(l.ref), l.color]));
  const ago = agoLabel(sessionDate(issue));

  // Unresolved threads that had surfaced by this issue.
  const leftOpen = (threads ?? [])
    .filter(t => t.status !== 'cold')
    .map(t => ({ t, seen: mentions.appearances.get(refKey({ kind: 'thread', id: t.id })) ?? [] }))
    .filter(({ seen }) => seen.length > 0 && seen[0] <= issue.sessionNumber)
    .map(({ t, seen }) => ({ t, pulled: seen.includes(issue.sessionNumber) }));

  return (
    <div className="max-w-[1240px] mx-auto w-full px-[clamp(20px,3vw,48px)] pt-8 pb-24 flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="font-mono text-[12px] tracking-[0.12em] text-mute">
          <Link href="/">← STORY</Link> / <Link href={`/?issue=${issue.sessionNumber}`}>THE LONGBOX</Link> / {issueLabel(issue.sessionNumber).toUpperCase()}
        </nav>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditInitial({ ...(issue as unknown as Record<string, unknown>), id: issue.id })}
            className={navButton}
          >
            EDIT
          </button>
          {prev
            ? <Link href={issueHref(prev.sessionNumber)} className={navButton}>← #{prev.sessionNumber}</Link>
            : <span aria-disabled="true" className={cn(navButton, 'opacity-35')}>← #{issue.sessionNumber}</span>}
          {next
            ? <Link href={issueHref(next.sessionNumber)} className={navButton}>#{next.sessionNumber} →</Link>
            : issue.id === latestIssue?.id && (
              <Link href="/table" className={cn(navButton, 'bg-spot text-spot-on border-spot')}>
                RUN #{nextIssueNumber} →
              </Link>
            )}
        </div>
      </div>

      <header className="flex flex-wrap items-end gap-10 pb-9 border-b-[3px] border-ink">
        <div className="relative w-[clamp(200px,22vw,280px)] aspect-[2/3] border-[3px] border-ink bg-panel">
          <span className="absolute top-0 left-0 px-2 bg-ink text-bg font-headline font-black text-[44px] leading-tight">
            #{issue.sessionNumber}
          </span>
        </div>
        <div className="flex-1 min-w-[280px] flex flex-col gap-3">
          <MonoLabel className="text-spot">{issueLabel(issue.sessionNumber)}{ago ? ` · ${ago}` : ''}</MonoLabel>
          <h1 className="font-headline font-black uppercase leading-[0.84] text-[clamp(56px,7vw,112px)] [text-wrap:balance]">
            {issueTitle(issue)}
          </h1>
          {issue.logline && <p className="italic text-[23px] max-w-[40ch]">{issue.logline}</p>}
        </div>
      </header>

      <div className="flex flex-wrap gap-14">
        <article className="flex-[1.5_1_480px] max-w-[66ch] flex flex-col gap-5">
          <SectionHeader glyph={GLYPH.issue} label="The Recap" />
          {recap.trim() ? (
            <Markdown content={plainLinks(recap)} className="text-[21px] leading-[1.64]" />
          ) : (
            <div className="border-[3px] border-dashed border-line2 p-6">
              <MonoLabel>Recap not written yet</MonoLabel>
              <p className="italic text-mute mt-2">Drafting from your notes arrives in Stage 5. Use EDIT to write one now.</p>
            </div>
          )}
        </article>

        <aside className="flex-[1_1_300px] max-w-[400px] flex flex-col gap-8">
          <section className="flex flex-col gap-2">
            <SectionHeader glyph={GLYPH.thread} label="In this issue" meta={idx?.refs.length ?? 0} as="h3" />
            {(idx?.refs ?? []).map(ref => {
              const key = refKey(ref);
              return (
                <Link key={key} href={pageHref(ref)} className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-3 py-1.5 border-b border-line">
                  <span aria-hidden="true" className="w-3 h-3 rounded-full bg-mute" style={laneColor.has(key) ? { background: laneColor.get(key) } : undefined} />
                  <span className="truncate font-semibold text-[18px]">{matcher.nameOf(ref) ?? 'Unknown'}</span>
                  <MonoLabel className="text-mute">
                    {DISPLAY_KIND[ref.kind]}{idx?.via.get(key) === 'detected' ? ' · AUTO' : ''}
                  </MonoLabel>
                </Link>
              );
            })}
          </section>

          {leftOpen.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionHeader label={`Left open after #${issue.sessionNumber}`} as="h3" />
              {leftOpen.map(({ t, pulled }) => (
                <Link key={t.id} href={pageHref({ kind: 'thread', id: t.id })} className="flex justify-between gap-3 py-1.5 border-b border-line">
                  <span className="truncate">{t.title}</span>
                  <MonoLabel className={pulled ? 'text-spot' : 'text-mute'}>{pulled ? 'Pulled here' : 'Waiting'}</MonoLabel>
                </Link>
              ))}
            </section>
          )}
        </aside>
      </div>

      {activeCampaign && (
        <CodexEntryDialog
          open={!!editInitial}
          onOpenChange={o => { if (!o) setEditInitial(null); }}
          kind="session"
          campaignId={activeCampaign.id}
          initial={editInitial}
          factions={(codex.raw.factions ?? []) as Faction[]}
        />
      )}
    </div>
  );
}
