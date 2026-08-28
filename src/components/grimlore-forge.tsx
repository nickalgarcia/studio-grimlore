'use client';

import * as React from 'react';
import { collection, serverTimestamp } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CampaignSwitcher } from '@/components/campaign-switcher';
import { Spotlight } from '@/components/spotlight';
import { TableMode, type TableView } from '@/components/modes/table-mode';
import { ForgeMode, type ForgeView } from '@/components/modes/forge-mode';
import { CodexMode } from '@/components/modes/codex-mode';
import { useCodexEntries } from '@/components/codex/use-codex-entries';
import type { Campaign, CodexEntry, SavedConcept } from '@/lib/types';

export type Mode = 'table' | 'forge' | 'codex';

const MODES: { id: Mode; label: string }[] = [
  { id: 'table', label: 'Table' },
  { id: 'forge', label: 'Forge' },
  { id: 'codex', label: 'Codex' },
];

const isMode = (v: string | null): v is Mode =>
  v === 'table' || v === 'forge' || v === 'codex';

/**
 * URL state is written with `history.replaceState` rather than
 * `useSearchParams` / `router.replace`.
 *
 * This page is a single client-only route. `useSearchParams` would force a
 * Suspense boundary and opt the page into dynamic rendering, and routing every
 * mode change through the router re-renders the tree for a value only this
 * component reads. `replaceState` writes the address bar and nothing else.
 */
function readUrlState(): { mode: Mode | null; campaignId: string | null } {
  if (typeof window === 'undefined') return { mode: null, campaignId: null };
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  return { mode: isMode(mode) ? mode : null, campaignId: params.get('campaign') };
}

function writeUrlState(mode: Mode, campaignId: string | null) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  params.set('mode', mode);
  if (campaignId) params.set('campaign', campaignId);
  else params.delete('campaign');
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}

export function GrimloreForge() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [mode, setMode] = React.useState<Mode>('table');
  const [activeCampaignId, setActiveCampaignId] = React.useState<string | null>(null);
  const [tableView, setTableView] = React.useState<TableView>('scene');
  const [forgeView, setForgeView] = React.useState<ForgeView>('prep');
  const [spotlightOpen, setSpotlightOpen] = React.useState(false);
  const [codexFocusId, setCodexFocusId] = React.useState<string | null>(null);
  // Alternates on every mode change so the camera move actually replays —
  // re-rendering with the same animation-name does not restart it.
  const [camFlip, setCamFlip] = React.useState(false);

  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    const { mode: urlMode, campaignId } = readUrlState();
    if (urlMode) setMode(urlMode);
    if (campaignId) setActiveCampaignId(campaignId);
    setHydrated(true);
  }, []);

  const campaignsRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'campaigns');
  }, [user, firestore]);
  const { data: campaigns, isLoading: campaignsLoading } = useCollection<Campaign>(campaignsRef);

  React.useEffect(() => {
    if (!hydrated || campaignsLoading || !campaigns) return;
    if (activeCampaignId && campaigns.some(c => c.id === activeCampaignId)) return;
    setActiveCampaignId(campaigns[0]?.id ?? null);
  }, [hydrated, campaignsLoading, campaigns, activeCampaignId]);

  React.useEffect(() => {
    if (!hydrated) return;
    writeUrlState(mode, activeCampaignId);
  }, [hydrated, mode, activeCampaignId]);

  const activeCampaign = React.useMemo(
    () => campaigns?.find(c => c.id === activeCampaignId) ?? null,
    [campaigns, activeCampaignId],
  );

  const codex = useCodexEntries(activeCampaign);

  const changeMode = React.useCallback((next: Mode) => {
    setMode(prev => {
      if (prev !== next) setCamFlip(f => !f);
      return next;
    });
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSpotlightOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const conceptsRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'concepts');
  }, [user, firestore]);

  const handleSaveConcept = React.useCallback(
    (concept: Omit<SavedConcept, 'id' | 'createdAt' | 'userId'>) => {
      if (!conceptsRef || !user) {
        toast({ variant: 'destructive', title: 'Error', description: 'Not signed in.' });
        return;
      }
      // The Inspiration generator is campaign-agnostic and saves without a
      // context; stamping the active campaign is what makes the result findable
      // in the Codex afterwards. Written conditionally because Firestore
      // rejects an explicit `undefined` field value.
      const context = concept.context ?? activeCampaign?.name;

      addDocumentNonBlocking(conceptsRef, {
        ...concept,
        ...(context ? { context } : {}),
        userId: user.uid,
        createdAt: serverTimestamp(),
      })
        .then(() => toast({ title: 'Saved to the codex' }))
        .catch(() => toast({ variant: 'destructive', title: 'Could not save concept' }));
    },
    [conceptsRef, user, toast, activeCampaign?.name],
  );

  const handleSpotlightEntry = React.useCallback((entry: CodexEntry) => {
    changeMode('codex');
    setCodexFocusId(entry.id);
  }, [changeMode]);

  const modeHint =
    mode === 'table' ? 'Running a session'
      : mode === 'forge' ? 'Preparing between sessions'
        : `The world · ${codex.entries.length} entries`;

  const sessionCount = codex.raw.sessions?.length ?? 0;

  return (
    <>
      {/* ── Status bar (42px) ── */}
      <div className="h-[42px] flex-shrink-0 flex items-stretch bg-[hsl(var(--background)/0.92)] border-b border-oxblood/40">
        <CampaignSwitcher
          campaigns={campaigns ?? []}
          activeCampaignId={activeCampaignId}
          onSelect={setActiveCampaignId}
        />

        <div className="flex items-center gap-4 px-[18px]">
          {sessionCount > 0 && (
            <span className="font-mono text-[10.5px] font-bold tracking-[0.12em] text-bone-body">
              S{codex.raw.sessions?.[0]?.sessionNumber ?? sessionCount}
            </span>
          )}
          <span className="font-mono text-[10.5px] tracking-[0.12em] text-bone-faint">
            {sessionCount} {sessionCount === 1 ? 'SESSION' : 'SESSIONS'} LOGGED
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center pr-2.5">
          <button
            onClick={() => setSpotlightOpen(true)}
            className="flex items-center gap-2.5 h-[26px] pl-[11px] pr-[9px] bg-[hsl(var(--border)/0.05)] border border-border/[0.12] hover:border-oxblood hover:bg-oxblood/[0.16] transition-colors"
          >
            <Search className="h-3 w-3 text-bone-dim" />
            <span className="text-[11.5px] text-bone-dim">Spotlight</span>
            <span className="font-mono text-[9.5px] text-bone-faint border border-border/[0.14] px-1 py-px">⌘K</span>
          </button>
        </div>
      </div>

      {/* ── Mode switcher ── */}
      <div className="flex-shrink-0 flex items-end gap-[26px] px-[26px] pt-4">
        {MODES.map(m => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => changeMode(m.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative pb-[9px] font-headline text-[19px] font-extrabold uppercase tracking-[0.16em] transition-colors',
                active
                  ? 'text-bone [text-shadow:0_0_30px_hsl(var(--oxblood-bright)/0.6)]'
                  : 'text-bone-faintest hover:text-bone-faint',
              )}
            >
              {m.label}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-0 bottom-0 h-[3px] bg-oxblood transition-[width,opacity] duration-200',
                  active
                    ? 'w-full opacity-100 shadow-[0_0_16px_hsl(var(--oxblood-bright)/0.95)]'
                    : 'w-0 opacity-0',
                )}
              />
            </button>
          );
        })}
        <div className="flex-1" />
        <span className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-bone-faint pb-[9px]">
          {modeHint}
        </span>
      </div>

      {/* ── Content ──
          grid-rows-[minmax(0,1fr)] is load-bearing: without it the auto row
          grows to its tallest child and pushes the party dock off screen. */}
      <div
        key={mode}
        className={cn(
          'flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)]',
          // The camera move owns `transform` on this element, so content
          // parallax lives on the child below — two transforms on one element
          // means the animation wins and the parallax silently does nothing.
          camFlip ? 'animate-camB' : 'animate-camA',
        )}
      >
       <div
         className="min-h-0 grid grid-rows-[minmax(0,1fr)]"
         style={{ transform: 'translate3d(calc(var(--px, 0) * 10px), calc(var(--py, 0) * 6px), 0)' }}
       >
        {!activeCampaign ? (
          <div className="flex items-center justify-center text-bone-faint italic">
            {campaignsLoading ? 'Loading your campaigns…' : 'Create a campaign to begin — use the campaign menu above.'}
          </div>
        ) : mode === 'table' ? (
          <TableMode campaign={activeCampaign} codex={codex} view={tableView} onViewChange={setTableView} />
        ) : mode === 'forge' ? (
          <ForgeMode
            campaign={activeCampaign}
            codex={codex}
            view={forgeView}
            onViewChange={setForgeView}
            onSaveConcept={handleSaveConcept}
          />
        ) : (
          <CodexMode
            campaign={activeCampaign}
            codex={codex}
            focusEntryId={codexFocusId}
            onFocusHandled={() => setCodexFocusId(null)}
          />
        )}
       </div>
      </div>

      <Spotlight
        open={spotlightOpen}
        onOpenChange={setSpotlightOpen}
        entries={codex.entries}
        campaigns={campaigns ?? []}
        onSelectEntry={handleSpotlightEntry}
        onSelectCampaign={c => setActiveCampaignId(c.id)}
      />
    </>
  );
}
