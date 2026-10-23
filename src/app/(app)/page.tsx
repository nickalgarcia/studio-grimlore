'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { Loom } from '@/components/story/loom';
import { MonoLabel, SectionHeader } from '@/components/shared/section-header';
import { agoLabel, issueLabel, issueTitle, sessionDate, shortDate } from '@/lib/issues';
import { refKey } from '@/lib/mentions';
import { GLYPH, issueHref, pageHref } from '@/lib/pages';
import { cn } from '@/lib/utils';

/** `useSearchParams` needs a Suspense boundary or the route can't prerender. */
export default function StoryPage() {
  return (
    <React.Suspense fallback={null}>
      <Story />
    </React.Suspense>
  );
}

function Story() {
  const router = useRouter();
  const params = useSearchParams();
  const {
    activeCampaign, issues, latestIssue, nextIssueNumber, prep, threads, lanes, mentions, matcher,
  } = useCampaign();

  // The selected issue lives in the URL so it survives a reload.
  const requested = Number(params.get('issue'));
  const selected = issues.find(s => s.sessionNumber === requested) ?? latestIssue;
  const select = (n: number) => router.replace(`/?issue=${n}`, { scroll: false });
  const toPrep = () => router.push('/prep');

  const columns = React.useMemo(() => issues.map(s => s.sessionNumber), [issues]);
  const pulling = (threads ?? []).filter(t => t.pullNext);
  const laneByKey = React.useMemo(() => new Map(lanes.map(l => [refKey(l.ref), l])), [lanes]);

  // The newest issue sits at the right end of the shelf; start scrolled there.
  const shelfRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = shelfRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [issues.length]);

  const inThisIssue = selected ? mentions.byIssue.get(selected.sessionNumber)?.refs ?? [] : [];

  return (
    <div className="w-full max-w-[1240px] mx-auto px-[clamp(20px,3vw,48px)] pt-9 pb-24 flex flex-col gap-[52px]">
      {/* ── Masthead ── */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <MonoLabel className="text-mute">
            Campaign · {issues.length} {issues.length === 1 ? 'issue' : 'issues'} · {lanes.length} lines tracked
          </MonoLabel>
          <h1 className="font-headline font-black uppercase leading-[0.84] text-[clamp(52px,6.4vw,104px)]">
            {activeCampaign?.name}
          </h1>
        </div>

        <div className="flex flex-[0_1_420px] border-[3px] border-ink">
          <div className="flex-1 min-w-0 px-4 py-3.5">
            <MonoLabel className="text-spot">
              Next · {issueLabel(nextIssueNumber)}{shortDate(prep?.scheduledAt) ? ` · ${shortDate(prep?.scheduledAt)}` : ''}
            </MonoLabel>
            <div className="font-headline font-black text-[28px] uppercase leading-none mt-1">
              {prep?.prep?.sessionTitle ?? 'Not prepped yet'}
            </div>
            {pulling.length > 0 && (
              <p className="italic text-mute mt-1">Pull: {pulling.map(t => t.title).join(' · ')}</p>
            )}
            <Link href="/prep" className="inline-block mt-2 font-mono font-bold text-[12px] tracking-[0.16em]">
              OPEN PREP →
            </Link>
          </div>
          <Link
            href="/table"
            className="flex-none w-24 flex flex-col items-center justify-center bg-spot text-spot-on border-l-[3px] border-ink font-headline font-black text-[22px] leading-none"
          >
            RUN<span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      {/* ── The Longbox ── */}
      <section className="flex flex-col gap-3">
        <SectionHeader glyph={GLYPH.rule} label="The Longbox" meta="Every session is an issue" />
        <div ref={shelfRef} className="flex gap-3 overflow-x-auto px-0.5 pt-2 pb-3.5">
          {issues.map(s => {
            const on = s.sessionNumber === selected?.sessionNumber;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => select(s.sessionNumber)}
                aria-pressed={on}
                className="flex-none w-[150px] text-left"
              >
                <span className={cn('relative block aspect-[2/3] border-[3px] bg-panel', on ? 'border-spot' : 'border-ink')}>
                  <span className={cn(
                    'absolute top-0 left-0 px-2 font-headline font-black text-[30px] leading-tight',
                    on ? 'bg-spot text-spot-on' : 'bg-ink text-bg',
                  )}>
                    #{s.sessionNumber}
                  </span>
                </span>
                <span className={cn('block mt-2 font-headline font-extrabold text-[16px] uppercase leading-tight', on && 'text-spot')}>
                  {issueTitle(s)}
                </span>
              </button>
            );
          })}
          <Link
            href="/prep"
            className="flex-none w-[150px] aspect-[2/3] border-[3px] border-dashed border-spot flex flex-col items-center justify-center text-spot"
          >
            <span className="font-headline font-black text-[44px] leading-none">#{nextIssueNumber}</span>
            <MonoLabel>Next{shortDate(prep?.scheduledAt) ? ` · ${shortDate(prep?.scheduledAt)}` : ''}</MonoLabel>
          </Link>
        </div>
      </section>

      {/* ── The Loom ── */}
      <section className="flex flex-col gap-3">
        <SectionHeader glyph={GLYPH.thread} label="The Loom" meta="● appears · — active · ┄ dormant · ◯ pull next" />
        <Loom lanes={lanes} columns={columns} selected={selected?.sessionNumber ?? null} onSelect={select} onNext={toPrep} />
      </section>

      {/* ── Selected issue ── */}
      {selected ? (
        <section className="flex flex-wrap gap-9">
          <div className="flex-[0_1_300px] min-w-[240px] flex flex-col gap-3">
            <MonoLabel className="text-spot">
              {issueLabel(selected.sessionNumber)}
              {agoLabel(sessionDate(selected)) ? ` · ${agoLabel(sessionDate(selected))}` : ''}
            </MonoLabel>
            <h2 className="font-headline font-black uppercase text-[52px] leading-[0.86]">{issueTitle(selected)}</h2>
            {selected.logline && <p className="italic text-[19px]">{selected.logline}</p>}
            {inThisIssue.length > 0 && (
              <div className="flex flex-col gap-2">
                <MonoLabel className="text-mute">In this issue</MonoLabel>
                <div className="flex flex-wrap gap-2">
                  {inThisIssue.map(ref => (
                    <Link
                      key={refKey(ref)}
                      href={pageHref(ref)}
                      className="inline-flex items-center gap-2 px-2.5 py-1 border-[1.5px] border-line2"
                    >
                      <span
                        aria-hidden="true"
                        className="w-2.5 h-2.5 rounded-full bg-mute"
                        style={laneByKey.get(refKey(ref)) ? { background: laneByKey.get(refKey(ref))!.color } : undefined}
                      />
                      {matcher.nameOf(ref) ?? 'Unknown'}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <Link href={issueHref(selected.sessionNumber)} className="font-mono font-bold text-[12px] tracking-[0.16em]">
              READ FULL RECAP →
            </Link>
          </div>
          <div className="flex-[1_1_560px] border-[3px] border-dashed border-line2 min-h-[320px] flex items-center justify-center p-6 text-center">
            <MonoLabel className="text-mute">The three-panel strip arrives in Stage 5</MonoLabel>
          </div>
        </section>
      ) : (
        <p className="italic text-mute">No issues yet. Run a session and end it, and it becomes Issue #1.</p>
      )}
    </div>
  );
}
