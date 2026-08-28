'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getNpc } from '@/app/actions';
import type { GenerateNpcOutput } from '@/app/actions';
import { Loader2, PlusCircle, Sparkles, Upload } from 'lucide-react';
import { CREATABLE_KINDS, KIND_LABEL, type CodexFilter } from '@/lib/codex';
import { CodexIndex } from '@/components/codex/codex-index';
import { CodexDetail } from '@/components/codex/codex-detail';
import { CodexEntryDialog } from '@/components/codex/codex-entry-dialog';
import type { UseCodexEntriesResult } from '@/components/codex/use-codex-entries';
import { ObsidianImportDialog } from '@/components/obsidian-import-dialog';
import { useCurrentScene, useSceneWriter } from '@/firebase';
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

  const { data: currentScene } = useCurrentScene(campaign.id);
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
    let sceneId = currentScene?.id;

    if (!sceneId) {
      // No scene yet — the first "put on stage" is what creates one.
      const created = await createScene({
        name: campaign.name,
        onStageNpcIds: [],
        sessionNumber: latestSessionNumber || undefined,
        sceneNumber: 1,
      });
      sceneId = created?.id;
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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-headline font-bold">Codex</h2>
          <p className="text-muted-foreground text-sm font-body mt-1">
            Everything that exists in {campaign.name} — {entries.length} entries, one index.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {CREATABLE_KINDS.map(kind => (
            <Button key={kind} size="sm" variant="outline" onClick={() => openCreate(kind)}>
              <PlusCircle className="h-3.5 w-3.5 mr-2" />
              {KIND_LABEL[kind]}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={handleGenerateNpc} disabled={isGenerating}>
            {isGenerating
              ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              : <Sparkles className="h-3.5 w-3.5 mr-2" />}
            Generate NPC
          </Button>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-2" /> Import
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_372px] gap-4 items-start">
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
        <div className="border border-border rounded-lg bg-card max-h-[70vh] overflow-y-auto">
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
