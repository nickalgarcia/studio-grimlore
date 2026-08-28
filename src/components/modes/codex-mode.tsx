'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { getNpc } from '@/app/actions';
import type { GenerateNpcOutput } from '@/app/actions';
import { Loader2, Sparkles, Upload } from 'lucide-react';
import { CREATABLE_KINDS, KIND_LABEL, type CodexFilter } from '@/lib/codex';
import { CodexIndex } from '@/components/codex/codex-index';
import { CodexDetail } from '@/components/codex/codex-detail';
import { CodexEntryDialog } from '@/components/codex/codex-entry-dialog';
import type { UseCodexEntriesResult } from '@/components/codex/use-codex-entries';
import { ObsidianImportDialog } from '@/components/obsidian-import-dialog';
import { useCurrentSceneId, useSceneWriter } from '@/firebase';
import type { Campaign, CodexEntry, CodexKind, Faction } from '@/lib/types';

/** Flattens a generated NPC into the single `description` field the model uses. */
function buildNpcDescription(npc: GenerateNpcOutput): string {
  return [
    npc.appearance && `Appearance: ${npc.appearance}`,
    npc.personality && `Personality: ${npc.personality}`,
    npc.backstory && `Backstory: ${npc.backstory}`,
    npc.motivation && `Motivation: ${npc.motivation}`,
    npc.secret && `Secret: ${npc.secret}`,
    npc.speechPattern && `Speech: ${npc.speechPattern}`,
  ].filter(Boolean).join('\n\n');
}

export function CodexMode({
  campaign, codex, focusEntryId, onFocusHandled,
}: {
  campaign: Campaign;
  /**
   * Built by the shell, not here: Spotlight needs the same index, and
   * subscribing twice would double every listener over the same six
   * collections.
   */
  codex: UseCodexEntriesResult;
  /** Entry to reveal when arriving from Spotlight. */
  focusEntryId?: string | null;
  onFocusHandled?: () => void;
}) {
  const { toast } = useToast();
  const { entries, isLoading, raw } = codex;

  const [filter, setFilter] = React.useState<CodexFilter>('All');
  const [query, setQuery] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogKind, setDialogKind] = React.useState<CodexKind>('npc');
  const [dialogInitial, setDialogInitial] = React.useState<Record<string, unknown> | null>(null);

  const [importOpen, setImportOpen] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const getCurrentSceneId = useCurrentSceneId(campaign.id);
  const { createScene, putOnStage } = useSceneWriter(campaign.id);

  const selected = React.useMemo(
    () => entries.find(e => e.id === selectedId) ?? null,
    [entries, selectedId],
  );

  // Keep a selection alive across data refreshes, but drop it if the entry it
  // pointed at was deleted — otherwise the pane renders a stale document.
  React.useEffect(() => {
    if (selectedId && !entries.some(e => e.id === selectedId)) setSelectedId(null);
  }, [entries, selectedId]);

  // Arriving from Spotlight: select the entry and clear any filter that would
  // hide it, otherwise the detail pane fills in beside an empty table.
  React.useEffect(() => {
    if (!focusEntryId) return;
    setSelectedId(focusEntryId);
    setQuery('');
    setFilter('All');
    onFocusHandled?.();
  }, [focusEntryId, onFocusHandled]);

  const latestSessionNumber = React.useMemo(
    () => (raw.sessions ?? []).reduce((max, s) => Math.max(max, s.sessionNumber), 0),
    [raw.sessions],
  );

  const sessionContext = React.useMemo(
    () => (raw.sessions ?? [])
      .slice(0, 3)
      .map(s => `Session ${s.sessionNumber}: ${s.summary}`)
      .join('\n\n'),
    [raw.sessions],
  );

  const openCreate = (kind: CodexKind) => {
    setDialogKind(kind);
    setDialogInitial(null);
    setDialogOpen(true);
  };

  const openEdit = (entry: CodexEntry) => {
    setDialogKind(entry.kind);
    setDialogInitial({ ...(entry.source as Record<string, unknown>), id: entry.id });
    setDialogOpen(true);
  };

  const handleGenerateNpc = async () => {
    setIsGenerating(true);
    const { data, error } = await getNpc({
      campaignContext: `Campaign: ${campaign.name}\nDescription: ${campaign.description}`,
    });
    setIsGenerating(false);

    if (!data) {
      toast({ variant: 'destructive', title: 'NPC generation failed', description: error ?? 'Unknown error' });
      return;
    }

    // Land the result in the normal edit dialog rather than a bespoke preview
    // pane, so the DM can adjust it before anything is written.
    setDialogKind('npc');
    setDialogInitial({
      name: data.name,
      description: buildNpcDescription(data),
      ...(data.location ? { location: data.location } : {}),
      status: 'Active',
      importance: 'Minor',
    });
    setDialogOpen(true);
  };

  const handlePutOnStage = async (entry: CodexEntry) => {
    let sceneId = await getCurrentSceneId();

    if (!sceneId) {
      // No scene yet — the first "put on stage" is what creates one.
      const created = await createScene({
        name: campaign.name,
        onStageNpcIds: [],
        sessionNumber: latestSessionNumber || undefined,
        sceneNumber: 1,
      });
      sceneId = created?.id ?? null;
    }

    if (!sceneId) {
      toast({ variant: 'destructive', title: 'Could not open a scene' });
      return;
    }

    await putOnStage(sceneId, entry.id, latestSessionNumber || undefined);
    // Deliberately does not claim the entry is "visible in Table mode" — the
    // scene UI arrives with the visual stage; right now this only records the
    // scene membership and stamps lastSeenSession.
    toast({
      title: `${entry.name} added to the current scene`,
      description: 'The scene view arrives with the visual redesign.',
    });
  };

  return (
    <div className="min-h-0 grid grid-rows-[auto_minmax(0,1fr)]">
      <div className="flex items-end gap-4 flex-wrap px-[26px] pt-3 pb-3 border-b border-border/[0.09]">
        <h1 className="font-headline text-[40px] font-black uppercase leading-none text-bone
                       [text-shadow:0_0_60px_hsl(var(--oxblood)/0.4)]">
          Codex
        </h1>
        <span className="font-mono text-[10px] tracking-[0.16em] text-bone-faint pb-1.5 whitespace-nowrap">
          {entries.length} ENTRIES
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 flex-wrap pb-1">
          {CREATABLE_KINDS.map(kind => (
            <button
              key={kind}
              onClick={() => openCreate(kind)}
              className="font-mono text-[10px] font-bold tracking-[0.1em] uppercase px-2.5 py-[5px]
                         border border-border/[0.12] text-bone-faint hover:text-bone-dim hover:border-oxblood transition-colors"
            >
              + {KIND_LABEL[kind]}
            </button>
          ))}
          <button
            onClick={handleGenerateNpc}
            disabled={isGenerating}
            className="font-mono text-[10px] font-bold tracking-[0.1em] uppercase px-2.5 py-[5px]
                       border border-border/[0.12] text-bone-faint hover:text-bone-dim hover:border-oxblood
                       transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Generate
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="font-mono text-[10px] font-bold tracking-[0.1em] uppercase px-2.5 py-[5px]
                       border border-border/[0.12] text-bone-faint hover:text-bone-dim hover:border-oxblood
                       transition-colors inline-flex items-center gap-1.5"
          >
            <Upload className="h-3 w-3" /> Import
          </button>
        </div>
      </div>

      <div className="min-h-0 grid grid-cols-[minmax(0,1fr)_372px]">
        <div className="min-w-0 min-h-0 flex flex-col border-r border-border/[0.09]">
          <CodexIndex
            entries={entries}
            isLoading={isLoading}
            filter={filter}
            onFilterChange={setFilter}
            query={query}
            onQueryChange={setQuery}
            selectedId={selectedId}
            onSelect={e => setSelectedId(e.id)}
          />
        </div>
        <div className="min-w-0 min-h-0 overflow-y-auto bg-[hsl(var(--background)/0.4)]">
          <CodexDetail
            entry={selected}
            campaign={campaign}
            sessionContext={sessionContext}
            onEdit={openEdit}
            onDeleted={() => setSelectedId(null)}
            onPutOnStage={handlePutOnStage}
          />
        </div>
      </div>

      <CodexEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        kind={dialogKind}
        campaignId={campaign.id}
        initial={dialogInitial}
        factions={(raw.factions ?? []) as Faction[]}
        onSaved={id => { if (id) setSelectedId(id); }}
      />

      <ObsidianImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        campaignId={campaign.id}
        campaignName={campaign.name}
        nextSessionNumber={latestSessionNumber + 1}
        onImported={() => setImportOpen(false)}
      />
    </div>
  );
}
