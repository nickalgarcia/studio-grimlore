'use client';

import * as React from 'react';
import { doc, serverTimestamp } from 'firebase/firestore';
import { setDocumentNonBlocking, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Character, Combatant, CombatState, Condition } from '@/lib/types';

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Initiative order: highest initiative first, unset initiative last.
 * `seq` breaks ties deterministically: without it, two combatants who rolled
 * the same number have no stable order and the reorder arrows do nothing.
 */
export function sortedCombatants(list: Combatant[]): Combatant[] {
  return [...list].sort((a, b) => {
    const ia = a.initiative === '' ? -Infinity : a.initiative;
    const ib = b.initiative === '' ? -Infinity : b.initiative;
    if (ia !== ib) return ib - ia;
    return (a.seq ?? 0) - (b.seq ?? 0);
  });
}

/**
 * The encounter, persisted at `combatState/current`.
 *
 * Moved out of the tracker so the Table's turn strip and the SET UP sheet
 * share one copy, and so it lives in the campaign provider: leaving /table no
 * longer unmounts it mid-edit. The invariants are unchanged:
 *   - hydrate once per mount, so our own writes echoing back can't clobber
 *     local edits
 *   - the active turn is tracked by id, not position, so removals and
 *     initiative edits can't silently move it
 *   - `seq` is a monotonic tiebreak seeded past the stored encounter's
 */
export function useCombat(campaignId: string | null | undefined) {
  const { user } = useUser();
  const firestore = useFirestore();

  const ref = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return doc(firestore, 'users', user.uid, 'campaigns', campaignId, 'combatState', 'current');
  }, [user, campaignId, firestore]);
  const { data: stored, isLoading } = useDoc<CombatState>(ref);

  const [combatants, setCombatants] = React.useState<Combatant[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [round, setRound] = React.useState(1);
  const [turnCount, setTurnCount] = React.useState(1);
  const [started, setStarted] = React.useState(false);

  const seqRef = React.useRef(0);
  const nextSeq = React.useCallback(() => ++seqRef.current, []);

  // Hydrate once per mount. The provider remounts this hook per campaign
  // (CampaignScope is keyed by campaign id), so a switch re-hydrates cleanly.
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    if (hydrated || isLoading) return;
    if (stored) {
      // Encounters saved before `seq` existed get one from their stored order.
      const loaded = (stored.combatants ?? []).map((c, i) => ({ ...c, seq: c.seq ?? i + 1 }));
      seqRef.current = loaded.reduce((max, c) => Math.max(max, c.seq), 0);
      setCombatants(loaded);
      setRound(stored.round ?? 1);
      setTurnCount(stored.turnCount ?? 1);
      setStarted(stored.started ?? false);
      // Prefer the id; fall back to the legacy positional index.
      const legacyActive = sortedCombatants(loaded)[stored.activeIndex ?? 0]?.id ?? null;
      setActiveId(stored.activeId ?? legacyActive);
    }
    setHydrated(true);
  }, [stored, isLoading, hydrated]);

  // Persist every change once hydrated.
  React.useEffect(() => {
    if (!hydrated || !ref) return;
    setDocumentNonBlocking(ref, {
      campaignId, combatants, activeId, round, turnCount, started, updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [hydrated, combatants, activeId, round, turnCount, started, ref, campaignId]);

  const sorted = React.useMemo(() => sortedCombatants(combatants), [combatants]);
  const active = started ? sorted.find(c => c.id === activeId) ?? null : null;

  const addPartyMember = (char: Character) => {
    if (combatants.find(c => c.name === char.name)) return;
    setCombatants(prev => [...prev, {
      id: uid(), name: char.name, initiative: '', type: 'player', seq: nextSeq(), conditions: [],
    }]);
  };

  const addMonster = (c: Omit<Combatant, 'seq' | 'id'> & { id?: string }) => {
    setCombatants(prev => [...prev, { ...c, id: c.id ?? uid(), seq: nextSeq() }]);
  };

  /** Swaps the whole sort key (initiative and tiebreak), so arrows work on tied rolls. */
  const move = (id: string, dir: 'up' | 'down') => {
    const idx = sorted.findIndex(c => c.id === id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    setCombatants(prev => prev.map(c => {
      if (c.id === a.id) return { ...c, initiative: b.initiative, seq: b.seq };
      if (c.id === b.id) return { ...c, initiative: a.initiative, seq: a.seq };
      return c;
    }));
  };

  const remove = (id: string) => {
    const remaining = sorted.filter(c => c.id !== id);
    // The turn passes to whoever would have gone next, not to a neighbour.
    if (id === activeId) {
      const idx = sorted.findIndex(c => c.id === id);
      setActiveId(remaining.length > 0 ? remaining[idx % remaining.length].id : null);
    }
    // Nobody left ends the encounter rather than leaving dead turn controls.
    if (remaining.length === 0) {
      setStarted(false);
      setRound(1);
      setTurnCount(1);
      setActiveId(null);
    }
    setCombatants(prev => prev.filter(c => c.id !== id));
  };

  const setInitiative = (id: string, val: number | '') =>
    setCombatants(prev => prev.map(c => (c.id === id ? { ...c, initiative: val } : c)));

  const setHp = (id: string, val: number) =>
    setCombatants(prev => prev.map(c => (c.id === id ? { ...c, currentHp: val } : c)));

  const toggleCondition = (id: string, condition: Condition) =>
    setCombatants(prev => prev.map(c => {
      if (c.id !== id) return c;
      const has = c.conditions.includes(condition);
      return { ...c, conditions: has ? c.conditions.filter(x => x !== condition) : [...c.conditions, condition] };
    }));

  /** Next wraps to the top of the order and starts a new round. */
  const nextTurn = () => {
    if (sorted.length === 0) return;
    const i = sorted.findIndex(c => c.id === activeId);
    const next = i < 0 ? 0 : (i + 1) % sorted.length;
    if (next === 0) setRound(r => r + 1);
    setActiveId(sorted[next].id);
    setTurnCount(t => t + 1);
  };

  /** Back reverses Next: from the top of the order it returns to the last round. */
  const prevTurn = () => {
    if (sorted.length === 0) return;
    const i = sorted.findIndex(c => c.id === activeId);
    if (i === 0 && round === 1) return; // nothing before the first turn
    const prev = i <= 0 ? sorted.length - 1 : i - 1;
    if (i === 0) setRound(r => Math.max(1, r - 1));
    setActiveId(sorted[prev].id);
    setTurnCount(t => Math.max(1, t - 1));
  };

  const start = () => {
    if (sorted.length === 0) return;
    setActiveId(sorted[0].id);
    setRound(1);
    setTurnCount(1);
    setStarted(true);
  };

  // Writes the cleared encounter through the persist effect. Deleting the doc
  // here would race that effect, which re-creates it a tick later.
  const clear = () => {
    setCombatants([]);
    setActiveId(null);
    setRound(1);
    setTurnCount(1);
    setStarted(false);
  };

  return {
    hydrated, isLoading: isLoading && !hydrated,
    combatants, sorted, active, activeId, round, turnCount, started,
    addPartyMember, addMonster, move, remove, setInitiative, setHp, toggleCondition,
    nextTurn, prevTurn, start, clear,
  };
}

export type CombatApi = ReturnType<typeof useCombat>;
