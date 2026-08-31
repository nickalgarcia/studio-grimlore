'use client';

import * as React from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import type { Character, Combatant, Condition, CombatState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Swords, Plus, Trash2, ChevronUp, ChevronDown,
  SkipForward, RotateCcw, Dice6, ExternalLink, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ALL_CONDITIONS: Condition[] = [
  'Blinded', 'Charmed', 'Concentrating', 'Exhausted', 'Frightened',
  'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
  'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
];

/**
 * Three families instead of sixteen hues: the palette has room for cold
 * (concentration and stealth), warm (impairment), and oxblood (hard control).
 * Sixteen stock Tailwind colours read as a bug against ash and bone.
 */
const CONDITION_COLORS: Record<Condition, string> = (() => {
  const cold = 'bg-[hsl(var(--border)/0.09)] text-bone-dim border-[hsl(var(--border)/0.18)]';
  const warm = 'bg-[hsl(var(--brass)/0.15)] text-brass border-[hsl(var(--brass)/0.35)]';
  const hard = 'bg-[hsl(var(--oxblood)/0.25)] text-oxblood-pale border-[hsl(var(--oxblood)/0.5)]';
  return {
    Concentrating: cold, Invisible: cold, Charmed: cold,
    Exhausted: warm, Frightened: warm, Grappled: warm, Prone: warm,
    Restrained: warm, Blinded: warm, Deafened: warm, Poisoned: warm,
    Incapacitated: hard, Paralyzed: hard, Petrified: hard,
    Stunned: hard, Unconscious: hard,
  };
})();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Initiative order: highest initiative first, unset initiative last.
 * `seq` breaks ties deterministically — without it, two combatants who rolled
 * the same number have no stable order and the reorder arrows do nothing.
 */
function sortedCombatants(list: Combatant[]): Combatant[] {
  return [...list].sort((a, b) => {
    const ia = a.initiative === '' ? -Infinity : a.initiative;
    const ib = b.initiative === '' ? -Infinity : b.initiative;
    if (ia !== ib) return ib - ia;
    return (a.seq ?? 0) - (b.seq ?? 0);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HP Control — isolated so parent re-renders don't interrupt input
// ─────────────────────────────────────────────────────────────────────────────
const HpControl = React.memo(function HpControl({
  currentHp, maxHp, onChange,
}: {
  currentHp: number;
  maxHp: number;
  onChange: (val: number) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(String(currentHp));

  const pct = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
  const barColor = pct > 0.5 ? 'bg-bone-dim' : pct > 0.25 ? 'bg-brass' : 'bg-oxblood';

  const commit = () => {
    const val = parseInt(draft, 10);
    if (!isNaN(val)) onChange(Math.max(0, Math.min(maxHp, val)));
    else setDraft(String(currentHp));
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <button
        type="button"
        aria-label="Decrease hit points by 1"
        onClick={() => onChange(Math.max(0, currentHp - 1))}
        className="w-6 h-6 bg-[hsl(var(--oxblood)/0.2)] hover:bg-[hsl(var(--oxblood)/0.4)] text-oxblood-pale flex items-center justify-center text-sm font-bold transition-colors flex-shrink-0"
      >−</button>

      <div className="flex-1 space-y-1">
        {editing ? (
          <input
            type="number"
            aria-label="Current hit points"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => e.key === 'Enter' && commit()}
            autoFocus
            className="w-full text-center text-sm bg-card border border-primary/30 rounded px-1 py-0.5 outline-none"
          />
        ) : (
          <button
            type="button"
            aria-label={`Hit points: ${currentHp} of ${maxHp}. Click to edit.`}
            onClick={() => { setDraft(String(currentHp)); setEditing(true); }}
            className="w-full text-center text-sm font-headline text-foreground/90 hover:text-primary transition-colors"
          >
            {currentHp}/{maxHp}
          </button>
        )}
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        aria-label="Increase hit points by 1"
        onClick={() => onChange(Math.min(maxHp, currentHp + 1))}
        className="w-6 h-6 rounded bg-[hsl(var(--border)/0.09)] hover:bg-[hsl(var(--border)/0.18)] text-bone-soft flex items-center justify-center text-sm font-bold transition-colors flex-shrink-0"
      >+</button>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Add Monster Form
// ─────────────────────────────────────────────────────────────────────────────
function AddMonsterForm({ onAdd }: { onAdd: (c: Omit<Combatant, 'seq'>) => void }) {
  const [name, setName] = React.useState('');
  const [initiative, setInitiative] = React.useState('');
  const [hp, setHp] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [open, setOpen] = React.useState(false);

  const handleAdd = () => {
    if (!name.trim()) return;
    const parsedHp = hp ? parseInt(hp, 10) : undefined;
    const trimmedUrl = url.trim();
    onAdd({
      id: uid(),
      name: name.trim(),
      initiative: initiative ? parseInt(initiative, 10) : '',
      type: 'monster',
      ...(parsedHp !== undefined && { maxHp: parsedHp, currentHp: parsedHp }),
      ...(trimmedUrl && { url: trimmedUrl }),
      conditions: [],
    });
    setName('');
    setInitiative('');
    setHp('');
    setUrl('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-red-500/25 hover:border-red-500/50 hover:bg-red-500/5 transition-colors text-sm text-red-400/70 hover:text-red-400"
      >
        <Plus className="h-4 w-4" />
        Add Monster / NPC
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-4 space-y-3">
      <p className="label-forge text-red-400/70">Add Monster / NPC</p>
      <div className="grid grid-cols-2 gap-3">
        <Input
          placeholder="Name *"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="text-base col-span-2"
          autoFocus
        />
        <div className="relative">
          <Input
            placeholder="Initiative"
            aria-label="Initiative"
            type="number"
            value={initiative}
            onChange={e => setInitiative(e.target.value)}
            className="text-base pr-10"
          />
          <button
            type="button"
            onClick={() => setInitiative(String(rollD20()))}
            title="Roll d20"
            aria-label="Roll d20 for initiative"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary transition-colors"
          >
            <Dice6 className="h-4 w-4" />
          </button>
        </div>
        <Input
          placeholder="Max HP"
          type="number"
          value={hp}
          onChange={e => setHp(e.target.value)}
          className="text-base"
        />
        <Input
          placeholder="Sheet URL (optional)"
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="text-base col-span-2"
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleAdd} disabled={!name.trim()} size="sm" className="flex-1">
          <Plus className="h-4 w-4 mr-1" /> Add to Initiative
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Combatant Row
// ─────────────────────────────────────────────────────────────────────────────
function CombatantRow({
  combatant, isActive, isFirst, isLast, turnCount,
  onMove, onRemove, onInitiativeChange, onHpChange, onToggleCondition,
}: {
  combatant: Combatant;
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  turnCount: number;
  onMove: (id: string, dir: 'up' | 'down') => void;
  onRemove: (id: string) => void;
  onInitiativeChange: (id: string, val: number | '') => void;
  onHpChange: (id: string, val: number) => void;
  onToggleCondition: (id: string, condition: Condition) => void;
}) {
  const [showConditions, setShowConditions] = React.useState(false);
  const isMonster = combatant.type === 'monster';
  const isDead = isMonster && combatant.currentHp !== undefined && combatant.currentHp <= 0;

  return (
    <div className={cn(
      'border transition-all',
      isActive
        ? 'border-border/[0.09] bg-[hsl(var(--oxblood)/0.14)] shadow-[inset_3px_0_0_hsl(var(--oxblood))]'
        : isDead
          ? 'border-border/[0.05] bg-[hsl(var(--oxblood)/0.06)] opacity-60'
          : isMonster
            ? 'border-red-500/20 bg-red-500/4'
            : 'border-primary/15 bg-primary/3',
    )}>
      <div className="flex items-center gap-3 px-4 py-3">

        {/* Active indicator */}
        <div className={cn(
          'w-2 h-2 rounded-full flex-shrink-0',
          isActive ? 'bg-accent animate-forge-pulse' : 'bg-transparent'
        )} />

        {/* Order buttons */}
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button type="button" onClick={() => onMove(combatant.id, 'up')} disabled={isFirst}
            aria-label={`Move ${combatant.name} earlier in the initiative order`}
            className="h-4 w-4 flex items-center justify-center text-muted-foreground/40 hover:text-foreground/80 disabled:opacity-20 transition-colors">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onMove(combatant.id, 'down')} disabled={isLast}
            aria-label={`Move ${combatant.name} later in the initiative order`}
            className="h-4 w-4 flex items-center justify-center text-muted-foreground/40 hover:text-foreground/80 disabled:opacity-20 transition-colors">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Initiative */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input
            type="number"
            aria-label={`Initiative for ${combatant.name}`}
            value={combatant.initiative}
            onChange={e => onInitiativeChange(combatant.id, e.target.value ? parseInt(e.target.value, 10) : '')}
            className="w-12 text-center text-base font-headline bg-background/50 border border-white/10 rounded px-1 py-0.5 outline-none focus:border-primary/50"
          />
          <button
            type="button"
            onClick={() => onInitiativeChange(combatant.id, rollD20())}
            title="Roll d20"
            aria-label={`Roll d20 initiative for ${combatant.name}`}
            className="text-muted-foreground/40 hover:text-primary transition-colors"
          >
            <Dice6 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Name + type icon */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isMonster
            ? <Swords className="h-3.5 w-3.5 text-red-400/70 flex-shrink-0" />
            : <Shield className="h-3.5 w-3.5 text-primary/70 flex-shrink-0" />}
          <span className={cn(
            'font-headline text-sm truncate',
            isActive ? 'text-accent' : isDead ? 'text-muted-foreground line-through' : 'text-foreground/90'
          )}>
            {combatant.name}
          </span>
          {isActive && (
            <span className="text-[10px] font-headline tracking-widest text-accent/60 flex-shrink-0">
              TURN {turnCount}
            </span>
          )}
        </div>

        {/* Conditions */}
        <div className="flex flex-wrap gap-1 max-w-[180px]">
          {combatant.conditions.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onToggleCondition(combatant.id, c)}
              title={`Remove ${c}`}
              aria-label={`Remove condition ${c} from ${combatant.name}`}
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded border font-headline tracking-wide transition-colors',
                CONDITION_COLORS[c]
              )}
            >
              {c}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowConditions(o => !o)}
            aria-expanded={showConditions}
            aria-label={`Add a condition to ${combatant.name}`}
            className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-muted-foreground/50 hover:border-white/20 hover:text-muted-foreground transition-colors font-headline"
          >
            +
          </button>
        </div>

        {/* HP (monsters only) */}
        {isMonster && combatant.maxHp !== undefined && combatant.currentHp !== undefined && (
          <HpControl
            currentHp={combatant.currentHp}
            maxHp={combatant.maxHp}
            onChange={val => onHpChange(combatant.id, val)}
          />
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isMonster && combatant.url && (
            <a
              href={combatant.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open stat block"
              aria-label={`Open stat block for ${combatant.name} in a new tab`}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/8 text-muted-foreground/50 hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => onRemove(combatant.id)}
            aria-label={`Remove ${combatant.name} from combat`}
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-red-500/15 text-muted-foreground/40 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Condition picker */}
      {showConditions && (
        <div className="px-4 pb-3 pt-1 border-t border-white/5">
          <div className="flex flex-wrap gap-1.5">
            {ALL_CONDITIONS.filter(c => !combatant.conditions.includes(c)).map(c => (
              <button
                key={c}
                type="button"
                aria-label={`Apply condition ${c} to ${combatant.name}`}
                onClick={() => { onToggleCondition(combatant.id, c); setShowConditions(false); }}
                className={cn(
                  'text-[10px] px-2 py-1 rounded border font-headline tracking-wide transition-colors opacity-60 hover:opacity-100',
                  CONDITION_COLORS[c]
                )}
              >
                {c}
              </button>
            ))}
            {combatant.conditions.length === ALL_CONDITIONS.length && (
              <span className="text-xs text-muted-foreground italic">All conditions active</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
interface CombatTrackerProps {
  campaignId: string;
}

export function CombatTracker({ campaignId }: CombatTrackerProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  const charactersRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'characters');
  }, [user, campaignId, firestore]);
  const { data: characters } = useCollection<Character>(charactersRef);

  // Combat state is persisted per-campaign so it survives tab switches and reloads.
  const combatStateDocRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return doc(firestore, 'users', user.uid, 'campaigns', campaignId, 'combatState', 'current');
  }, [user, campaignId, firestore]);
  const { data: combatState, isLoading: combatStateLoading } = useDoc<CombatState>(combatStateDocRef);

  const [combatants, setCombatants] = React.useState<Combatant[]>([]);
  // The turn is tracked by combatant id, not by position: initiative edits and
  // removals reorder `sorted`, and a positional index would silently point at
  // a different creature.
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [round, setRound] = React.useState(1);
  const [turnCount, setTurnCount] = React.useState(1);
  const [started, setStarted] = React.useState(false);

  // Monotonic tiebreak counter, seeded past whatever the persisted encounter used.
  const seqRef = React.useRef(0);
  const nextSeq = React.useCallback(() => ++seqRef.current, []);

  // Hydrate local state from the persisted doc exactly once per mount, so we
  // don't clobber in-progress local edits every time our own writes echo back.
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    if (hydrated || combatStateLoading) return;
    if (combatState) {
      // Encounters saved before `seq` existed get one assigned from their
      // stored order, so their initiative order stays exactly as it was.
      const loaded = (combatState.combatants ?? []).map((c, i) => ({
        ...c,
        seq: c.seq ?? i + 1,
      }));
      seqRef.current = loaded.reduce((max, c) => Math.max(max, c.seq), 0);

      setCombatants(loaded);
      setRound(combatState.round ?? 1);
      setTurnCount(combatState.turnCount ?? 1);
      setStarted(combatState.started ?? false);

      // Prefer the id; fall back to the legacy positional index for encounters
      // saved before activeId existed.
      const legacyActive = sortedCombatants(loaded)[combatState.activeIndex ?? 0]?.id ?? null;
      setActiveId(combatState.activeId ?? legacyActive);
    }
    setHydrated(true);
  }, [combatState, combatStateLoading, hydrated]);

  // Persist every change back to Firestore once hydrated.
  React.useEffect(() => {
    if (!hydrated || !combatStateDocRef) return;
    setDocumentNonBlocking(combatStateDocRef, {
      campaignId,
      combatants,
      activeId,
      round,
      turnCount,
      started,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [hydrated, combatants, activeId, round, turnCount, started, combatStateDocRef, campaignId]);

  const sorted = sortedCombatants(combatants);

  // Add party member
  const addPartyMember = (char: Character) => {
    if (combatants.find(c => c.name === char.name)) return;
    setCombatants(prev => [...prev, {
      id: uid(),
      name: char.name,
      initiative: '',
      type: 'player',
      seq: nextSeq(),
      conditions: [],
    }]);
  };

  // Add monster
  const addMonster = (combatant: Omit<Combatant, 'seq'>) => {
    setCombatants(prev => [...prev, { ...combatant, seq: nextSeq() }]);
  };

  // Move up/down in sorted order. Swaps the whole sort key (initiative *and*
  // tiebreak) so the arrows still work when two combatants rolled the same.
  const handleMove = (id: string, dir: 'up' | 'down') => {
    const idx = sorted.findIndex(c => c.id === id);
    if (idx < 0) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapIdx];

    setCombatants(prev => prev.map(c => {
      if (c.id === a.id) return { ...c, initiative: b.initiative, seq: b.seq };
      if (c.id === b.id) return { ...c, initiative: a.initiative, seq: a.seq };
      return c;
    }));
  };

  const handleRemove = (id: string) => {
    const remaining = sorted.filter(c => c.id !== id);

    // If the creature whose turn it is leaves the fight, hand the turn to
    // whoever would have gone next rather than letting it fall on a neighbour.
    if (id === activeId) {
      const idx = sorted.findIndex(c => c.id === id);
      setActiveId(remaining.length > 0 ? remaining[idx % remaining.length].id : null);
    }

    // Removing the last combatant ends the encounter; leaving `started` true
    // with nobody in the order leaves the turn controls in a dead state.
    if (remaining.length === 0) {
      setStarted(false);
      setRound(1);
      setTurnCount(1);
      setActiveId(null);
    }

    setCombatants(prev => prev.filter(c => c.id !== id));
  };

  const handleInitiativeChange = (id: string, val: number | '') => {
    setCombatants(prev => prev.map(c => c.id === id ? { ...c, initiative: val } : c));
  };

  const handleHpChange = (id: string, val: number) => {
    setCombatants(prev => prev.map(c => c.id === id ? { ...c, currentHp: val } : c));
  };

  const handleToggleCondition = (id: string, condition: Condition) => {
    setCombatants(prev => prev.map(c => {
      if (c.id !== id) return c;
      const has = c.conditions.includes(condition);
      return {
        ...c,
        conditions: has
          ? c.conditions.filter(x => x !== condition)
          : [...c.conditions, condition],
      };
    }));
  };

  const handleNextTurn = () => {
    if (sorted.length === 0) return;

    const currentIdx = sorted.findIndex(c => c.id === activeId);
    // If the active combatant is gone, resume from the top of the order.
    const next = currentIdx < 0 ? 0 : (currentIdx + 1) % sorted.length;

    if (next === 0) setRound(r => r + 1);
    setActiveId(sorted[next].id);
    setTurnCount(t => t + 1);
  };

  const handleStart = () => {
    if (sorted.length === 0) return;
    setActiveId(sorted[0].id);
    setRound(1);
    setTurnCount(1);
    setStarted(true);
  };

  // Writes the cleared encounter through the normal persist effect. Deleting
  // the doc here would race that effect, which re-creates it a tick later.
  const handleClear = () => {
    setCombatants([]);
    setActiveId(null);
    setRound(1);
    setTurnCount(1);
    setStarted(false);
  };

  const activeCombatant = started ? sorted.find(c => c.id === activeId) ?? null : null;
  const hasAnyone = combatants.length > 0;
  const allHaveInitiative = combatants.every(c => c.initiative !== '');

  // Avoid flashing the empty state while the persisted encounter is still loading.
  if (!hydrated && combatStateLoading) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center text-muted-foreground text-sm">
        Loading combat…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-headline text-2xl font-bold">Combat Tracker</h2>
          {started && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Round <span className="text-accent font-headline">{round}</span>
              {activeCombatant && (
                <> · <span className="text-foreground/80">{activeCombatant.name}'s turn</span></>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {hasAnyone && !started && (
            <Button onClick={handleStart} disabled={!allHaveInitiative} className="font-headline tracking-wide">
              <Swords className="h-4 w-4 mr-2" />
              Start Combat
            </Button>
          )}
          {started && (
            <Button onClick={handleNextTurn} className="font-headline tracking-wide">
              <SkipForward className="h-4 w-4 mr-2" />
              Next Turn
            </Button>
          )}
          {hasAnyone && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  End Combat
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End this encounter?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This clears the initiative order, HP, and conditions for all{' '}
                    {combatants.length} combatant{combatants.length === 1 ? '' : 's'}. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClear}
                    className="bg-destructive text-destructive-foreground"
                  >
                    End Combat
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Party quick-add */}
      {characters && characters.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-primary/15 bg-primary/3">
          <span className="label-forge self-center mr-1">Party:</span>
          {characters.map(char => {
            const added = combatants.some(c => c.name === char.name);
            return (
              <button
                key={char.id}
                type="button"
                onClick={() => addPartyMember(char)}
                disabled={added}
                aria-label={added ? `${char.name} is already in combat` : `Add ${char.name} to combat`}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full border font-headline tracking-wide transition-all',
                  added
                    ? 'border-primary/30 bg-primary/10 text-primary/60 cursor-default'
                    : 'border-primary/20 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-primary/8'
                )}
              >
                {added ? '✓ ' : '+ '}{char.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Initiative order */}
      {sorted.length > 0 && (
        <div className="space-y-2">
          {!started && !allHaveInitiative && (
            <p className="text-xs text-muted-foreground italic px-1">
              Set initiative for all combatants before starting — click the dice to roll.
            </p>
          )}
          {sorted.map((c, i) => (
            <CombatantRow
              key={c.id}
              combatant={c}
              isActive={started && activeId === c.id}
              isFirst={i === 0}
              isLast={i === sorted.length - 1}
              turnCount={turnCount}
              onMove={handleMove}
              onRemove={handleRemove}
              onInitiativeChange={handleInitiativeChange}
              onHpChange={handleHpChange}
              onToggleCondition={handleToggleCondition}
            />
          ))}
        </div>
      )}

      {/* Add monster form */}
      <AddMonsterForm onAdd={addMonster} />

      {/* Empty state */}
      {!hasAnyone && (
        <div className="text-center py-12 text-muted-foreground space-y-2">
          <Swords className="h-10 w-10 mx-auto opacity-20" />
          <p className="font-headline text-sm tracking-wide">No combatants yet</p>
          <p className="text-xs">Add party members from the quick-add bar above, then add your monsters.</p>
        </div>
      )}
    </div>
  );
}
