'use client';

import * as React from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Character } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Swords, Plus, Trash2, ChevronUp, ChevronDown,
  SkipForward, RotateCcw, Dice6, ExternalLink, Users, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CombatantType = 'player' | 'monster';

interface Combatant {
  id: string;
  name: string;
  initiative: number | '';
  type: CombatantType;
  // Monsters only
  maxHp?: number;
  currentHp?: number;
  url?: string;
  // Shared
  conditions: Condition[];
}

type Condition =
  | 'Blinded' | 'Charmed' | 'Deafened' | 'Exhausted'
  | 'Frightened' | 'Grappled' | 'Incapacitated' | 'Invisible'
  | 'Paralyzed' | 'Petrified' | 'Poisoned' | 'Prone'
  | 'Restrained' | 'Stunned' | 'Unconscious' | 'Concentrating';

const ALL_CONDITIONS: Condition[] = [
  'Blinded', 'Charmed', 'Concentrating', 'Exhausted', 'Frightened',
  'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
  'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
];

const CONDITION_COLORS: Record<Condition, string> = {
  Blinded: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  Charmed: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  Concentrating: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Deafened: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  Exhausted: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Frightened: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Grappled: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Incapacitated: 'bg-red-500/20 text-red-400 border-red-500/30',
  Invisible: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  Paralyzed: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Petrified: 'bg-stone-500/20 text-stone-400 border-stone-500/30',
  Poisoned: 'bg-green-500/20 text-green-400 border-green-500/30',
  Prone: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Restrained: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Stunned: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  Unconscious: 'bg-red-800/20 text-red-300 border-red-800/30',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function sortedCombatants(list: Combatant[]): Combatant[] {
  return [...list].sort((a, b) => {
    const ia = a.initiative === '' ? -1 : a.initiative;
    const ib = b.initiative === '' ? -1 : b.initiative;
    return (ib as number) - (ia as number);
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
  const barColor = pct > 0.5 ? 'bg-green-500' : pct > 0.25 ? 'bg-yellow-500' : 'bg-red-500';

  const commit = () => {
    const val = parseInt(draft, 10);
    if (!isNaN(val)) onChange(Math.max(0, Math.min(maxHp, val)));
    else setDraft(String(currentHp));
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <button
        onClick={() => onChange(Math.max(0, currentHp - 1))}
        className="w-6 h-6 rounded bg-red-500/15 hover:bg-red-500/30 text-red-400 flex items-center justify-center text-sm font-bold transition-colors flex-shrink-0"
      >−</button>

      <div className="flex-1 space-y-1">
        {editing ? (
          <input
            type="number"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => e.key === 'Enter' && commit()}
            autoFocus
            className="w-full text-center text-sm bg-card border border-primary/30 rounded px-1 py-0.5 outline-none"
          />
        ) : (
          <button
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
        onClick={() => onChange(Math.min(maxHp, currentHp + 1))}
        className="w-6 h-6 rounded bg-green-500/15 hover:bg-green-500/30 text-green-400 flex items-center justify-center text-sm font-bold transition-colors flex-shrink-0"
      >+</button>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Add Monster Form
// ─────────────────────────────────────────────────────────────────────────────
function AddMonsterForm({ onAdd }: { onAdd: (c: Combatant) => void }) {
  const [name, setName] = React.useState('');
  const [initiative, setInitiative] = React.useState('');
  const [hp, setHp] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [open, setOpen] = React.useState(false);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({
      id: uid(),
      name: name.trim(),
      initiative: initiative ? parseInt(initiative, 10) : '',
      type: 'monster',
      maxHp: hp ? parseInt(hp, 10) : undefined,
      currentHp: hp ? parseInt(hp, 10) : undefined,
      url: url.trim() || undefined,
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
            type="number"
            value={initiative}
            onChange={e => setInitiative(e.target.value)}
            className="text-base pr-10"
          />
          <button
            onClick={() => setInitiative(String(rollD20()))}
            title="Roll d20"
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
      'rounded-xl border transition-all',
      isActive
        ? 'border-accent/60 bg-accent/8 shadow-[0_0_0_1px_hsl(var(--accent)/0.2)]'
        : isDead
          ? 'border-red-900/40 bg-red-950/20 opacity-60'
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
          <button onClick={() => onMove(combatant.id, 'up')} disabled={isFirst}
            className="h-4 w-4 flex items-center justify-center text-muted-foreground/40 hover:text-foreground/80 disabled:opacity-20 transition-colors">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onMove(combatant.id, 'down')} disabled={isLast}
            className="h-4 w-4 flex items-center justify-center text-muted-foreground/40 hover:text-foreground/80 disabled:opacity-20 transition-colors">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Initiative */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input
            type="number"
            value={combatant.initiative}
            onChange={e => onInitiativeChange(combatant.id, e.target.value ? parseInt(e.target.value, 10) : '')}
            className="w-12 text-center text-base font-headline bg-background/50 border border-white/10 rounded px-1 py-0.5 outline-none focus:border-primary/50"
          />
          <button
            onClick={() => onInitiativeChange(combatant.id, rollD20())}
            title="Roll d20"
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
              onClick={() => onToggleCondition(combatant.id, c)}
              title={`Remove ${c}`}
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded border font-headline tracking-wide transition-colors',
                CONDITION_COLORS[c]
              )}
            >
              {c}
            </button>
          ))}
          <button
            onClick={() => setShowConditions(o => !o)}
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
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/8 text-muted-foreground/50 hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            onClick={() => onRemove(combatant.id)}
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

  const [combatants, setCombatants] = React.useState<Combatant[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [round, setRound] = React.useState(1);
  const [turnCount, setTurnCount] = React.useState(1);
  const [started, setStarted] = React.useState(false);

  const sorted = sortedCombatants(combatants);

  // Add party member
  const addPartyMember = (char: Character) => {
    if (combatants.find(c => c.name === char.name)) return;
    setCombatants(prev => [...prev, {
      id: uid(),
      name: char.name,
      initiative: '',
      type: 'player',
      conditions: [],
    }]);
  };

  // Add monster
  const addMonster = (combatant: Combatant) => {
    setCombatants(prev => [...prev, combatant]);
  };

  // Move up/down in sorted order
  const handleMove = (id: string, dir: 'up' | 'down') => {
    const idx = sorted.findIndex(c => c.id === id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    // Swap initiative values to maintain sort order
    const aInit = sorted[idx].initiative;
    const bInit = sorted[swapIdx].initiative;

    setCombatants(prev => prev.map(c => {
      if (c.id === sorted[idx].id) return { ...c, initiative: bInit };
      if (c.id === sorted[swapIdx].id) return { ...c, initiative: aInit };
      return c;
    }));
  };

  const handleRemove = (id: string) => {
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
    const next = (activeIndex + 1) % sorted.length;
    if (next === 0) setRound(r => r + 1);
    setActiveIndex(next);
    setTurnCount(t => t + 1);
  };

  const handleStart = () => {
    setActiveIndex(0);
    setRound(1);
    setTurnCount(1);
    setStarted(true);
  };

  const handleClear = () => {
    setCombatants([]);
    setActiveIndex(0);
    setRound(1);
    setTurnCount(1);
    setStarted(false);
  };

  const activeCombatant = started ? sorted[activeIndex] : null;
  const hasAnyone = combatants.length > 0;
  const allHaveInitiative = combatants.every(c => c.initiative !== '');

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
            <Button variant="outline" onClick={handleClear} className="border-destructive/30 text-destructive hover:bg-destructive/10">
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear
            </Button>
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
                onClick={() => addPartyMember(char)}
                disabled={added}
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
              isActive={started && sorted[activeIndex]?.id === c.id}
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
