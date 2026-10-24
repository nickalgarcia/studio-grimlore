'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { HouseRuleDialog } from '@/components/rules/house-rule-dialog';
import { MonoLabel, SectionHeader } from '@/components/shared/section-header';
import { useRuleWriter } from '@/firebase';
import { CONDITION_EFFECTS, CONDITIONS, conditionAnchor } from '@/lib/conditions';
import { ruleAnchor, SRD_CREDIT } from '@/lib/core-rules';
import { GLYPH } from '@/lib/pages';
import { cn } from '@/lib/utils';
import type { Rule, RuleCategory } from '@/lib/types';

const FILTERS = ['all', 'house', '5e', 'tonight', 'pinned'] as const;
type Filter = (typeof FILTERS)[number];
const CATEGORY_ORDER: RuleCategory[] = ['combat', 'magic', 'exploration', 'table'];

const keep: Record<Filter, (r: Rule) => boolean> = {
  all: () => true,
  house: r => r.kind === 'house',
  '5e': r => r.kind === 'core',
  tonight: r => !!r.tonight,
  pinned: r => r.pinned,
};

export default function RulesPage() {
  return (
    <React.Suspense fallback={null}>
      <Rulebook />
    </React.Suspense>
  );
}

/** Scroll to an anchor below the sticky header (cards carry scroll-margin-top). */
function scrollToAnchor(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  return true;
}

function RuleCard({
  rule, focused, onEdit,
}: {
  rule: Rule;
  focused: boolean;
  onEdit?: () => void;
}) {
  const { setFlags } = useRuleWriter();
  const house = rule.kind === 'house';
  return (
    <article
      id={ruleAnchor(rule.id)}
      className={cn(
        'scroll-mt-[90px] border-[1.5px] border-ink',
        focused && 'outline outline-[3px] outline-spot outline-offset-4',
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-[1.5px] border-ink pl-0 pr-2 font-mono font-bold text-[11px] tracking-[0.14em] uppercase">
        <span className={cn('px-2.5 py-1.5', house ? 'bg-spot text-spot-on' : 'bg-ink text-bg')}>
          {house ? 'House rule' : '5E core'}
        </span>
        <span className="text-mute">{house ? (rule.sinceSession ? `Since issue #${rule.sinceSession}` : 'House') : rule.ref}</span>
        {rule.tonight && <span className="text-spot">● In play tonight</span>}
        <span className="flex-1" />
        {onEdit && (
          <button type="button" onClick={onEdit} className="h-[26px] px-2 hover:text-spot">EDIT</button>
        )}
        <button
          type="button"
          aria-pressed={!!rule.tonight}
          onClick={() => setFlags(rule, { tonight: !rule.tonight })}
          className={cn('h-[26px] px-2 border-[1.5px] border-line2', rule.tonight && 'border-spot text-spot')}
        >
          {rule.tonight ? '● Tonight' : '○ Tonight'}
        </button>
        <button
          type="button"
          aria-pressed={rule.pinned}
          onClick={() => setFlags(rule, { pinned: !rule.pinned })}
          className={cn('h-[26px] px-2 border-[1.5px] border-ink', rule.pinned && 'bg-ink text-bg')}
        >
          {rule.pinned ? '◆ Pinned to table' : '◇ Pin to table'}
        </button>
      </header>
      <div className="px-[18px] pt-4 pb-[18px] flex flex-col gap-3">
        <h3 className="font-headline font-black text-[32px] leading-[0.9]">{rule.title}</h3>
        <p className="text-[20px] leading-[1.5]">{rule.text}</p>
        {house && (rule.replaces || rule.why) && (
          <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-line">
            {rule.replaces && (
              <div className="flex flex-col gap-1">
                <MonoLabel className="text-mute">Replaces</MonoLabel>
                <p className="text-[17px] text-mute line-through decoration-1">{rule.replaces}</p>
              </div>
            )}
            {rule.why && (
              <div className="flex flex-col gap-1">
                <MonoLabel className="text-mute">Why</MonoLabel>
                <p className="text-[17px] italic">{rule.why}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function Rulebook() {
  const router = useRouter();
  const params = useSearchParams();
  const { rules, latestIssue } = useCampaign();
  const filter: Filter = (FILTERS as readonly string[]).includes(params.get('filter') ?? '')
    ? (params.get('filter') as Filter)
    : 'all';

  const [focused, setFocused] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<{ rule: Rule | null } | null>(null);

  const visible = rules.filter(keep[filter]);
  const house = rules.filter(r => r.kind === 'house').length;
  const core = rules.length - house;
  const showConditions = filter === 'all' || filter === '5e';

  // Arriving at /rules#rule-x or #cond-x (search, At hand): scroll there and
  // outline it. Waits for the rules to load, since house rules come from Firestore.
  React.useEffect(() => {
    const go = () => {
      const id = window.location.hash.slice(1);
      if (!id) return;
      if (scrollToAnchor(id)) setFocused(id);
    };
    go();
    window.addEventListener('hashchange', go);
    return () => window.removeEventListener('hashchange', go);
  }, [rules.length]);

  const jump = (id: string) => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`);
    scrollToAnchor(id);
    setFocused(id);
  };

  const setFilter = (f: Filter) => router.replace(f === 'all' ? '/rules' : `/rules?filter=${f}`, { scroll: false });

  const groups = CATEGORY_ORDER
    .map(cat => ({ cat, items: visible.filter(r => r.category === cat) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="max-w-[1240px] mx-auto w-full px-[clamp(20px,3vw,48px)] pt-9 pb-24 flex flex-col gap-11">
      <header className="flex flex-col gap-4">
        <MonoLabel className="text-mute">
          {GLYPH.rule} Rules · {house} house · {core} core · {CONDITIONS.length} conditions
        </MonoLabel>
        <h1 className="font-headline font-black leading-[0.84] text-[clamp(56px,7.6vw,124px)]">
          The <span className="text-spot">Rulebook</span>
        </h1>
        <p className="italic text-[21px] leading-[1.42] max-w-[46ch]">
          Your house rules on top of the 5e core. Every change says what it replaced, and why — so nobody argues at the table.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div role="tablist" aria-label="Filter rules" className="flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={f === filter}
                onClick={() => setFilter(f)}
                className={cn('h-9 px-3.5 border-[1.5px] border-ink font-mono font-bold text-[12px] tracking-[0.14em] uppercase', f === filter && 'bg-ink text-bg')}
              >
                {f}
              </button>
            ))}
          </div>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setEditing({ rule: null })}
            className="h-9 px-3.5 bg-spot text-spot-on font-headline font-black text-[17px] uppercase"
          >
            + House rule
          </button>
        </div>
      </header>

      <div className="grid gap-11 md:grid-cols-[minmax(180px,230px)_minmax(0,1fr)]">
        <nav aria-label="Rule index" className="hidden md:block self-start sticky top-[90px]">
          <ol className="flex flex-col">
            {visible.map(r => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => jump(ruleAnchor(r.id))}
                  className="w-full grid grid-cols-[28px_minmax(0,1fr)] items-baseline gap-1 py-1.5 border-b border-line text-left hover:text-spot"
                >
                  <span className={cn('font-mono font-bold text-[11px]', r.kind === 'house' ? 'text-spot' : 'text-mute')}>
                    {r.kind === 'house' ? 'H' : '5E'}
                  </span>
                  <span className="text-[16px] truncate">{r.title}</span>
                </button>
              </li>
            ))}
            {showConditions && (
              <li>
                <button type="button" onClick={() => jump('conditions')} className="w-full py-1.5 text-left text-[16px] hover:text-spot">
                  {GLYPH.note} Conditions
                </button>
              </li>
            )}
          </ol>
        </nav>

        <div className="flex flex-col gap-11 min-w-0">
          {groups.length === 0 && (
            <p className="border-[3px] border-dashed border-line2 p-6 italic text-[18px] text-mute">
              {filter === 'pinned'
                ? 'Nothing pinned yet. Pin a rule and it rides along on the Table screen.'
                : filter === 'tonight'
                  ? 'Nothing flagged for tonight. Mark a rule ○ TONIGHT when the scene calls for it.'
                  : filter === 'house'
                    ? 'No house rules yet. Add the first with + HOUSE RULE.'
                    : 'No rules match.'}
            </p>
          )}

          {groups.map(g => (
            <section key={g.cat} className="flex flex-col gap-3">
              <SectionHeader label={g.cat} meta={g.items.length} />
              <div className="flex flex-col gap-3">
                {g.items.map(r => (
                  <RuleCard
                    key={r.id}
                    rule={r}
                    focused={focused === ruleAnchor(r.id)}
                    onEdit={r.kind === 'house' ? () => setEditing({ rule: r }) : undefined}
                  />
                ))}
              </div>
            </section>
          ))}

          {showConditions && (
            <section id="conditions" className="scroll-mt-[90px] flex flex-col gap-3">
              <SectionHeader glyph={GLYPH.note} label="Conditions · quick reference" meta={CONDITIONS.length} />
              {/* Shared 1.5px borders: each cell draws right and bottom, the grid draws top and left. */}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] border-t-[1.5px] border-l-[1.5px] border-ink">
                {CONDITIONS.map(c => {
                  const id = conditionAnchor(c);
                  const on = focused === id;
                  return (
                    <div
                      key={c}
                      id={id}
                      className={cn('scroll-mt-[90px] border-r-[1.5px] border-b-[1.5px] border-ink p-3.5 flex flex-col gap-1', on && 'bg-spot text-spot-on')}
                    >
                      <h3 className="font-headline font-black text-[22px] leading-none">{c}</h3>
                      <p className="text-[16px] leading-[1.4]">{CONDITION_EFFECTS[c]}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <p className="font-mono text-[11px] tracking-[0.08em] text-mute">{SRD_CREDIT}</p>
        </div>
      </div>

      <HouseRuleDialog
        open={!!editing}
        onOpenChange={o => { if (!o) setEditing(null); }}
        rule={editing?.rule}
        defaultSince={latestIssue ? latestIssue.sessionNumber + 1 : undefined}
      />
    </div>
  );
}
