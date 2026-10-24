'use client';

import * as React from 'react';
import type { Character, Combatant, Condition } from '@/lib/types';
import type { CombatApi } from '@/components/table/use-combat';
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
 * Three families instead of sixteen hues: quiet (concentration and stealth),
 * sand (impairment), and spot (hard control). Spot is the design's one loud
 * colour, so only the conditions that take a creature out of the fight get it.
 */
const CONDITION_COLORS: Record<Condition, string> = (() => {
  const cold = 'bg-[hsl(var(--border)/0.09)] text-mute border-[hsl(var(--border)/0.18)]';
  const warm = 'bg-[hsl(var(--sand)/0.15)] text-sand border-[hsl(var(--sand)/0.35)]';
  const hard = 'bg-[hsl(var(--spot)/0.25)] text-spot border-[hsl(var(--spot)/0.5)]';
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
  const barColor = pct > 0.5 ? 'bg-mute' : pct > 0.25 ? 'bg-sand' : 'bg-spot';

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
        className="w-6 h-6 bg-[hsl(var(--spot)/0.2)] hover:bg-[hsl(var(--spot)/0.4)] text-spot flex items-center justify-center text-sm font-bold transition-colors flex-shrink-0"
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
        <div className="h-1.5 rounded-full bg-ink/10 overflow-hidden">
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
        className="w-6 h-6 rounded bg-[hsl(var(--border)/0.09)] hover:bg-[hsl(var(--border)/0.18)] text-ink flex items-center justify-center text-sm font-bold transition-colors flex-shrink-0"
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
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-spot/25 hover:border-spot/50 hover:bg-spot/5 transition-colors text-sm text-spot/70 hover:text-spot"
      >
        <Plus className="h-4 w-4" />
        Add Monster / NPC
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-spot/25 bg-spot/5 p-4 space-y-3">
      <p className="font-mono font-bold text-[11px] tracking-[0.16em] uppercase text-mute text-spot/70">Add Monster / NPC</p>
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
        ? 'border-border/[0.09] bg-[hsl(var(--spot)/0.14)]'
        : isDead
          ? 'border-border/[0.05] bg-[hsl(var(--spot)/0.06)] opacity-60'
          : isMonster
            ? 'border-spot/20 bg-spot/4'
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
            className="w-12 text-center text-base font-headline bg-background/50 border border-ink/10 rounded px-1 py-0.5 outline-none focus:border-primary/50"
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
            ? <Swords className="h-3.5 w-3.5 text-spot/70 flex-shrink-0" />
            : <Shield className="h-3.5 w-3.5 text-primary/70 flex-shrink-0" />}
          <span className={cn(
            'font-headline text-sm truncate',
            isActive ? 'text-accent' : isDead ? 'text-muted-foreground line-through' : 'text-foreground/90'
          )}>
            {combatant.name}
          </span>
          {isActive && (
            <span className="text-[11px] font-headline tracking-widest text-accent/60 flex-shrink-0">
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
                'text-[11px] px-1.5 py-0.5 rounded border font-headline tracking-wide transition-colors',
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
            className="text-[11px] px-1.5 py-0.5 rounded border border-ink/10 text-muted-foreground/50 hover:border-ink/20 hover:text-muted-foreground transition-colors font-headline"
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
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-ink/8 text-muted-foreground/50 hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => onRemove(combatant.id)}
            aria-label={`Remove ${combatant.name} from combat`}
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-spot/15 text-muted-foreground/40 hover:text-spot transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Condition picker */}
      {showConditions && (
        <div className="px-4 pb-3 pt-1 border-t border-ink/5">
          <div className="flex flex-wrap gap-1.5">
            {ALL_CONDITIONS.filter(c => !combatant.conditions.includes(c)).map(c => (
              <button
                key={c}
                type="button"
                aria-label={`Apply condition ${c} to ${combatant.name}`}
                onClick={() => { onToggleCondition(combatant.id, c); setShowConditions(false); }}
                className={cn(
                  'text-[11px] px-2 py-1 rounded border font-headline tracking-wide transition-colors opacity-60 hover:opacity-100',
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
// Main Component: the SET UP sheet's contents. State lives in useCombat (in
// the campaign provider), shared with the Table's turn strip.
// ─────────────────────────────────────────────────────────────────────────────
export function CombatTracker({ combat, characters }: { combat: CombatApi; characters: Character[] }) {
  const { sorted, combatants, started, round, active, turnCount, activeId } = combat;
  const hasAnyone = combatants.length > 0;
  const allHaveInitiative = combatants.every(c => c.initiative !== '');

  // Avoid flashing the empty state while the stored encounter is still loading.
  if (combat.isLoading) {
    return <p className="py-12 text-center italic text-mute">Loading combat…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-headline font-black text-[30px] leading-none">Combat</h2>
          {started && (
            <p className="font-mono font-bold text-[12px] tracking-[0.14em] mt-1">
              ROUND {round}{active && <> · {active.name.toUpperCase()}&apos;S TURN</>}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {hasAnyone && !started && (
            <Button onClick={combat.start} disabled={!allHaveInitiative}>
              <Swords className="h-4 w-4" /> Start combat
            </Button>
          )}
          {started && (
            <Button onClick={combat.nextTurn}>
              <SkipForward className="h-4 w-4" /> Next turn
            </Button>
          )}
          {hasAnyone && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <RotateCcw className="h-4 w-4" /> End combat
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
                  <AlertDialogAction onClick={combat.clear}>End combat</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {characters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 border-[1.5px] border-line2">
          <span className="font-mono font-bold text-[11px] tracking-[0.16em] uppercase text-mute mr-1">Party</span>
          {characters.map(char => {
            const added = combatants.some(c => c.name === char.name);
            return (
              <button
                key={char.id}
                type="button"
                onClick={() => combat.addPartyMember(char)}
                disabled={added}
                aria-label={added ? `${char.name} is already in combat` : `Add ${char.name} to combat`}
                className={cn(
                  'px-2.5 py-1 border-[1.5px] font-headline font-extrabold text-[15px]',
                  added ? 'border-ink bg-ink text-bg cursor-default' : 'border-line2 hover:border-ink',
                )}
              >
                {added ? '✓ ' : '+ '}{char.name}
              </button>
            );
          })}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="space-y-2">
          {!started && !allHaveInitiative && (
            <p className="text-[15px] italic text-mute px-1">
              Set initiative for everyone before starting: click the die to roll.
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
              onMove={combat.move}
              onRemove={combat.remove}
              onInitiativeChange={combat.setInitiative}
              onHpChange={combat.setHp}
              onToggleCondition={combat.toggleCondition}
            />
          ))}
        </div>
      )}

      <AddMonsterForm onAdd={combat.addMonster} />

      {!hasAnyone && (
        <p className="text-center py-10 italic text-mute">
          No combatants yet. Add the party above, then the monsters.
        </p>
      )}
    </div>
  );
}
