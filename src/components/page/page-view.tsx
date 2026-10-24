'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { GenerateArtDialog } from '@/components/art/generate-art-dialog';
import { CodexEntryDialog } from '@/components/codex/codex-entry-dialog';
import { RecapText } from '@/components/issue/recap-text';
import { PageDraft, type DraftableKind } from '@/components/page/page-draft';
import { usePutOnStage } from '@/components/page/use-put-on-stage';
import { ImageSlot } from '@/components/shared/image-slot';
import { MonoLabel, SectionHeader } from '@/components/shared/section-header';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  deleteDocumentNonBlocking, isWritableKind, useEntityWriter, useFirestore, useImageUpload, useThreadWriter, useUser,
} from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { castIdsOf, type ArtKind } from '@/lib/art';
import { EDITABLE_KINDS, KIND_COLLECTION } from '@/lib/codex';
import { issueTitle } from '@/lib/issues';
import { refKey } from '@/lib/mentions';
import { buildPageModel, excerptsFor, relatedRefs, type PageModel, type Tone } from '@/lib/page-model';
import { DISPLAY_KIND, GLYPH, glyphFor, issueHref, pageHref, type PageKind } from '@/lib/pages';
import { cn } from '@/lib/utils';
import type { CodexEntry, CodexKind, Faction, MentionKind, MentionRef } from '@/lib/types';

const TONE: Record<Tone, string> = { spot: 'text-spot', sand: 'text-sand', mute: 'text-mute' };

/** Which kind of generated art fills a page's image slot. */
const PAGE_ART: Partial<Record<PageKind, ArtKind>> = { party: 'portrait', npc: 'portrait', place: 'place', faction: 'faction' };
const actionButton = 'h-[34px] inline-flex items-center px-3 border-[1.5px] border-line2 font-mono font-bold text-[12px] tracking-[0.14em] hover:border-ink';

function SecretBox({ text }: { text: string }) {
  return (
    <div className="relative mt-3 border-2 border-dashed border-spot px-6 pt-[26px] pb-[22px]">
      <span className="absolute -top-[15px] left-[18px] -rotate-2 bg-spot text-spot-on px-2 py-0.5 font-headline font-black text-[17px] tracking-[0.12em]">
        DM EYES ONLY
      </span>
      <p className="text-[19px] leading-[1.55] whitespace-pre-line">{text}</p>
    </div>
  );
}

function TickStrip({ columns, seen, color }: { columns: number[]; seen: number[]; color: string }) {
  const on = new Set(seen);
  if (columns.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-[3px]">
        {columns.map(n => (
          <Link
            key={n}
            href={issueHref(n)}
            aria-label={`Issue #${n}${on.has(n) ? ' (appears)' : ''}`}
            className="w-[15px] h-5 border-[1.5px]"
            style={on.has(n) ? { background: color, borderColor: color } : { borderColor: 'var(--line2)' }}
          />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[11px] text-mute">
        <span>#{columns[0]}</span>
        <span>#{columns[columns.length - 1]}</span>
      </div>
    </div>
  );
}

/** The actions waiting for the inline-editing design: v3's dialog, put on stage and delete. */
function PageActions({ kind, id, entry, name }: { kind: PageKind; id: string; entry: CodexEntry | null; name: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeCampaign, codex, latestIssue } = useCampaign();
  const putOnStage = usePutOnStage(activeCampaign, latestIssue?.sessionNumber ?? 0);
  const { deleteThread } = useThreadWriter(activeCampaign?.id);
  const [editInitial, setEditInitial] = React.useState<Record<string, unknown> | null>(null);

  const remove = async () => {
    if (!user || !activeCampaign) return;
    if (kind === 'thread') {
      await deleteThread(id);
    } else {
      const collection = KIND_COLLECTION[kind as CodexKind];
      const ref = kind === 'concept'
        ? doc(firestore, 'users', user.uid, 'concepts', id)
        : collection ? doc(firestore, 'users', user.uid, 'campaigns', activeCampaign.id, collection, id) : null;
      if (!ref) return;
      await deleteDocumentNonBlocking(ref);
    }
    toast({ title: `${name} deleted` });
    router.push('/');
  };

  const canEdit = !!entry && EDITABLE_KINDS.includes(entry.kind);

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && (
        <button type="button" className={actionButton} onClick={() => setEditInitial({ ...(entry!.source as Record<string, unknown>), id })}>
          EDIT
        </button>
      )}
      {kind === 'npc' && entry && (
        <button type="button" className={actionButton} onClick={() => putOnStage(entry)}>PUT ON STAGE</button>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button type="button" className={actionButton}>DELETE</button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>The page goes for good. Recaps that name it keep their text.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {activeCampaign && entry && (
        <CodexEntryDialog
          open={!!editInitial}
          onOpenChange={o => { if (!o) setEditInitial(null); }}
          kind={entry.kind}
          campaignId={activeCampaign.id}
          initial={editInitial}
          factions={(codex.raw.factions ?? []) as Faction[]}
        />
      )}
    </div>
  );
}

/**
 * One template for every entity kind: hero, kind-specific sections, the DM's
 * secret, a history list, and an aside built from the mentions index.
 */
export function PageView({
  kind, id, source, entry,
}: {
  kind: PageKind;
  id: string;
  source: unknown;
  /** The v3 Codex entry, for the stand-in edit dialog. Threads have none. */
  entry: CodexEntry | null;
}) {
  const { activeCampaign, issues, mentions, lanes, matcher } = useCampaign();
  const write = useEntityWriter(activeCampaign?.id);
  const { upload, remove } = useImageUpload(activeCampaign?.id);
  const [generating, setGenerating] = React.useState(false);

  const model: PageModel = React.useMemo(() => buildPageModel(kind, source), [kind, source]);
  const ref: MentionRef | null = kind === 'concept' ? null : { kind: kind as MentionKind, id };
  const seen = ref ? mentions.appearances.get(refKey(ref)) ?? [] : [];
  const lane = ref ? lanes.find(l => refKey(l.ref) === refKey(ref)) : undefined;
  const color = lane?.color ?? 'hsl(var(--ink))';
  const columns = React.useMemo(() => issues.map(s => s.sessionNumber), [issues]);
  const byNumber = React.useMemo(() => new Map(issues.map(s => [s.sessionNumber, s])), [issues]);

  const recent = [...seen].reverse().slice(0, 4).map(n => byNumber.get(n)).filter(Boolean);
  const related = ref ? relatedRefs(ref, mentions) : [];
  const excerpts = React.useMemo(
    () => (ref && model.isStub && model.draftable ? excerptsFor(ref, issues, seen, matcher) : []),
    // `ref` is rebuilt each render from kind and id, which are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, id, model.isStub, model.draftable, issues, seen, matcher],
  );

  // The recaps' last few mentions, for the co-pilot's art brief: a page's own
  // text says who someone is, the recaps say what they looked like doing it.
  // Only computed while the generate dialog is open.
  const artExcerpts = React.useMemo(
    () => (generating && ref ? excerptsFor(ref, issues, seen, matcher, { limit: 3, maxChars: 1_500 }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generating, kind, id, issues, seen, matcher],
  );

  // Stored history wins; otherwise the issues it appears in, told by their loglines.
  const history = model.history
    ?? seen.map(n => ({ session: n, text: byNumber.get(n)?.logline || issueTitle(byNumber.get(n) ?? { sessionNumber: n }) }));

  const onImage = model.image && isWritableKind(kind)
    ? async (file: File) => {
      const url = await upload(file, model.image!.field === 'portraitUrl' ? 'portraits' : 'images', id);
      await write(kind, id, { [model.image!.field]: url });
      void remove(model.image!.url);
    }
    : null;

  return (
    <div className="max-w-[1240px] mx-auto w-full px-[clamp(20px,3vw,48px)] pt-8 pb-24 flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="font-mono text-[12px] tracking-[0.12em] text-mute">
          <Link href="/" className="hover:text-ink">← STORY</Link> / {DISPLAY_KIND[kind]} / {model.name.toUpperCase()}
        </nav>
        <PageActions kind={kind} id={id} entry={entry} name={model.name} />
      </div>

      <header className="pb-8 border-b-[3px] border-ink flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono font-bold text-[12px] tracking-[0.16em]">
          <span aria-hidden="true" className="w-4 h-1" style={{ background: color }} />
          <span>{glyphFor(kind)} {DISPLAY_KIND[kind]}</span>
          {model.tags.map((t, i) => (
            <span key={i} className={TONE[t.tone]}>· {t.text}</span>
          ))}
        </div>
        <h1 className="font-headline font-black leading-[0.84] text-[clamp(56px,7vw,112px)] [text-wrap:balance]">
          {model.name}
        </h1>
        {model.lede && (
          <RecapText content={model.lede} self={ref ?? undefined} className="italic text-[23px] leading-[1.4] max-w-[42ch]" />
        )}
      </header>

      <div className="flex flex-wrap gap-[52px]">
        <article className="flex-[1.5_1_480px] max-w-[68ch] flex flex-col gap-[30px]">
          {model.sections.map(s => (
            <section key={s.label} className="flex flex-col gap-1.5">
              <MonoLabel className={s.now ? 'text-spot' : 'text-mute'}>{s.label}</MonoLabel>
              <RecapText content={s.text} self={ref ?? undefined} className="text-[20px] leading-[1.6]" />
            </section>
          ))}

          {model.secret && <SecretBox text={model.secret} />}

          {model.isStub && (
            model.draftable && ref
              ? <PageDraft kind={kind as DraftableKind} id={id} name={model.name} excerpts={excerpts} />
              : (
                <div className="border-[3px] border-dashed border-line2 p-6">
                  <MonoLabel>Stub page</MonoLabel>
                  <p className="italic text-[17px] text-mute mt-2">Nothing written yet. Use EDIT to fill it in.</p>
                </div>
              )
          )}

          {history.length > 0 && (
            <section className="flex flex-col">
              <MonoLabel className="text-mute mb-2">{model.historyLabel}</MonoLabel>
              {history.map(h => (
                <Link
                  key={`${h.session}-${h.text.slice(0, 12)}`}
                  href={issueHref(h.session)}
                  className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 py-2.5 border-t border-line hover:bg-panel"
                >
                  <span className="font-mono text-[13px] text-spot pt-0.5">#{h.session}</span>
                  <span className="text-[18px] leading-[1.45]">{h.text}</span>
                </Link>
              ))}
            </section>
          )}
        </article>

        <aside className="flex-[1_1_300px] max-w-[400px] flex flex-col gap-[26px]">
          {model.image && onImage && (
            <ImageSlot
              url={model.image.url}
              alt={`${model.image.label.toLowerCase()} of ${model.name}`}
              onFile={onImage}
              clickToUpload
              emptyLabel={`${model.image.label} — ${model.name}`}
              className="aspect-[4/5] border-[3px] border-ink"
              onGenerate={PAGE_ART[kind] ? () => setGenerating(true) : undefined}
            />
          )}
          {onImage && PAGE_ART[kind] && (
            <GenerateArtDialog
              open={generating}
              onOpenChange={setGenerating}
              kind={PAGE_ART[kind]!}
              title={model.name}
              initialBrief={model.lede}
              context={[
                model.name,
                model.lede,
                ...model.sections.map(s => `${s.label}: ${s.text}`),
                ...artExcerpts.map(e => `Issue #${e.session}: ${e.text}`),
              ].filter(Boolean).join('\n\n')}
              // A portrait starts with the character themself selected: their
              // current portrait and Look become the reference, so a redraw
              // keeps the face and moves it into the house style.
              defaultCast={PAGE_ART[kind] === 'portrait' ? [id] : undefined}
              suggestedCast={castIdsOf(ref ? [ref, ...related] : related)}
              onUse={onImage}
            />
          )}

          <section className="border-[1.5px] border-ink">
            <div className="bg-ink text-bg px-3 py-1.5"><MonoLabel>At a glance</MonoLabel></div>
            <dl className="px-3 py-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4">
              {[
                ...model.facts,
                ...(seen.length ? [{ key: 'First seen', value: `Issue #${seen[0]}` }, { key: 'Last seen', value: `Issue #${seen[seen.length - 1]}` }] : []),
              ].map(f => (
                <React.Fragment key={f.key}>
                  <dt className="py-1.5 border-b border-line"><MonoLabel className="text-mute">{f.key}</MonoLabel></dt>
                  <dd className="py-1.5 border-b border-line text-right text-[17px] truncate">{f.value}</dd>
                </React.Fragment>
              ))}
              {model.facts.length === 0 && seen.length === 0 && (
                <dd className="col-span-2 py-1.5 italic text-mute">Nothing recorded yet.</dd>
              )}
            </dl>
          </section>

          {ref && (
            <section className="flex flex-col gap-2">
              <SectionHeader label={`On the Loom · ${seen.length} of ${columns.length}`} as="h3" />
              <TickStrip columns={columns} seen={seen} color={color} />
            </section>
          )}

          {ref && (
            <section className="flex flex-col">
              <SectionHeader glyph={GLYPH.issue} label="Mentioned in" as="h3" className="mb-1" />
              {recent.length === 0 && related.length === 0 && (
                <p className="italic text-mute py-2">No recap mentions this yet.</p>
              )}
              {recent.map(s => s && (
                <Link key={s.id} href={issueHref(s.sessionNumber)} className="py-2 border-b border-line hover:text-spot">
                  <span className="block font-semibold text-[17px]">{GLYPH.issue} Issue #{s.sessionNumber} — {issueTitle(s)}</span>
                  {s.logline && <span className="block italic text-[15px] text-mute">{s.logline}</span>}
                </Link>
              ))}
              {related.map(r => (
                <Link key={refKey(r)} href={pageHref(r)} className={cn('py-2 border-b border-line hover:text-spot')}>
                  <span className="block font-semibold text-[17px]">{glyphFor(r.kind)} {matcher.nameOf(r) ?? 'Unknown'}</span>
                  <span className="block italic text-[15px] text-mute">Linked page</span>
                </Link>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
