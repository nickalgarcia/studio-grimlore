'use client';

import * as React from 'react';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useUser } from '@/firebase/provider';
import {
  addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking, updateDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import { useCollection, type WithId } from './use-collection';
import { clientCreatedAt, stripUndefined } from './campaign-collection';
import { CORE_RULES } from '@/lib/core-rules';
import type { Rule, RuleDoc } from '@/lib/types';

/**
 * Rules live per user at `users/{uid}/rules`, shared across campaigns.
 * House rules are whole documents; a core rule only has a document once it
 * has been pinned or flagged for tonight.
 */
export function useRules(): { rules: Rule[]; isLoading: boolean } {
  const { user } = useUser();
  const firestore = useFirestore();
  const ref = useMemoFirebase(() => (user ? collection(firestore, 'users', user.uid, 'rules') : null), [user, firestore]);
  const { data, isLoading } = useCollection<RuleDoc>(ref);

  const rules = React.useMemo<Rule[]>(() => {
    const docs = data ?? [];
    const state = new Map(docs.filter(d => d.kind === 'core').map(d => [d.id, d]));
    const core: Rule[] = CORE_RULES.map(r => ({
      ...r,
      pinned: !!state.get(r.id)?.pinned,
      tonight: !!state.get(r.id)?.tonight,
    }));
    const house: Rule[] = docs
      .filter((d): d is WithId<Extract<RuleDoc, { kind: 'house' }>> => d.kind === 'house')
      .map(({ createdAt: _c, updatedAt: _u, ...d }) => ({ ...d, kind: 'house' as const, pinned: !!d.pinned, tonight: !!d.tonight }));
    // House rules first: they're the ones that change the game at this table.
    return [...house.sort((a, b) => a.title.localeCompare(b.title)), ...core];
  }, [data]);

  return { rules, isLoading };
}

export type HouseRuleInput = Pick<Rule, 'title' | 'category' | 'text'> & Partial<Pick<Rule, 'replaces' | 'why' | 'sinceSession'>>;

export function useRuleWriter() {
  const { user } = useUser();
  const firestore = useFirestore();

  const ruleDoc = React.useCallback(
    (id: string) => (user ? doc(firestore, 'users', user.uid, 'rules', id) : null),
    [user, firestore],
  );

  const createHouseRule = React.useCallback((input: HouseRuleInput) => {
    if (!user) return Promise.resolve(null);
    return addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'rules'), stripUndefined({
      ...input, kind: 'house', pinned: false, createdAt: clientCreatedAt(), updatedAt: serverTimestamp(),
    }));
  }, [user, firestore]);

  const updateHouseRule = React.useCallback((id: string, patch: Partial<HouseRuleInput>) => {
    const ref = ruleDoc(id);
    if (!ref) return Promise.resolve();
    return updateDocumentNonBlocking(ref, stripUndefined({ ...patch, updatedAt: serverTimestamp() }));
  }, [ruleDoc]);

  const deleteHouseRule = React.useCallback((id: string) => {
    const ref = ruleDoc(id);
    return ref ? deleteDocumentNonBlocking(ref) : Promise.resolve();
  }, [ruleDoc]);

  /**
   * Pin or flag any rule. Merge writes, so a core rule's state document is
   * created on first use; `kind` is always written because the rules refuse
   * an update that changes it and a create without it.
   */
  const setFlags = React.useCallback((rule: Rule, flags: Partial<Pick<Rule, 'pinned' | 'tonight'>>) => {
    const ref = ruleDoc(rule.id);
    if (!ref) return Promise.resolve();
    return setDocumentNonBlocking(ref, { kind: rule.kind, ...flags, updatedAt: serverTimestamp() }, { merge: true });
  }, [ruleDoc]);

  return { createHouseRule, updateHouseRule, deleteHouseRule, setFlags };
}
