'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { CodexEntryDialog } from '@/components/codex/codex-entry-dialog';
import { RecapDraft } from '@/components/issue/recap-draft';
import { RecapText } from '@/components/issue/recap-text';
import { ImageSlot } from '@/components/shared/image-slot';
import { MonoLabel, SectionHeader } from '@/components/shared/section-header';
import { IssueStrip } from '@/components/story/panel-strip';
import { useImageUpload, useSessionWriter } from '@/firebase';
import { agoLabel, issueLabel, issueTitle, recapOf, sessionDate } from '@/lib/issues';
import { refKey } from '@/lib/mentions';
import { DISPLAY_KIND, GLYPH, issueHref, pageHref } from '@/lib/pages';
import { cn } from '@/lib/utils';
import type { Faction, MentionRef } from '@/lib/types';

const navButton = 'h-[34px] inline-flex items-center px-3 border-[1.5px] border-line2 font-mono font-bold text-[12px] tracking-[0.14em] hover:border-ink';

export default function IssuePage() {
  return (
    <React.Suspense fallback={null}>
      <Issue />
    </React.Suspense>
  );
}

function Issue() {
  const { n } = useParams<{ n: string }>();
  const params = useSearchParams();
  const number = Number(n);
  const {
    activeCampaign, issues, latestIssue, nextIssueNumber, mentions, matcher, lanes, threads, codex,
  } = useCampaign();
  const { updateSession, setMentionOverride } = useSessionWriter(activeCampaign?.id);
  const { upload, remove } = useImageUpload(activeCampaign?.id);
  // Captured on click, not derived: the dialog resets its form whenever
  // `initial` changes, and a live snapshot would do that mid-edit.
  const [editInitial, setEditInitial] = React.useState<Record<string, unknown> | null>(null);

  const index = issues.findIndex(s => s.sessionNumber === number);
  const issue = index === -1 ? null : issues[index];
  const prev = index > 0 ? issues[index - 1] : null;
  const next = index !== -1 && index < issues.length - 1 ? issues[index + 1] : null;

  const ignored = React.useMemo(
    () => new Set((issue?.mentionOverrides?.ignore ?? []).map(refKey)),
    [issue?.mentionOverrides?.ignore],
  );

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

  const onCover = async (file: File) => {
    const url = await upload(file, 'covers', issue.id);
    await updateSession(issue.id, { coverUrl: url });
    void remove(issue.coverUrl);
  };

  const ignoredRefs: MentionRef[] = issue.mentionOverrides?.ignore ?? [];

  return (
    <div className="max-w-[1240px] mx-auto w-full px-[clamp(20px,3vw,48px)] pt-8 pb-24 flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="font-mono text-[12px] tracking-[0.12em] text-mute">
          <Link href="/" className="hover:text-ink">← STORY</Link>
          {' / '}
          <Link href={`/?issue=${issue.sessionNumber}`} className="hover:text-ink">THE LONGBOX</Link>
          {' / '}{issueLabel(issue.sessionNumber).toUpperCase()}
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
            : <span aria-disabled="true" className={cn(navButton, 'opacity-35 pointer-events-none')}>← #{issue.sessionNumber}</span>}
          {next
            ? <Link href={issueHref(next.sessionNumber)} className={navButton}>#{next.sessionNumber} →</Link>
            : issue.id === latestIssue?.id && (
              <Link href="/table?run=1" className={cn(navButton, 'bg-spot text-spot-on border-spot hover:border-spot')}>
                RUN #{nextIssueNumber} →
              </Link>
            )}
        </div>
      </div>

      <header className="flex flex-wrap items-end gap-10 pb-9 border-b-[3px] border-ink">
        <ImageSlot
          url={issue.coverUrl}
          alt={`cover of issue ${issue.sessionNumber}`}
          onFile={onCover}
          clickToUpload
          emptyLabel="Click or drop to add a cover"
          className="flex-none w-[clamp(200px,22vw,280px)] aspect-[2/3] border-[3px] border-ink shadow-print-lg"
        >
          <span className="absolute top-0 left-0 z-[1] px-2.5 bg-ink text-bg font-headline font-black text-[44px] leading-tight pointer-events-none">
            #{issue.sessionNumber}
          </span>
        </ImageSlot>
        <div className="flex-1 min-w-[280px] flex flex-col gap-3">
          <MonoLabel className="text-spot">{issueLabel(issue.sessionNumber)}{ago ? ` · ${ago}` : ''}</MonoLabel>
          <h1 className="font-headline font-black leading-[0.84] text-[clamp(56px,7vw,112px)] [text-wrap:balance]">
            {issueTitle(issue)}
          </h1>
          {issue.logline && <p className="italic text-[23px] leading-[1.4] max-w-[40ch]">{issue.logline}</p>}
        </div>
      </header>

      <IssueStrip issue={issue} size="lg" />

      <div className="flex flex-wrap gap-14">
        <article className="flex-[1.5_1_480px] max-w-[66ch] flex flex-col gap-5">
          <SectionHeader glyph={GLYPH.issue} label="The Recap" />
          {recap.trim() ? (
            <RecapText content={recap} ignore={ignored} className="text-[21px] leading-[1.64] space-y-[18px]" />
          ) : (
            <RecapDraft issue={issue} autoStart={params.get('draft') === 'recap'} />
          )}
        </article>

        <aside className="flex-[1_1_300px] max-w-[400px] flex flex-col gap-8">
          <section className="flex flex-col">
            <SectionHeader glyph={GLYPH.thread} label="In this issue" meta={idx?.refs.length ?? 0} as="h3" className="mb-2" />
            {(idx?.refs ?? []).length === 0 && (
              <p className="italic text-mute">Nobody known is named in this recap yet.</p>
            )}
            {(idx?.refs ?? []).map(ref => {
              const key = refKey(ref);
              const auto = idx?.via.get(key) === 'detected';
              return (
                <div key={key} className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 border-b border-line">
                  <span aria-hidden="true" className="w-3 h-3 rounded-full bg-mute" style={laneColor.has(key) ? { background: laneColor.get(key) } : undefined} />
                  <Link href={pageHref(ref)} className="truncate font-semibold text-[18px] hover:text-spot">
                    {matcher.nameOf(ref) ?? 'Unknown'}
                  </Link>
                  <MonoLabel className="text-mute">{DISPLAY_KIND[ref.kind]}</MonoLabel>
                  {auto && (
                    // Found by name, without a [[link]]. The DM keeps or drops it.
                    <div className="col-start-2 col-span-2 flex flex-wrap items-center gap-x-3 font-mono font-bold text-[11px] tracking-[0.14em]">
                      <span className="text-mute">FOUND BY NAME</span>
                      <button type="button" onClick={() => setMentionOverride(issue.id, ref, 'confirm')} className="hover:text-spot">✓ KEEP</button>
                      <button type="button" onClick={() => setMentionOverride(issue.id, ref, 'ignore')} className="hover:text-spot">✕ NOT THIS</button>
                    </div>
                  )}
                </div>
              );
            })}
            {ignoredRefs.length > 0 && (
              <p className="pt-2 font-mono text-[11px] tracking-[0.12em] text-mute">
                IGNORED HERE:{' '}
                {ignoredRefs.map((ref, i) => (
                  <React.Fragment key={refKey(ref)}>
                    {i > 0 && ' · '}
                    <button type="button" onClick={() => setMentionOverride(issue.id, ref, null)} className="underline hover:text-ink">
                      {(matcher.nameOf(ref) ?? 'Unknown').toUpperCase()} (UNDO)
                    </button>
                  </React.Fragment>
                ))}
              </p>
            )}
          </section>

          {leftOpen.length > 0 && (
            <section className="flex flex-col">
              <SectionHeader label={`Left open after #${issue.sessionNumber}`} as="h3" className="mb-2" />
              {leftOpen.map(({ t, pulled }) => (
                <Link key={t.id} href={pageHref({ kind: 'thread', id: t.id })} className="flex justify-between gap-3 py-2 border-b border-line hover:text-spot">
                  <span className="truncate text-[17px]">{t.title}</span>
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
