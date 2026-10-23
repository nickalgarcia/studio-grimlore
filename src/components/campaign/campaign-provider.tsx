'use client';

import * as React from 'react';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import {
  useCollection, useDoc, useFirestore, useMemoFirebase, useThreads, useUser, type WithId,
} from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { useCodexEntries, type UseCodexEntriesResult } from '@/components/codex/use-codex-entries';
import { useLiveSession } from '@/components/table/use-live-session';
import {
  createMatcher, indexCampaign, mentionTargets, type CampaignMentions, type Matcher,
} from '@/lib/mentions';
import { buildLanes, type LoomLane } from '@/lib/loom';
import { pageHref, pageKindOf } from '@/lib/pages';
import type { Campaign, SavedConcept, Session, SessionPrepState, Thread } from '@/lib/types';

const CAMPAIGN_KEY = 'grimlore.campaign';

/** Storage can throw (private mode, blocked site data); a lost preference is fine. */
function readStoredCampaign(): string | null {
  try { return window.localStorage.getItem(CAMPAIGN_KEY); } catch { return null; }
}
function writeStoredCampaign(id: string | null) {
  try {
    if (id) window.localStorage.setItem(CAMPAIGN_KEY, id);
    else window.localStorage.removeItem(CAMPAIGN_KEY);
  } catch { /* preference only */ }
}

export type CampaignContextValue = {
  campaigns: WithId<Campaign>[] | null;
  campaignsLoading: boolean;
  activeCampaign: WithId<Campaign> | null;
  setActiveCampaignId: (id: string | null) => void;

  /** Every entity collection, normalized. Still the v3 shape; Stage 5 replaces it. */
  codex: UseCodexEntriesResult;
  threads: WithId<Thread>[] | null;

  /** Played sessions, oldest first. Issue numbers are their `sessionNumber`s. */
  issues: WithId<Session>[];
  latestIssue: WithId<Session> | null;
  /** Latest played + 1. There is no placeholder document for it (plan D4). */
  nextIssueNumber: number;
  prep: SessionPrepState | null;

  matcher: Matcher;
  mentions: CampaignMentions;
  lanes: LoomLane[];

  /** Owned here, not by Table, so `+` capture works from every screen. */
  live: ReturnType<typeof useLiveSession>;

  /** Where an entity id lives, for callers that only have the id (v3 components). */
  hrefForEntryId: (id: string) => string | null;
  saveConcept: (concept: Omit<SavedConcept, 'id' | 'createdAt' | 'userId'>) => void;
};

const CampaignContext = React.createContext<CampaignContextValue | null>(null);

export function useCampaign(): CampaignContextValue {
  const ctx = React.useContext(CampaignContext);
  if (!ctx) throw new Error('useCampaign must be used inside <CampaignProvider>.');
  return ctx;
}

/**
 * Everything the screens share, subscribed once.
 *
 * It sits in the `(app)` layout, which the App Router keeps mounted across
 * navigation, so moving between Story, Issue and Table never re-opens a
 * listener or drops the live session mid-stream.
 */
export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const campaignsRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'campaigns');
  }, [user, firestore]);
  const { data: campaigns, isLoading: campaignsLoading } = useCollection<Campaign>(campaignsRef);

  // Read after mount: localStorage doesn't exist during the server render.
  const [activeCampaignId, setActiveCampaignIdState] = React.useState<string | null>(null);
  const [restored, setRestored] = React.useState(false);
  React.useEffect(() => {
    setActiveCampaignIdState(readStoredCampaign());
    setRestored(true);
  }, []);

  const setActiveCampaignId = React.useCallback((id: string | null) => {
    setActiveCampaignIdState(id);
    writeStoredCampaign(id);
  }, []);

  // Fall back to the first campaign when nothing is stored or the stored one
  // was deleted.
  React.useEffect(() => {
    if (!restored || campaignsLoading || !campaigns) return;
    if (activeCampaignId && campaigns.some(c => c.id === activeCampaignId)) return;
    setActiveCampaignId(campaigns[0]?.id ?? null);
  }, [restored, campaignsLoading, campaigns, activeCampaignId, setActiveCampaignId]);

  const activeCampaign = React.useMemo(
    () => campaigns?.find(c => c.id === activeCampaignId) ?? null,
    [campaigns, activeCampaignId],
  );
  const campaignId = activeCampaign?.id ?? null;

  const codex = useCodexEntries(activeCampaign);
  const { data: threads } = useThreads(campaignId);

  const prepRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return doc(firestore, 'users', user.uid, 'campaigns', campaignId, 'sessionPrep', 'current');
  }, [user, firestore, campaignId]);
  const { data: prep } = useDoc<SessionPrepState>(prepRef);

  const live = useLiveSession(campaignId, {
    campaign: activeCampaign,
    sessions: codex.raw.sessions,
    characters: codex.raw.characters,
  });

  const issues = React.useMemo(
    () => [...(codex.raw.sessions ?? [])].sort((a, b) => a.sessionNumber - b.sessionNumber),
    [codex.raw.sessions],
  );
  const latestIssue = issues[issues.length - 1] ?? null;
  const nextIssueNumber = (latestIssue?.sessionNumber ?? 0) + 1;

  // The matcher is rebuilt only when an entity list changes, not per render;
  // building the detector regex is the only non-trivial cost in the index.
  const { npcs, characters, locations, factions } = codex.raw;
  const matcher = React.useMemo(
    () => createMatcher(mentionTargets({ npcs, characters, locations, factions, threads })),
    [npcs, characters, locations, factions, threads],
  );
  const mentions = React.useMemo(() => indexCampaign(issues, matcher), [issues, matcher]);
  const lanes = React.useMemo(
    () => buildLanes({ threads, npcs, appearances: mentions.appearances }),
    [threads, npcs, mentions.appearances],
  );

  const hrefForEntryId = React.useCallback((id: string) => {
    const entry = codex.entries.find(e => e.id === id);
    if (entry) {
      const kind = pageKindOf(entry.kind);
      if (kind) return pageHref({ kind, id });
      const s = entry.source as Session;
      return `/issue/${s.sessionNumber}`;
    }
    if (threads?.some(t => t.id === id)) return pageHref({ kind: 'thread', id });
    return null;
  }, [codex.entries, threads]);

  const conceptsRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'concepts');
  }, [user, firestore]);

  // Moved from the v3 shell for the Forge generators, which /prep mounts until
  // Stage 6. Written conditionally because Firestore rejects `undefined`.
  const saveConcept = React.useCallback(
    (concept: Omit<SavedConcept, 'id' | 'createdAt' | 'userId'>) => {
      if (!conceptsRef || !user) {
        toast({ variant: 'destructive', title: 'Error', description: 'Not signed in.' });
        return;
      }
      const context = concept.context ?? activeCampaign?.name;
      addDocumentNonBlocking(conceptsRef, {
        ...concept,
        ...(context ? { context } : {}),
        userId: user.uid,
        createdAt: serverTimestamp(),
      })
        .then(() => toast({ title: 'Saved as a note' }))
        .catch(() => toast({ variant: 'destructive', title: 'Could not save concept' }));
    },
    [conceptsRef, user, toast, activeCampaign?.name],
  );

  const value = React.useMemo<CampaignContextValue>(() => ({
    campaigns, campaignsLoading, activeCampaign, setActiveCampaignId,
    codex, threads, issues, latestIssue, nextIssueNumber, prep: prep ?? null,
    matcher, mentions, lanes, live, hrefForEntryId, saveConcept,
  }), [
    campaigns, campaignsLoading, activeCampaign, setActiveCampaignId,
    codex, threads, issues, latestIssue, nextIssueNumber, prep,
    matcher, mentions, lanes, live, hrefForEntryId, saveConcept,
  ]);

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>;
}
