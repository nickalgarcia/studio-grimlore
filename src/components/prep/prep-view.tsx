'use client';

import * as React from 'react';
import Link from 'next/link';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { GenerateArtDialog } from '@/components/art/generate-art-dialog';
import { PrepDraftDialog } from '@/components/prep/prep-draft-dialog';
import { ImageSlot } from '@/components/shared/image-slot';
import { MonoLabel, SectionHeader } from '@/components/shared/section-header';
import {
  useImageUpload, usePrepWriter, useSceneWriter, useThreadWriter, type WithId,
} from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { issueLabel, shortDate } from '@/lib/issues';
import { recentTicks, type LoomLane } from '@/lib/loom';
import { refKey } from '@/lib/mentions';
import { GLYPH, glyphFor, pageHref, pageKindOf } from '@/lib/pages';
import { cn } from '@/lib/utils';
import type { PrepScene, SessionPrepState, Thread } from '@/lib/types';

type Prep = NonNullable<SessionPrepState['prep']>;

const ROLE_LABEL: Record<PrepScene['role'], string> = {
  open: 'Open', pressure: 'Pressure', turn: 'Turn', cliffhanger: 'Cliffhanger',
};

/** A spotlight five or more issues ago (or never) is overdue. */
const OVERDUE_AFTER = 5;

const pad = (n: number) => String(n).padStart(2, '0');
/** ISO ↔ the `datetime-local` input's local "YYYY-MM-DDTHH:mm". */
function toLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOf(new Date(t)) - startOf(new Date())) / 86_400_000);
}
function untilLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days < 0) return `${-days} DAYS AGO`;
  if (days === 0) return 'TONIGHT';
  if (days === 1) return 'TOMORROW';
  return `IN ${days} DAYS`;
}

// ─────────────────────────────────────────────────────────────────────────────

function PullRow({
  thread, lane, columns, suggested,
}: {
  thread: WithId<Thread>;
  lane?: LoomLane;
  columns: number[];
  suggested: boolean;
}) {
  const { activeCampaign, mentions } = useCampaign();
  const { updateThread } = useThreadWriter(activeCampaign?.id);
  const seen = mentions.appearances.get(refKey({ kind: 'thread', id: thread.id })) ?? [];
  const { ticks, quiet } = recentTicks(seen, columns);
  const pulling = !!thread.pullNext;
  const color = lane?.color ?? 'hsl(var(--ink))';

  const age = quiet === null ? 'NOT ON THE LOOM YET' : quiet === 0 ? 'TOUCHED LAST ISSUE' : `QUIET ${quiet} ${quiet === 1 ? 'ISSUE' : 'ISSUES'}`;

  return (
    <div className={cn(
      'grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_minmax(150px,auto)_110px] items-center gap-x-5 gap-y-2 py-2.5 border-b border-line',
      !pulling && 'opacity-70',
    )}>
      <Link href={pageHref({ kind: 'thread', id: thread.id })} className="flex items-center gap-2.5 min-w-0 hover:text-spot">
        <span aria-hidden="true" className="flex-none w-4 h-1" style={{ background: color }} />
        <span className="truncate font-semibold text-[18px]">{thread.title}</span>
        {suggested && <MonoLabel className="flex-none text-holo">{GLYPH.copilot} Suggested</MonoLabel>}
      </Link>
      <div className="flex gap-1" aria-label={`Last ${ticks.length} issues`}>
        {ticks.map(t => (
          <span
            key={t.issue}
            title={`Issue #${t.issue}`}
            className="w-3 h-4 border-[1.5px]"
            style={t.on ? { background: color, borderColor: color } : { borderColor: 'var(--line2)' }}
          />
        ))}
      </div>
      <MonoLabel className={cn('hidden sm:block', quiet !== null && quiet >= 4 ? 'text-spot' : 'text-mute')}>{age}</MonoLabel>
      <button
        type="button"
        aria-pressed={pulling}
        onClick={() => updateThread(thread.id, { pullNext: !pulling })}
        className={cn(
          'col-span-2 sm:col-span-1 w-[110px] h-8 border-[1.5px] border-ink font-mono font-bold text-[12px] tracking-[0.14em]',
          pulling && 'bg-ink text-bg',
        )}
      >
        {pulling ? '● PULLING' : '○ SKIP'}
      </button>
    </div>
  );
}

function SceneCard({
  scene, index, prep, onSave,
}: {
  scene: PrepScene;
  index: number;
  prep: Prep;
  onSave: (next: PrepScene) => Promise<void> | void;
}) {
  const { activeCampaign, codex, nextIssueNumber } = useCampaign();
  const { upload, remove } = useImageUpload(activeCampaign?.id);
  const { createScene } = useSceneWriter(activeCampaign?.id);
  const { toast } = useToast();
  const [alt, setAlt] = React.useState(false);
  const [editing, setEditing] = React.useState<PrepScene | null>(null);
  const [generating, setGenerating] = React.useState(false);

  const cliff = scene.role === 'cliffhanger';
  const beat = index === 0 && alt && prep.alternateOpening ? prep.alternateOpening : scene.beat;
  const cast = scene.castIds
    .map(id => codex.entries.find(e => e.id === id))
    .filter(Boolean);

  const onImage = async (file: File) => {
    const url = await upload(file, 'prep', `scene-${index}`);
    await onSave({ ...scene, imageUrl: url });
    void remove(scene.imageUrl);
  };

  // Put this scene on the Table: it becomes the current scene, with its NPC cast on stage.
  const stage = async () => {
    const npcIds = scene.castIds.filter(id => codex.raw.npcs?.some(n => n.id === id));
    const [location, timeOfDay] = scene.where.split('·').map(s => s.trim());
    await createScene({
      name: scene.title,
      ...(location ? { location } : {}),
      ...(timeOfDay ? { timeOfDay } : {}),
      onStageNpcIds: npcIds,
      sessionNumber: nextIssueNumber,
      sceneNumber: index + 1,
    });
    toast({ title: `SCENE ${index + 1} IS ON THE TABLE` });
  };

  const field = 'w-full bg-bg border-[1.5px] border-line2 px-2.5 py-1.5 outline-none focus:border-ink';

  return (
    <article className="border-[3px] border-ink bg-panel flex flex-col">
      <header className={cn(
        'flex items-center justify-between px-3 py-1.5 font-mono font-bold text-[11px] tracking-[0.16em] uppercase',
        cliff ? 'bg-spot text-spot-on' : 'bg-ink text-bg',
      )}>
        <span>Scene {index + 1} · {ROLE_LABEL[scene.role]}</span>
        <span className="flex gap-3">
          <button type="button" onClick={stage} className="hover:underline">▶ Stage</button>
          <button type="button" onClick={() => setEditing(editing ? null : scene)} className="hover:underline">{editing ? 'Close' : 'Edit'}</button>
        </span>
      </header>
      <ImageSlot
        url={scene.imageUrl}
        alt={`scene ${index + 1} art`}
        onFile={onImage}
        clickToUpload
        emptyLabel="Drop scene art"
        className="h-[130px] border-b-[3px] border-ink"
        onGenerate={() => setGenerating(true)}
      />
      <GenerateArtDialog
        open={generating}
        onOpenChange={setGenerating}
        kind="scene"
        title={`Scene ${index + 1} · ${scene.title || ROLE_LABEL[scene.role]}`}
        initialBrief={[scene.where, scene.beat].filter(s => s?.trim()).join('. ')}
        context={[scene.title, scene.where && `Where: ${scene.where}`, scene.beat].filter(Boolean).join('\n')}
        suggestedCast={scene.castIds}
        onUse={onImage}
      />
      {editing ? (
        <div className="p-3.5 flex flex-col gap-2">
          <input aria-label="Title" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className={`${field} font-headline font-black text-[22px]`} />
          <input aria-label="Where" value={editing.where} onChange={e => setEditing({ ...editing, where: e.target.value })} className={`${field} font-mono text-[12px]`} placeholder="Upper Ward · Night" />
          <textarea aria-label="Beat" rows={4} value={editing.beat} onChange={e => setEditing({ ...editing, beat: e.target.value })} className={`${field} text-[16px]`} />
          <button
            type="button"
            onClick={async () => { await onSave(editing); setEditing(null); }}
            className="self-end h-9 px-4 bg-spot text-spot-on font-headline font-black text-[16px] uppercase"
          >
            Save scene
          </button>
        </div>
      ) : (
        <div className="p-3.5 flex flex-col gap-2 flex-1">
          <h3 className="font-headline font-black text-[27px] leading-[0.92]">{scene.title || `Scene ${index + 1}`}</h3>
          {scene.where && <MonoLabel className="text-mute text-[12px]">{scene.where}</MonoLabel>}
          <p className="text-[17px] leading-[1.45]">{beat}</p>
          {index === 0 && prep.alternateOpening && (
            <button
              type="button"
              aria-pressed={alt}
              onClick={() => setAlt(a => !a)}
              className="self-start font-mono font-bold text-[11px] tracking-[0.14em] text-mute hover:text-ink"
            >
              ⇄ {alt ? 'BACK TO FIRST OPENING' : 'TRY ALTERNATE OPENING'}
            </button>
          )}
          {cast.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 mt-auto">
              {cast.map(e => {
                const kind = pageKindOf(e!.kind);
                return kind && (
                  <Link key={e!.id} href={pageHref({ kind, id: e!.id })} className="px-2 py-0.5 border-[1.5px] border-line2 text-[15px] hover:border-ink">
                    {glyphFor(kind)} {e!.name}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function PrepView() {
  const { activeCampaign, prep: state, threads, lanes, issues, codex, nextIssueNumber } = useCampaign();
  const { patchPrep, setMeta } = usePrepWriter(activeCampaign?.id);
  const { promoteThreads } = useThreadWriter(activeCampaign?.id);
  const { upload, remove } = useImageUpload(activeCampaign?.id);
  const [drafting, setDrafting] = React.useState(false);
  const [generatingCover, setGeneratingCover] = React.useState(false);
  const [rolled, setRolled] = React.useState<number | null>(null);

  const prep = state?.prep ?? null;
  const columns = React.useMemo(() => issues.map(s => s.sessionNumber), [issues]);
  const laneById = new Map(lanes.filter(l => l.ref.kind === 'thread').map(l => [l.ref.id, l]));
  const open = (threads ?? []).filter(t => t.status !== 'cold')
    .sort((a, b) => (lanes.findIndex(l => l.ref.id === a.id) - lanes.findIndex(l => l.ref.id === b.id)));
  const suggestions = new Set(prep?.openThreadsToPull ?? []);
  const ids = new Set((threads ?? []).map(t => t.id));
  // Values that match no thread id are suggested *new* threads (see SessionPrepState).
  const newThreads = (prep?.openThreadsToPull ?? []).filter(v => !ids.has(v)
    && !(threads ?? []).some(t => t.title.trim().toLowerCase() === v.trim().toLowerCase()));
  const pulling = open.filter(t => t.pullNext).length;

  const scenes: PrepScene[] = prep?.scenes?.length
    ? prep.scenes
    // Prep drafted before scenes existed: its opening scene stands in as Scene 1.
    : prep?.openingScene ? [{ role: 'open', title: 'Opening', where: '', beat: prep.openingScene, castIds: [] }] : [];
  const saveScene = (i: number) => (next: PrepScene) => {
    const all = [...scenes];
    all[i] = next;
    return patchPrep({ scenes: all });
  };

  const reminders = prep?.prepReminders ?? [];
  const done = new Set(prep?.done ?? []);
  const toggleDone = (i: number) => {
    const next = new Set(done);
    if (next.has(i)) next.delete(i); else next.add(i);
    void patchPrep({ done: [...next].sort((a, b) => a - b) });
  };
  const readyN = reminders.filter((_, i) => done.has(i)).length;
  const allReady = reminders.length > 0 && readyN === reminders.length;

  const when = shortDate(state?.scheduledAt);
  const time = state?.scheduledAt ? new Date(state.scheduledAt).toTimeString().slice(0, 5) : null;
  const until = untilLabel(daysUntil(state?.scheduledAt));

  const onCover = async (file: File) => {
    const url = await upload(file, 'covers', `next-${nextIssueNumber}`);
    await setMeta({ coverUrl: url });
    void remove(state?.coverUrl);
  };

  const characters = codex.raw.characters ?? [];
  const spotlightFor = (name: string) =>
    prep?.characterSpotlights.find(s => s.character.trim().toLowerCase() === name.trim().toLowerCase())?.opportunity;

  return (
    <div className="max-w-[1240px] mx-auto w-full px-[clamp(20px,3vw,48px)] pt-9 pb-24 flex flex-col gap-12">
      {/* ── Hero ── */}
      <header className="flex flex-wrap items-end gap-10 pb-9 border-b-[3px] border-ink">
        <ImageSlot
          url={state?.coverUrl}
          alt={`cover for issue ${nextIssueNumber}`}
          onFile={onCover}
          clickToUpload
          emptyLabel="Drop the cover"
          className="flex-none w-[clamp(160px,16vw,210px)] aspect-[2/3] border-[3px] border-dashed border-spot"
          onGenerate={() => setGeneratingCover(true)}
        >
          <span className="absolute top-0 left-0 z-[1] px-2 bg-spot text-spot-on font-headline font-black text-[40px] leading-tight pointer-events-none">
            #{nextIssueNumber}
          </span>
        </ImageSlot>
        <GenerateArtDialog
          open={generatingCover}
          onOpenChange={setGeneratingCover}
          kind="teaser"
          title={`Issue #${nextIssueNumber}${prep?.sessionTitle ? `: ${prep.sessionTitle}` : ''}`}
          // Only the scenes the players will see first: the turn and the
          // cliffhanger stay out, because the players can see this screen.
          context={[
            prep?.sessionTitle,
            ...scenes.filter(s => s.role === 'open' || s.role === 'pressure').map(s => [s.title, s.where, s.beat].filter(Boolean).join(' · ')),
          ].filter(Boolean).join('\n')}
          suggestedCast={[...new Set(scenes.flatMap(s => s.castIds))]}
          onUse={onCover}
        />

        <div className="flex-1 min-w-[300px] flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3 font-mono font-bold text-[12px] tracking-[0.16em]">
            <span className="px-2 py-0.5 bg-spot text-spot-on">PREP</span>
            <label className="inline-flex items-center gap-2">
              <span>{when ? `${when}${time ? ` · ${time}` : ''}` : 'SET A DATE'}</span>
              <input
                type="datetime-local"
                aria-label="When issue is played"
                value={toLocalInput(state?.scheduledAt)}
                onChange={e => setMeta({ scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="bg-transparent border-[1.5px] border-line2 px-1.5 h-7 text-[12px] text-mute [color-scheme:inherit]"
              />
            </label>
            {until && <span className="text-spot">{until}</span>}
          </div>
          <h1 className="font-headline font-black leading-[0.84] text-[clamp(56px,7vw,112px)] [text-wrap:balance]">
            {prep?.sessionTitle || issueLabel(nextIssueNumber)}
          </h1>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setDrafting(true)}
              className="h-12 px-4 border-[1.5px] border-holo text-holo font-mono font-bold text-[12px] tracking-[0.14em]"
            >
              {GLYPH.copilot} {prep ? 'REDRAFT WITH CO-PILOT' : 'DRAFT WITH CO-PILOT'}
            </button>
            <Link
              href="/table?run=1"
              className="h-12 px-5 inline-flex items-center bg-spot text-spot-on font-headline font-black text-[21px] uppercase hover:bg-ink hover:text-bg"
            >
              Run issue #{nextIssueNumber} →
            </Link>
          </div>
        </div>

        <dl className="flex-[0_1_260px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono font-bold text-[12px] tracking-[0.14em]">
          <dt className="text-mute">PULLING</dt><dd className="text-right">{pulling} {pulling === 1 ? 'THREAD' : 'THREADS'}</dd>
          <dt className="text-mute">SCENES</dt><dd className="text-right">{scenes.length}</dd>
          <dt className="text-mute">READY</dt>
          <dd className={cn('text-right', allReady && 'text-spot')}>{readyN} / {reminders.length} DONE</dd>
        </dl>
      </header>

      {/* ── The Pull ── */}
      <section className="flex flex-col">
        <SectionHeader glyph={GLYPH.thread} label="The Pull" meta="From the Loom · last 5 issues" className="mb-2" />
        {open.length === 0 && <p className="italic text-mute py-2">No open threads. Track one from a thread page or a prep draft.</p>}
        {open.map(t => (
          <PullRow key={t.id} thread={t} lane={laneById.get(t.id)} columns={columns} suggested={suggestions.has(t.id)} />
        ))}
        {newThreads.length > 0 && (
          <div className="flex flex-col gap-1 pt-3">
            <MonoLabel className="text-holo">{GLYPH.copilot} Suggested new threads</MonoLabel>
            {newThreads.map(title => (
              <div key={title} className="flex items-center justify-between gap-3 py-1.5 border-b border-line">
                <span className="italic text-[17px]">{title}</span>
                <button
                  type="button"
                  onClick={() => promoteThreads([title], threads)}
                  className="flex-none h-8 px-3 border-[1.5px] border-ink font-mono font-bold text-[12px] tracking-[0.14em]"
                >
                  + TRACK
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {!prep ? (
        <div className="border-[3px] border-dashed border-line2 p-8 flex flex-col items-start gap-3">
          <MonoLabel>No prep for {issueLabel(nextIssueNumber)} yet</MonoLabel>
          <p className="italic text-[18px] text-mute max-w-[52ch]">
            Tell the co-pilot what this issue is for. It writes the script, complications, spotlights and a checklist for you to edit.
          </p>
          <button
            type="button"
            onClick={() => setDrafting(true)}
            className="h-11 px-4 border-[1.5px] border-holo text-holo font-mono font-bold text-[12px] tracking-[0.14em]"
          >
            {GLYPH.copilot} DRAFT PREP WITH CO-PILOT
          </button>
        </div>
      ) : (
        <>
          {/* ── The Script ── */}
          <section className="flex flex-col gap-3">
            <SectionHeader glyph={GLYPH.issue} label="The Script" meta={`${scenes.length} scenes`} />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
              {scenes.map((s, i) => (
                <SceneCard key={i} scene={s} index={i} prep={prep} onSave={saveScene(i)} />
              ))}
            </div>
          </section>

          {/* ── Complications ── */}
          {prep.complications.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionHeader
                glyph={GLYPH.lore}
                label="Complications"
                meta={(
                  <button
                    type="button"
                    onClick={() => setRolled(Math.floor(Math.random() * Math.min(3, prep.complications.length)))}
                    className="h-8 px-3 bg-ink text-bg font-mono font-bold text-[12px] tracking-[0.14em]"
                  >
                    ROLL d{Math.min(3, prep.complications.length)}
                  </button>
                )}
              />
              <ol className="flex flex-col gap-1.5" aria-live="polite">
                {prep.complications.slice(0, 3).map((c, i) => (
                  <li
                    key={i}
                    className={cn(
                      'grid grid-cols-[44px_minmax(0,1fr)] gap-3 items-baseline px-3 py-2.5 border-[3px]',
                      rolled === i ? 'bg-spot text-spot-on border-ink' : 'border-transparent border-b-line',
                    )}
                  >
                    <span className="font-headline font-black text-[34px] leading-none">{i + 1}</span>
                    <span>
                      <span className="font-semibold text-[18px]">{c.title}. </span>
                      <span className="text-[17px]">{c.description}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* ── Spotlights ── */}
          {characters.length > 0 && (
            <section className="flex flex-col">
              <SectionHeader glyph={GLYPH.person} label="Spotlights" className="mb-2" />
              {characters.map(c => {
                const last = c.lastSpotlightSession;
                const overdue = last === undefined || nextIssueNumber - last >= OVERDUE_AFTER;
                return (
                  <div key={c.id} className="grid grid-cols-[92px_minmax(0,1fr)_auto] gap-4 items-baseline py-2.5 border-b border-line">
                    <Link href={pageHref({ kind: 'party', id: c.id })} className="font-headline font-black text-[19px] truncate hover:text-spot">{c.name}</Link>
                    <span className={cn('text-[17px]', !spotlightFor(c.name) && 'italic text-mute')}>
                      {spotlightFor(c.name) ?? 'No moment drafted for them.'}
                    </span>
                    <MonoLabel className={overdue ? 'text-spot' : 'text-mute'}>
                      {last === undefined ? 'NEVER SPOTLIT' : overdue ? `OVERDUE · #${last}` : `LAST #${last}`}
                    </MonoLabel>
                  </div>
                );
              })}
            </section>
          )}

          {/* ── Before the table ── */}
          {reminders.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionHeader glyph={GLYPH.note} label="Before the table" meta={`${readyN} / ${reminders.length}`} />
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
                {reminders.map((r, i) => {
                  const on = done.has(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggleDone(i)}
                      className="flex items-start gap-3 p-3 border-[1.5px] border-line2 text-left hover:border-ink"
                    >
                      <span aria-hidden="true" className={cn('flex-none w-5 h-5 border-[1.5px] border-ink flex items-center justify-center text-[14px] leading-none', on && 'bg-ink text-bg')}>
                        {on ? '✓' : ''}
                      </span>
                      <span className={cn('text-[17px]', on && 'line-through text-mute')}>{r}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      <PrepDraftDialog open={drafting} onOpenChange={setDrafting} />
    </div>
  );
}
