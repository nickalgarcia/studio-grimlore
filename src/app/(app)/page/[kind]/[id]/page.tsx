'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { CodexDetail } from '@/components/codex/codex-detail';
import { CodexEntryDialog } from '@/components/codex/codex-entry-dialog';
import { usePutOnStage } from '@/components/page/use-put-on-stage';
import { MonoLabel, SectionHeader } from '@/components/shared/section-header';
import { issueTitle, recapOf } from '@/lib/issues';
import { refKey } from '@/lib/mentions';
import { DISPLAY_KIND, glyphFor, GLYPH, isPageKind, issueHref, pageKindOf } from '@/lib/pages';
import type { CodexEntry, Faction, MentionKind } from '@/lib/types';

export default function EntityPage() {
  const router = useRouter();
  const params = useParams<{ kind: string; id: string }>();
  const kind = isPageKind(params.kind) ? params.kind : null;
  const id = decodeURIComponent(params.id);
  const {
    activeCampaign, codex, threads, issues, latestIssue, mentions, lanes,
  } = useCampaign();

  // Captured on click, not derived, so a live snapshot can't reset the form mid-edit.
  const [editInitial, setEditInitial] = React.useState<Record<string, unknown> | null>(null);
  const putOnStage = usePutOnStage(activeCampaign, latestIssue?.sessionNumber ?? 0);

  const entry = kind && kind !== 'thread'
    ? codex.entries.find(e => e.id === id && pageKindOf(e.kind) === kind) ?? null
    : null;
  const thread = kind === 'thread' ? threads?.find(t => t.id === id) ?? null : null;
  const name = entry?.name ?? thread?.title;

  const loading = codex.isLoading || threads === null;
  if (!kind || (!loading && !name)) {
    return (
      <div className="max-w-[1240px] mx-auto w-full px-[clamp(20px,3vw,48px)] pt-8 pb-24">
        <Link href="/" className="font-mono text-[12px] text-muted-foreground">← STORY</Link>
        <p className="mt-6 italic text-muted-foreground">This page doesn&apos;t exist, or it was deleted.</p>
      </div>
    );
  }
  if (!name) return null;

  // Concepts are unfiled notes; they never appear in recaps.
  const seen = kind === 'concept' ? [] : mentions.appearances.get(refKey({ kind: kind as MentionKind, id })) ?? [];
  const lane = lanes.find(l => l.ref.kind === kind && l.ref.id === id);
  const recent = [...seen].reverse().slice(0, 4)
    .map(n => issues.find(s => s.sessionNumber === n))
    .filter(Boolean);
  const sessionContext = issues.slice(-3).reverse()
    .map(s => `Session ${s.sessionNumber}: ${recapOf(s)}`).join('\n\n');

  return (
    <div className="max-w-[1240px] mx-auto w-full px-[clamp(20px,3vw,48px)] pt-8 pb-24 flex flex-col gap-10">
      <nav aria-label="Breadcrumb" className="font-mono text-[12px] tracking-[0.12em] text-muted-foreground">
        <Link href="/">← STORY</Link> / {DISPLAY_KIND[kind]} / {name.toUpperCase()}
      </nav>

      <header className="pb-8 border-b-[3px] border-foreground flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {lane && <span aria-hidden="true" className="w-4 h-1" style={{ background: lane.color }} />}
          <MonoLabel>{glyphFor(kind)} {DISPLAY_KIND[kind]}{lane?.status ? ` · ${lane.status}` : ''}</MonoLabel>
        </div>
        <h1 className="font-headline font-black uppercase leading-[0.84] text-[clamp(56px,7vw,112px)] [text-wrap:balance]">
          {name}
        </h1>
      </header>

      <div className="flex flex-wrap gap-[52px]">
        <article className="flex-[1.5_1_480px] max-w-[68ch]">
          {entry && activeCampaign && (
            // Stand-in body until the inline-editing designs arrive.
            <CodexDetail
              entry={entry}
              campaign={activeCampaign}
              sessionContext={sessionContext}
              onEdit={(e: CodexEntry) => setEditInitial({ ...(e.source as Record<string, unknown>), id: e.id })}
              onDeleted={() => router.push('/')}
              onPutOnStage={kind === 'npc' ? putOnStage : undefined}
            />
          )}
          {thread && (
            <div className="flex flex-col gap-6">
              <section>
                <MonoLabel className="text-primary">Where it stands</MonoLabel>
                <p className="text-[20px] leading-[1.6] mt-1">{thread.body?.whereItStands || thread.note || 'Nothing written yet.'}</p>
              </section>
              <p className="font-mono text-[12px] text-muted-foreground">
                {thread.tag} · {thread.status.toUpperCase()}{thread.pullNext ? ' · PULLING NEXT' : ''}
              </p>
              <p className="italic text-muted-foreground">Editing threads arrives with the inline-editing design.</p>
            </div>
          )}
        </article>

        <aside className="flex-[1_1_300px] max-w-[400px] flex flex-col gap-[26px]">
          <section className="border-[1.5px] border-foreground">
            <div className="bg-foreground text-background px-3 py-1.5"><MonoLabel>At a glance</MonoLabel></div>
            <dl className="px-3 py-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <dt><MonoLabel className="text-muted-foreground">First seen</MonoLabel></dt>
              <dd className="text-right text-[17px]">{seen.length ? `Issue #${seen[0]}` : '—'}</dd>
              <dt><MonoLabel className="text-muted-foreground">Last seen</MonoLabel></dt>
              <dd className="text-right text-[17px]">{seen.length ? `Issue #${seen[seen.length - 1]}` : '—'}</dd>
            </dl>
          </section>

          {kind !== 'concept' && (
            <section className="flex flex-col gap-2">
              <SectionHeader label={`On the Loom · ${seen.length} of ${issues.length}`} as="h3" />
              <SectionHeader glyph={GLYPH.issue} label="Mentioned in" as="h3" />
              {recent.length === 0 && <p className="italic text-muted-foreground">No recap mentions this yet.</p>}
              {recent.map(s => s && (
                <Link key={s.id} href={issueHref(s.sessionNumber)} className="py-1.5 border-b border-border/10">
                  <span className="block font-semibold">{GLYPH.issue} Issue #{s.sessionNumber} — {issueTitle(s)}</span>
                  {s.logline && <span className="block italic text-[15px] text-muted-foreground">{s.logline}</span>}
                </Link>
              ))}
            </section>
          )}
        </aside>
      </div>

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
