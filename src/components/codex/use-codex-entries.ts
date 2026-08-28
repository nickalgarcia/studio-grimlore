'use client';

import * as React from 'react';
import { collection, orderBy, query } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type {
  Campaign, Character, CodexEntry, Faction, Location, Npc, SavedConcept, Session,
} from '@/lib/types';
import { conceptInCampaign, KIND_ACCENT, KIND_ORDER, sessionRef, snippet } from '@/lib/codex';

export type UseCodexEntriesResult = {
  entries: CodexEntry[];
  isLoading: boolean;
  raw: {
    npcs: (Npc & { id: string })[] | null;
    locations: (Location & { id: string })[] | null;
    factions: (Faction & { id: string })[] | null;
    characters: (Character & { id: string })[] | null;
    sessions: (Session & { id: string })[] | null;
    concepts: (SavedConcept & { id: string })[] | null;
  };
};

/**
 * One normalized index over every entity type in a campaign.
 *
 * This replaces five near-identical manager components that each ran their own
 * query, header, grid and dialogs. The five subscriptions still exist — they
 * have to, the data lives in five subcollections — but they resolve into a
 * single list with one shape, so the UI above only ever knows about
 * `CodexEntry`.
 */
export function useCodexEntries(campaign: Campaign | null | undefined): UseCodexEntriesResult {
  const { user } = useUser();
  const firestore = useFirestore();
  const campaignId = campaign?.id;

  // Written out one by one rather than through a `sub(name)` helper: hiding
  // hook calls inside a function is only safe while every call site stays
  // unconditional, and nothing enforces that.
  const npcsRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'npcs');
  }, [user, firestore, campaignId]);

  const locationsRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'locations');
  }, [user, firestore, campaignId]);

  const factionsRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'factions');
  }, [user, firestore, campaignId]);

  const charactersRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'characters');
  }, [user, firestore, campaignId]);

  const sessionsRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'sessions');
  }, [user, firestore, campaignId]);

  const sessionsQuery = useMemoFirebase(
    () => (sessionsRef ? query(sessionsRef, orderBy('sessionNumber', 'desc')) : null),
    [sessionsRef],
  );

  // Concepts live at users/{uid}/concepts — global, not per-campaign — tied to
  // a campaign only by a free-text `context`. Fetched unfiltered and narrowed
  // client-side, because the match is "this campaign OR no campaign at all"
  // and Firestore cannot express that as one query.
  const conceptsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'concepts');
  }, [user, firestore]);

  const npcs = useCollection<Npc>(npcsRef);
  const locations = useCollection<Location>(locationsRef);
  const factions = useCollection<Faction>(factionsRef);
  const characters = useCollection<Character>(charactersRef);
  const sessions = useCollection<Session>(sessionsQuery);
  const concepts = useCollection<SavedConcept>(conceptsQuery);

  const entries = React.useMemo<CodexEntry[]>(() => {
    const out: CodexEntry[] = [];

    for (const n of npcs.data ?? []) {
      out.push({
        id: n.id,
        name: n.name,
        kind: 'npc',
        where: n.location || n.factionName || snippet(n.description),
        lastSeen: sessionRef(n.lastSeenSession),
        lastSeenSession: n.lastSeenSession,
        accent: KIND_ACCENT.npc,
        disposition: n.disposition,
        wants: n.wants,
        knows: n.knows,
        source: n,
      });
    }

    for (const l of locations.data ?? []) {
      out.push({
        id: l.id,
        name: l.name,
        kind: 'place',
        where: snippet(l.description),
        lastSeen: sessionRef(l.lastSeenSession),
        lastSeenSession: l.lastSeenSession,
        accent: KIND_ACCENT.place,
        source: l,
      });
    }

    for (const f of factions.data ?? []) {
      out.push({
        id: f.id,
        name: f.name,
        kind: 'faction',
        where: f.homeBase || (f.leader ? `Led by ${f.leader}` : undefined) || snippet(f.description),
        lastSeen: sessionRef(f.lastSeenSession),
        lastSeenSession: f.lastSeenSession,
        accent: f.color || KIND_ACCENT.faction,
        disposition: f.disposition,
        // Factions keep their stored field names; the display contract is
        // wants/knows for every kind, so they are mapped here.
        wants: f.currentAgenda,
        knows: f.whatTheyKnow,
        source: f,
      });
    }

    for (const c of characters.data ?? []) {
      const bits = [c.class, c.species].filter(Boolean).join(' · ');
      out.push({
        id: c.id,
        name: c.name,
        kind: 'party',
        where: bits || c.originCity || snippet(c.backstory),
        accent: KIND_ACCENT.party,
        source: c,
      });
    }

    for (const s of sessions.data ?? []) {
      out.push({
        id: s.id,
        name: `Session ${s.sessionNumber}`,
        kind: 'session',
        where: snippet(s.summary),
        lastSeen: sessionRef(s.sessionNumber),
        lastSeenSession: s.sessionNumber,
        accent: KIND_ACCENT.session,
        source: s,
      });
    }

    for (const c of concepts.data ?? []) {
      if (!conceptInCampaign(c.context, campaign?.name ?? '')) continue;
      out.push({
        id: c.id,
        name: snippet(c.content, 48) ?? c.type,
        kind: 'concept',
        where: c.type,
        accent: KIND_ACCENT.concept,
        source: c,
      });
    }

    return out.sort((a, b) => {
      const ka = KIND_ORDER.indexOf(a.kind);
      const kb = KIND_ORDER.indexOf(b.kind);
      if (ka !== kb) return ka - kb;
      // Sessions read newest-first; everything else is alphabetical.
      if (a.kind === 'session') return (b.lastSeenSession ?? 0) - (a.lastSeenSession ?? 0);
      return a.name.localeCompare(b.name);
    });
  }, [npcs.data, locations.data, factions.data, characters.data, sessions.data, concepts.data, campaign?.name]);

  const isLoading =
    npcs.isLoading || locations.isLoading || factions.isLoading ||
    characters.isLoading || sessions.isLoading || concepts.isLoading;

  return {
    entries,
    isLoading,
    raw: {
      npcs: npcs.data, locations: locations.data, factions: factions.data,
      characters: characters.data, sessions: sessions.data, concepts: concepts.data,
    },
  };
}
