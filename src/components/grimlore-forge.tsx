'use client';

import * as React from 'react';
import { collection, serverTimestamp } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { BookMarked, Flame, Hammer, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CampaignSwitcher } from '@/components/campaign-switcher';
import { Spotlight } from '@/components/spotlight';
import { TableMode, type TableView } from '@/components/modes/table-mode';
import { ForgeMode, type ForgeView } from '@/components/modes/forge-mode';
import { CodexMode } from '@/components/modes/codex-mode';
import { useCodexEntries } from '@/components/codex/use-codex-entries';
import type { Campaign, CodexEntry, SavedConcept } from '@/lib/types';

export type Mode = 'table' | 'forge' | 'codex';

const MODES: { id: Mode; label: string; icon: React.ReactNode }[] = [
  { id: 'table', label: 'Table', icon: <Flame className="h-4 w-4" /> },
  { id: 'forge', label: 'Forge', icon: <Hammer className="h-4 w-4" /> },
  { id: 'codex', label: 'Codex', icon: <BookMarked className="h-4 w-4" /> },
];

const MODE_HINT: Record<Mode, string> = {
  table: 'Running a session',
  forge: 'Preparing between sessions',
  codex: 'Everything in the world',
};

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
  return {
    mode: isMode(mode) ? mode : null,
    campaignId: params.get('campaign'),
  };
}

function writeUrlState(mode: Mode, campaignId: string | null) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  params.set('mode', mode);
  if (campaignId) params.set('campaign', campaignId);
  else params.delete('campaign');
  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', next);
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

  // Read the URL once on mount. Reading it on every render would fight the
  // writes below; hydrating once is the same shape as live-session's
  // hydrate-once rule and for the same reason.
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

  // Fall back to the first campaign so the app never sits on an empty shell,
  // and drop a campaign id from the URL that no longer resolves.
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

  // Spotlight searches the codex, so the index is built at shell level and
  // handed to both the palette and Codex mode.
  const codex = useCodexEntries(activeCampaign);

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
    setMode('codex');
    setCodexFocusId(entry.id);
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <nav className="border-b border-primary/10 bg-background/80 backdrop-blur sticky top-16 z-40">
        <div className="container flex items-center gap-4 py-2 flex-wrap">
          <CampaignSwitcher
            campaigns={campaigns ?? []}
            activeCampaignId={activeCampaignId}
            onSelect={setActiveCampaignId}
          />

          <div className="flex items-end gap-0">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                aria-current={mode === m.id ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 px-5 py-3 font-headline text-[0.65rem] tracking-[0.12em]',
                  'uppercase transition-all border-b-2 whitespace-nowrap',
                  mode === m.id
                    ? 'text-accent border-accent'
                    : 'text-muted-foreground/60 border-transparent hover:text-foreground/80 hover:border-primary/30',
                )}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          <span className="label-forge hidden md:inline">{MODE_HINT[mode]}</span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSpotlightOpen(true)}
            className="ml-auto gap-2 text-muted-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            Spotlight
            <kbd className="text-[10px] border border-border rounded px-1 py-0.5">⌘K</kbd>
          </Button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto min-w-0 container px-4 py-6 lg:px-8">
        {!activeCampaign ? (
          <EmptyState
            message={
              campaignsLoading
                ? 'Loading your campaigns…'
                : 'Create a campaign to begin — use the campaign menu above.'
            }
          />
        ) : mode === 'table' ? (
          <TableMode campaign={activeCampaign} view={tableView} onViewChange={setTableView} />
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
            key={activeCampaign.id}
            campaign={activeCampaign}
            codex={codex}
            focusEntryId={codexFocusId}
            onFocusHandled={() => setCodexFocusId(null)}
          />
        )}
      </main>

      <Spotlight
        open={spotlightOpen}
        onOpenChange={setSpotlightOpen}
        entries={codex.entries}
        campaigns={campaigns ?? []}
        onSelectEntry={handleSpotlightEntry}
        onSelectCampaign={c => setActiveCampaignId(c.id)}
      />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground font-body italic text-lg">
      {message}
    </div>
  );
}
