'use client';

import * as React from 'react';
import Link from 'next/link';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { GenerateArtDialog } from '@/components/art/generate-art-dialog';
import { ImageSlot } from '@/components/shared/image-slot';
import { MonoLabel } from '@/components/shared/section-header';
import { useImageUpload, useSessionWriter, type WithId } from '@/firebase';
import { castIdsOf } from '@/lib/art';
import { issueTitle, recapOf, shortDate } from '@/lib/issues';
import { cn } from '@/lib/utils';
import type { Session } from '@/lib/types';

function Cover({
  issue, selected, onSelect, onFile, onGenerate,
}: {
  issue: WithId<Session>;
  selected: boolean;
  onSelect: () => void;
  onFile: (file: File) => Promise<void>;
  onGenerate: () => void;
}) {
  const title = issueTitle(issue);

  return (
    <li
      className={cn(
        'flex-none w-[150px] transition-transform duration-[180ms]',
        selected && '-translate-y-2',
      )}
    >
      <ImageSlot
        url={issue.coverUrl}
        alt={`Cover of issue ${issue.sessionNumber}`}
        onFile={onFile}
        onGenerate={onGenerate}
        generateOnHover
        className={cn('aspect-[2/3] border-[3px]', selected ? 'border-spot' : 'border-ink')}
      >
        <span className={cn(
          'absolute top-0 left-0 z-[1] px-2 font-headline font-black text-[30px] leading-tight pointer-events-none',
          selected ? 'bg-spot text-spot-on' : 'bg-ink text-bg',
        )}>
          #{issue.sessionNumber}
        </span>
        {/* The whole cover selects; dropping a file on it uploads instead. */}
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          aria-label={`Issue ${issue.sessionNumber}: ${title}`}
          className="absolute inset-0 w-full h-full focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-spot focus-visible:-outline-offset-[3px]"
        />
      </ImageSlot>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onSelect}
        className={cn('block w-full text-left mt-2 font-headline font-extrabold text-[16px] leading-tight', selected && 'text-spot')}
      >
        {title}
      </button>
    </li>
  );
}

/**
 * The cover shelf: every played issue, then the dashed next-issue tile.
 * Scrolled to the right end on arrival so the newest issue is in view.
 */
export function Longbox({ selected, onSelect }: { selected: number | null; onSelect: (n: number) => void }) {
  const { activeCampaign, issues, nextIssueNumber, prep, mentions } = useCampaign();
  const { upload, remove } = useImageUpload(activeCampaign?.id);
  const { updateSession } = useSessionWriter(activeCampaign?.id);
  const shelfRef = React.useRef<HTMLUListElement>(null);
  // One generate dialog for the whole shelf, not one per cover.
  const [generating, setGenerating] = React.useState<WithId<Session> | null>(null);

  const uploadCover = (issue: WithId<Session>) => async (file: File) => {
    const url = await upload(file, 'covers', issue.id);
    await updateSession(issue.id, { coverUrl: url });
    void remove(issue.coverUrl);
  };

  // Once per arrival with issues, not on every update: re-scrolling after the
  // DM scrolled back to an old cover would yank the shelf away from them.
  const scrolled = React.useRef(false);
  React.useEffect(() => {
    const el = shelfRef.current;
    if (!el || scrolled.current || issues.length === 0) return;
    el.scrollLeft = el.scrollWidth;
    scrolled.current = true;
  }, [issues.length]);

  const when = shortDate(prep?.scheduledAt);

  return (
    <>
    <ul ref={shelfRef} className="flex gap-3 overflow-x-auto px-0.5 pt-3 pb-3.5" aria-label="Issues">
      {issues.map(s => (
        <Cover
          key={s.id}
          issue={s}
          selected={s.sessionNumber === selected}
          onSelect={() => onSelect(s.sessionNumber)}
          onFile={uploadCover(s)}
          onGenerate={() => setGenerating(s)}
        />
      ))}
      <li className="flex-none w-[150px]">
        <Link
          href="/prep"
          className="aspect-[2/3] border-[3px] border-dashed border-spot flex flex-col items-center justify-center gap-1 text-spot"
        >
          <span className="font-headline font-black text-[44px] leading-none">#{nextIssueNumber}</span>
          <MonoLabel>Next{when ? ` · ${when.split(' ')[0]}` : ''}</MonoLabel>
        </Link>
      </li>
    </ul>
    {generating && (
      <GenerateArtDialog
        open
        onOpenChange={o => { if (!o) setGenerating(null); }}
        kind="cover"
        // issueTitle falls back to "Issue #N", which would read "Issue #2: Issue #2".
        title={generating.title?.trim() ? `Issue #${generating.sessionNumber}: ${generating.title.trim()}` : issueTitle(generating)}
        context={[generating.logline, recapOf(generating)].filter(Boolean).join('\n\n')}
        suggestedCast={castIdsOf(mentions.byIssue.get(generating.sessionNumber)?.refs)}
        onUse={uploadCover(generating)}
      />
    )}
    </>
  );
}
