'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { getBeatsDraft } from '@/app/actions';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { ImageSlot } from '@/components/shared/image-slot';
import { MonoLabel } from '@/components/shared/section-header';
import { idTokenFor, useImageUpload, useSessionWriter, useUser, type WithId } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { recapOf } from '@/lib/issues';
import { GLYPH } from '@/lib/pages';
import { cn } from '@/lib/utils';
import type { Session, SessionBeat } from '@/lib/types';

const MAX_BEATS = 3;

type Size = 'sm' | 'lg';

/** Story's strip is the small one; the Issue reader's is bigger in every dimension. */
const SIZES: Record<Size, { grid: string; panel: string; caption: string; word: string }> = {
  sm: {
    grid: 'grid-cols-[repeat(auto-fit,minmax(200px,1fr))]',
    panel: 'min-h-[320px]',
    caption: 'text-[16px]',
    word: 'text-[clamp(44px,4.6vw,72px)]',
  },
  lg: {
    grid: 'grid-cols-[repeat(auto-fit,minmax(220px,1fr))]',
    panel: 'min-h-[380px]',
    caption: 'text-[17px]',
    word: 'text-[clamp(52px,5.4vw,86px)]',
  },
};

function Caption({ text, size }: { text: string; size: Size }) {
  if (!text) return null;
  return (
    <p className={cn(
      'absolute top-2.5 left-2.5 max-w-[calc(100%-20px)] z-[1] px-2.5 py-2 bg-cap text-cap-ink border-2 border-ink italic leading-snug pointer-events-none',
      SIZES[size].caption,
    )}>
      {text}
    </p>
  );
}

function PanelNumber({ i, of }: { i: number; of: number }) {
  return (
    <span className="absolute bottom-0 right-0 z-[1] px-2 py-0.5 bg-ink text-bg font-mono font-bold text-[11px] tracking-[0.14em] pointer-events-none">
      {i + 1} / {of}
    </span>
  );
}

/** Three comic panels. Image panels take dropped art; word panels are spot fill and one big word. */
export function PanelStrip({
  beats, size = 'sm', onImage,
}: {
  beats: SessionBeat[];
  size?: Size;
  onImage?: (index: number, file: File) => Promise<void>;
}) {
  const s = SIZES[size];
  return (
    <div className={cn('grid gap-2.5', s.grid)}>
      {beats.map((b, i) => (
        b.kind === 'word' ? (
          <div key={i} className={cn('relative overflow-hidden border-[3px] border-ink bg-spot', s.panel)}>
            <span aria-hidden="true" className="halftone absolute inset-0" />
            <Caption text={b.caption} size={size} />
            <span className={cn(
              'absolute left-4 right-4 bottom-14 font-headline font-black leading-[0.82] text-spot-on -rotate-3 break-words',
              s.word,
            )}>
              {b.word}
            </span>
            <PanelNumber i={i} of={beats.length} />
          </div>
        ) : (
          <ImageSlot
            key={i}
            url={b.imageUrl}
            alt={`Panel ${i + 1} art`}
            onFile={file => onImage ? onImage(i, file) : Promise.resolve()}
            clickToUpload={false}
            className={cn('border-[3px] border-ink', s.panel)}
          >
            <Caption text={b.caption} size={size} />
            <PanelNumber i={i} of={beats.length} />
          </ImageSlot>
        )
      ))}
    </div>
  );
}

/**
 * Review and edit beats before they're saved, whether the co-pilot drafted
 * them or the DM is fixing existing ones. Provisional layout until the
 * inline-editing design arrives; the holo edge marks co-pilot work.
 */
function BeatsEditor({
  initial, fromCopilot, onSave, onCancel,
}: {
  initial: SessionBeat[];
  fromCopilot: boolean;
  onSave: (beats: SessionBeat[]) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [beats, setBeats] = React.useState<SessionBeat[]>(initial);
  const set = (i: number, patch: Partial<SessionBeat>) =>
    setBeats(prev => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const field = 'w-full bg-panel border-[1.5px] border-line2 px-2.5 py-1.5 outline-none focus:border-ink';
  return (
    <div className={cn('border-[3px] p-4 flex flex-col gap-4', fromCopilot ? 'border-holo' : 'border-ink')}>
      <MonoLabel className={fromCopilot ? 'text-holo' : undefined}>
        {fromCopilot ? `${GLYPH.copilot} Co-pilot draft · edit, then save` : 'Edit panels'}
      </MonoLabel>
      {beats.map((b, i) => (
        <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-start">
          <div className="flex border-[1.5px] border-ink" role="group" aria-label={`Panel ${i + 1} kind`}>
            {(['image', 'word'] as const).map(k => (
              <button
                key={k}
                type="button"
                aria-pressed={b.kind === k}
                onClick={() => set(i, { kind: k })}
                className={cn('px-2.5 py-1 font-mono font-bold text-[11px] tracking-[0.14em] uppercase', b.kind === k && 'bg-ink text-bg')}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <textarea
              value={b.caption}
              onChange={e => set(i, { caption: e.target.value })}
              rows={2}
              aria-label={`Panel ${i + 1} caption`}
              className={cn(field, 'italic text-[16px] resize-y')}
            />
            {b.kind === 'word' && (
              <input
                value={b.word ?? ''}
                onChange={e => set(i, { word: e.target.value.toUpperCase() })}
                aria-label={`Panel ${i + 1} word`}
                placeholder="BETRAYED."
                className={cn(field, 'font-headline font-black text-[22px]')}
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => setBeats(prev => prev.filter((_, j) => j !== i))}
            aria-label={`Remove panel ${i + 1}`}
            className="h-8 px-2 font-mono font-bold text-[12px] text-mute hover:text-ink"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {beats.length < MAX_BEATS && (
          <button
            type="button"
            onClick={() => setBeats(prev => [...prev, { kind: 'image', caption: '' }])}
            className="h-9 px-3 border-[1.5px] border-line2 font-mono font-bold text-[12px] tracking-[0.14em]"
          >
            + PANEL
          </button>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onCancel} className="h-9 px-3 border-[1.5px] border-line2 font-mono font-bold text-[12px] tracking-[0.14em]">
          DISCARD
        </button>
        <button
          type="button"
          onClick={() => onSave(beats.filter(b => b.caption.trim() || b.word?.trim()))}
          className="h-9 px-4 bg-spot text-spot-on font-headline font-black text-[17px] uppercase"
        >
          Save panels
        </button>
      </div>
    </div>
  );
}

/**
 * An issue's strip with everything around it: upload into panels, the
 * NOT ILLUSTRATED YET state, co-pilot drafting, and editing.
 */
export function IssueStrip({ issue, size = 'sm' }: { issue: WithId<Session>; size?: Size }) {
  const { activeCampaign } = useCampaign();
  const { user } = useUser();
  const { toast } = useToast();
  const { updateSession } = useSessionWriter(activeCampaign?.id);
  const { upload, remove } = useImageUpload(activeCampaign?.id);

  const [editing, setEditing] = React.useState<{ beats: SessionBeat[]; fromCopilot: boolean } | null>(null);
  const [drafting, setDrafting] = React.useState(false);

  // A different issue selected on Story: drop any half-finished edit.
  React.useEffect(() => { setEditing(null); }, [issue.id]);

  const beats = (issue.beats ?? []).slice(0, MAX_BEATS);
  const recap = recapOf(issue).trim();

  const onImage = async (i: number, file: File) => {
    const url = await upload(file, 'panels', `${issue.id}-${i}`);
    const old = beats[i]?.imageUrl;
    await updateSession(issue.id, { beats: beats.map((b, j) => (j === i ? { ...b, imageUrl: url } : b)) });
    void remove(old);
  };

  const draft = async () => {
    if (!activeCampaign) return;
    setDrafting(true);
    const { data, error } = await getBeatsDraft(await idTokenFor(user), {
      campaignName: activeCampaign.name,
      sessionNumber: issue.sessionNumber,
      title: issue.title,
      logline: issue.logline,
      recap: recap.slice(0, 16_000),
    });
    setDrafting(false);
    if (!data) {
      toast({ variant: 'destructive', title: 'No draft', description: error ?? 'Try again.' });
      return;
    }
    setEditing({ beats: data.beats, fromCopilot: true });
  };

  const save = async (next: SessionBeat[]) => {
    // Keep art already dropped into a panel at the same position.
    const merged = next.map((b, i) => {
      const art = b.kind === 'image' ? beats[i]?.imageUrl : undefined;
      const clean: SessionBeat = { kind: b.kind, caption: b.caption.trim() };
      if (b.kind === 'word' && b.word?.trim()) clean.word = b.word.trim();
      if (art) clean.imageUrl = art;
      return clean;
    });
    await updateSession(issue.id, { beats: merged });
    setEditing(null);
  };

  if (editing) {
    return <BeatsEditor initial={editing.beats} fromCopilot={editing.fromCopilot} onSave={save} onCancel={() => setEditing(null)} />;
  }

  if (beats.length === 0) {
    return (
      <div className={cn('border-[3px] border-dashed border-line2 p-6 flex flex-col items-start justify-center gap-3', SIZES[size].panel)}>
        <MonoLabel>Not illustrated yet</MonoLabel>
        <p className="italic text-[17px] text-mute max-w-[46ch]">
          {recap
            ? 'Three panels: a caption for each, art you drop in, and one big word. The co-pilot can draft them from the recap.'
            : 'Write the recap first; the panels are drawn from it.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={draft}
            disabled={!recap || drafting}
            className="h-10 px-4 inline-flex items-center gap-2 border-[1.5px] border-holo text-holo font-mono font-bold text-[12px] tracking-[0.14em] disabled:opacity-50"
          >
            {drafting && <Loader2 className="h-4 w-4 animate-spin" />}
            {GLYPH.copilot} DRAFT 3 BEATS
          </button>
          <button
            type="button"
            onClick={() => setEditing({ beats: [{ kind: 'image', caption: '' }], fromCopilot: false })}
            className="h-10 px-4 border-[1.5px] border-line2 font-mono font-bold text-[12px] tracking-[0.14em]"
          >
            WRITE THEM
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <PanelStrip beats={beats} size={size} onImage={onImage} />
      <button
        type="button"
        onClick={() => setEditing({ beats, fromCopilot: false })}
        className="self-end font-mono font-bold text-[11px] tracking-[0.16em] text-mute hover:text-ink"
      >
        EDIT PANELS
      </button>
    </div>
  );
}
