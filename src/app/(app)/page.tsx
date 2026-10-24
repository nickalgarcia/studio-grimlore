'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { Longbox } from '@/components/story/longbox';
import { Loom, LoomLegend } from '@/components/story/loom';
import { IssueStrip } from '@/components/story/panel-strip';
import { MonoLabel, SectionHeader } from '@/components/shared/section-header';
import { agoLabel, issueLabel, issueTitle, sessionDate, shortDate } from '@/lib/issues';
import { refKey } from '@/lib/mentions';
import { GLYPH, issueHref, pageHref } from '@/lib/pages';

/** `useSearchParams` needs a Suspense boundary or the route can't prerender. */
export default function StoryPage() {
  return (
    <React.Suspense fallback={null}>
      <Story />
    </React.Suspense>
  );
}

/** "The Ondermere Succession" → the last word in spot, as on the masthead. */
function SpotLastWord({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return <>{text}</>;
  return (
    <>
      {words.slice(0, -1).join(' ')} <span className="text-spot">{words[words.length - 1]}</span>
    </>
  );
}

function NextIssueCard() {
  const { nextIssueNumber, prep, threads } = useCampaign();
  const pulling = (threads ?? []).filter(t => t.pullNext);
  const when = shortDate(prep?.scheduledAt);
  return (
    <div className="flex flex-[0_1_420px] min-w-[280px] border-[3px] border-ink">
      <div className="flex-1 min-w-0 px-4 py-3.5 flex flex-col gap-1">
        <MonoLabel className="text-spot">Next · {issueLabel(nextIssueNumber)}{when ? ` · ${when}` : ''}</MonoLabel>
        <div className="font-headline font-black text-[28px] leading-none">
          {prep?.prep?.sessionTitle ?? 'Not prepped yet'}
        </div>
        <p className="italic text-mute">
          {pulling.length ? `Pull: ${pulling.map(t => t.title).join(' · ')}` : 'No threads marked to pull yet.'}
        </p>
        <Link href="/prep" className="mt-1 self-start font-mono font-bold text-[12px] tracking-[0.16em] hover:text-spot">
          OPEN PREP →
        </Link>
      </div>
      <Link
        href="/table"
        className="flex-none w-24 flex flex-col items-center justify-center bg-spot text-spot-on border-l-[3px] border-ink font-headline font-black text-[22px] leading-none hover:bg-ink hover:text-bg"
      >
        RUN<span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

function Story() {
  const router = useRouter();
  const params = useSearchParams();
  const { activeCampaign, issues, latestIssue, lanes, mentions, matcher } = useCampaign();

  // The selected issue lives in the URL so it survives a reload.
  const requested = Number(params.get('issue'));
  const selected = issues.find(s => s.sessionNumber === requested) ?? latestIssue;
  const select = (n: number) => router.replace(`/?issue=${n}`, { scroll: false });
  const toPrep = () => router.push('/prep');

  const columns = React.useMemo(() => issues.map(s => s.sessionNumber), [issues]);
  const laneByKey = React.useMemo(() => new Map(lanes.map(l => [refKey(l.ref), l])), [lanes]);
  const inThisIssue = selected ? mentions.byIssue.get(selected.sessionNumber)?.refs ?? [] : [];
  const ago = selected ? agoLabel(sessionDate(selected)) : null;

  return (
    <div className="w-full max-w-[1240px] mx-auto px-[clamp(20px,3vw,48px)] pt-9 pb-24 flex flex-col gap-[52px]">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <MonoLabel className="text-mute">
            Campaign · {issues.length} {issues.length === 1 ? 'issue' : 'issues'} · {lanes.length} lines tracked
          </MonoLabel>
          <h1 className="font-headline font-black leading-[0.84] text-[clamp(52px,6.4vw,104px)] [text-wrap:balance]">
            <SpotLastWord text={activeCampaign?.name ?? ''} />
          </h1>
        </div>
        <NextIssueCard />
      </div>

      <section className="flex flex-col gap-2">
        <SectionHeader glyph={GLYPH.rule} label="The Longbox" meta="Every session is an issue · drop art on a cover" />
        <Longbox selected={selected?.sessionNumber ?? null} onSelect={select} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader glyph={GLYPH.thread} label="The Loom" meta={<LoomLegend />} />
        <Loom lanes={lanes} columns={columns} selected={selected?.sessionNumber ?? null} onSelect={select} onNext={toPrep} />
      </section>

      {selected ? (
        <section className="flex flex-wrap gap-9" aria-label={`Selected: ${issueLabel(selected.sessionNumber)}`}>
          <div className="flex-[0_1_300px] min-w-[240px] flex flex-col gap-3">
            <MonoLabel className="text-spot">{issueLabel(selected.sessionNumber)}{ago ? ` · ${ago}` : ''}</MonoLabel>
            <h2 className="font-headline font-black text-[52px] leading-[0.86] [text-wrap:balance]">{issueTitle(selected)}</h2>
            {selected.logline && <p className="italic text-[19px] leading-[1.4]">{selected.logline}</p>}
            {inThisIssue.length > 0 && (
              <div className="flex flex-col gap-2 pt-1">
                <MonoLabel className="text-mute">In this issue</MonoLabel>
                <div className="flex flex-wrap gap-1.5">
                  {inThisIssue.map(ref => {
                    const lane = laneByKey.get(refKey(ref));
                    return (
                      <Link
                        key={refKey(ref)}
                        href={pageHref(ref)}
                        className="inline-flex items-center gap-2 px-2.5 py-1 border-[1.5px] border-line2 hover:border-ink"
                      >
                        <span
                          aria-hidden="true"
                          className="w-2.5 h-2.5 rounded-full bg-mute"
                          style={lane ? { background: lane.color } : undefined}
                        />
                        {matcher.nameOf(ref) ?? 'Unknown'}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
            <Link href={issueHref(selected.sessionNumber)} className="pt-1 self-start font-mono font-bold text-[12px] tracking-[0.16em] hover:text-spot">
              READ FULL RECAP →
            </Link>
          </div>
          <div className="flex-[1_1_560px] min-w-0">
            <IssueStrip issue={selected} />
          </div>
        </section>
      ) : (
        <p className="italic text-mute">No issues yet. Run a session and end it, and it becomes Issue #1.</p>
      )}
    </div>
  );
}
