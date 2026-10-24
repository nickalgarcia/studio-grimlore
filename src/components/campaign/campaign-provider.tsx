'use client';

import * as React from 'react';
import { collection, doc } from 'firebase/firestore';
import {
  useCollection, useCurrentScene, useDoc, useFirestore, useMemoFirebase, useRules, useThreads, useUser, type WithId,
} from '@/firebase';
import { useCodexEntries, type UseCodexEntriesResult } from '@/components/codex/use-codex-entries';
import { useCombat, type CombatApi } from '@/components/table/use-combat';
import { useLiveSession } from '@/components/table/use-live-session';
import {
  createMatcher, indexCampaign, mentionTargets, type CampaignMentions, type Matcher,
} from '@/lib/mentions';
import { buildLanes, type LoomLane } from '@/lib/loom';
import { pageHref, pageKindOf } from '@/lib/pages';
import type { Campaign, Npc, Rule, Scene, Session, SessionPrepState, Thread } from '@/lib/types';

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

  /** Every entity collection, normalized. */
  codex: UseCodexEntriesResult;
  threads: WithId<Thread>[] | null;

  /** Played sessions, oldest first. Issue numbers are their `sessionNumber`s. */
  issues: WithId<Session>[];
  latestIssue: WithId<Session> | null;
  /** Latest played + 1. There is no placeholder document for it (plan D4). */
  nextIssueNumber: number;
  prep: SessionPrepState | null;

  /** The newest scene is the current one. */
  scene: WithId<Scene> | null;
  onStage: WithId<Npc>[];

  /** House rules plus the 5e core, with pinned / tonight state. Per user. */
  rules: Rule[];

  matcher: Matcher;
  /** Canonical names a drafted recap may [[link]]: every entity and thread title. */
  linkNames: string[];
  mentions: CampaignMentions;
  lanes: LoomLane[];

  /** Owned here, not by Table, so `+` capture works from every screen. */
  live: ReturnType<typeof useLiveSession>;
  /** Owned here so the turn strip and the setup sheet share one encounter across routes. */
  combat: CombatApi;

  /** Where an entity id lives, for callers that only have the id. */
  hrefForEntryId: (id: string) => string | null;
};

const CampaignContext = React.createContext<CampaignContextValue | null>(null);

export function useCampaign(): CampaignContextValue {
  const ctx = React.useContext(CampaignContext);
  if (!ctx) throw new Error('useCampaign must be used inside <CampaignProvider>.');
  return ctx;
}

type ListState = Pick<CampaignContextValue, 'campaigns' | 'campaignsLoading' | 'activeCampaign' | 'setActiveCampaignId'>;

/**
 * Everything the screens share, subscribed once.
 *
 * It sits in the `(app)` layout, which the App Router keeps mounted across
 * navigation, so moving between screens never re-opens a listener or drops
 * the live session mid-stream.
 */
export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();

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

  // Fall back to the first campaign when nothing is stored or the stored one was deleted.
  React.useEffect(() => {
    if (!restored || campaignsLoading || !campaigns) return;
    if (activeCampaignId && campaigns.some(c => c.id === activeCampaignId)) return;
    setActiveCampaignId(campaigns[0]?.id ?? null);
  }, [restored, campaignsLoading, campaigns, activeCampaignId, setActiveCampaignId]);

  const activeCampaign = React.useMemo(
    () => campaigns?.find(c => c.id === activeCampaignId) ?? null,
    [campaigns, activeCampaignId],
  );

  const list: ListState = { campaigns, campaignsLoading, activeCampaign, setActiveCampaignId };

  // Keyed by campaign: every per-campaign hook below remounts on a switch.
  // The live session and combat hydrate once per mount; without the remount,
  // one campaign's notes and encounter would be saved into the next one's.
  return (
    <CampaignScope key={activeCampaign?.id ?? 'none'} list={list}>
      {children}
    </CampaignScope>
  );
}

function CampaignScope({ list, children }: { list: ListState; children: React.ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeCampaign } = list;
  const campaignId = activeCampaign?.id ?? null;

  const codex = useCodexEntries(activeCampaign);
  const { data: threads } = useThreads(campaignId);
  const { rules } = useRules();
  const { data: scene } = useCurrentScene(campaignId);

  const prepRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return doc(firestore, 'users', user.uid, 'campaigns', campaignId, 'sessionPrep', 'current');
  }, [user, firestore, campaignId]);
  const { data: prep } = useDoc<SessionPrepState>(prepRef);

  const onStage = React.useMemo(() => {
    const ids = new Set(scene?.onStageNpcIds ?? []);
    return (codex.raw.npcs ?? []).filter(n => ids.has(n.id));
  }, [scene?.onStageNpcIds, codex.raw.npcs]);

  const live = useLiveSession(campaignId, {
    campaign: activeCampaign,
    sessions: codex.raw.sessions,
    characters: codex.raw.characters,
    scene,
    onStage,
  });
  const combat = useCombat(campaignId);

  const issues = React.useMemo(
    () => [...(codex.raw.sessions ?? [])].sort((a, b) => a.sessionNumber - b.sessionNumber),
    [codex.raw.sessions],
  );
  const latestIssue = issues[issues.length - 1] ?? null;
  const nextIssueNumber = (latestIssue?.sessionNumber ?? 0) + 1;

  // The matcher is rebuilt only when an entity list changes, not per render;
  // building the detector regex is the only non-trivial cost in the index.
  const { npcs, characters, locations, factions } = codex.raw;
  const targets = React.useMemo(
    () => mentionTargets({ npcs, characters, locations, factions, threads }),
    [npcs, characters, locations, factions, threads],
  );
  const matcher = React.useMemo(() => createMatcher(targets), [targets]);
  const linkNames = React.useMemo(() => [...new Set(targets.map(t => t.name.trim()))], [targets]);
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
      return `/issue/${(entry.source as Session).sessionNumber}`;
    }
    if (threads?.some(t => t.id === id)) return pageHref({ kind: 'thread', id });
    return null;
  }, [codex.entries, threads]);

  // `live`, `combat` and `codex` are fresh objects every render, so this value
  // changes on every render too (a streamed token re-renders consumers). That
  // was already true of the v3 shell; split the context if it ever shows up
  // in a profile.
  const value: CampaignContextValue = {
    ...list,
    codex, threads, issues, latestIssue, nextIssueNumber, prep: prep ?? null,
    scene, onStage, rules,
    matcher, linkNames, mentions, lanes, live, combat, hrefForEntryId,
  };

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>;
}
