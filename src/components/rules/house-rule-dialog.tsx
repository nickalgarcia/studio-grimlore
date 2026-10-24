'use client';

import * as React from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useRuleWriter, type HouseRuleInput } from '@/firebase';
import { cn } from '@/lib/utils';
import type { Rule, RuleCategory } from '@/lib/types';

const CATEGORIES: RuleCategory[] = ['combat', 'magic', 'exploration', 'table'];

type Form = { title: string; category: RuleCategory; text: string; replaces: string; why: string; sinceSession: string };

const empty: Form = { title: '', category: 'combat', text: '', replaces: '', why: '', sinceSession: '' };

/**
 * Write or edit a house rule. A stand-in until the inline-editing design:
 * plain fields, every one the Rulebook card shows.
 */
export function HouseRuleDialog({
  open, onOpenChange, rule, defaultSince,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Editing this rule, or creating when absent. */
  rule?: Rule | null;
  defaultSince?: number;
}) {
  const { createHouseRule, updateHouseRule, deleteHouseRule } = useRuleWriter();
  const [form, setForm] = React.useState<Form>(empty);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm(rule ? {
      title: rule.title, category: rule.category, text: rule.text,
      replaces: rule.replaces ?? '', why: rule.why ?? '', sinceSession: rule.sinceSession ? String(rule.sinceSession) : '',
    } : { ...empty, sinceSession: defaultSince ? String(defaultSince) : '' });
    // Reset only when the dialog opens or switches rule: a live snapshot of the
    // rules list hands back new objects, and resetting on those would wipe
    // whatever the DM is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rule?.id]);

  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.title.trim() && form.text.trim();

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const since = parseInt(form.sinceSession, 10);
    const input: HouseRuleInput = {
      title: form.title.trim(),
      category: form.category,
      text: form.text.trim(),
      replaces: form.replaces.trim() || undefined,
      why: form.why.trim() || undefined,
      sinceSession: Number.isFinite(since) ? since : undefined,
    };
    try {
      if (rule) await updateHouseRule(rule.id, input);
      else await createHouseRule(input);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!rule) return;
    await deleteHouseRule(rule.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit house rule' : 'New house rule'}</DialogTitle>
          <DialogDescription>Say what it replaced, and why, so nobody argues at the table.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="hr-title">Title</Label>
            <Input id="hr-title" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <div className="flex flex-wrap border-[1.5px] border-ink w-max" role="radiogroup" aria-label="Category">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={form.category === c}
                  onClick={() => set('category', c)}
                  className={cn('px-3 h-9 font-mono font-bold text-[12px] tracking-[0.14em] uppercase', form.category === c && 'bg-ink text-bg')}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hr-text">The rule</Label>
            <Textarea id="hr-text" rows={4} value={form.text} onChange={e => set('text', e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="hr-replaces">Replaces</Label>
              <Textarea id="hr-replaces" rows={3} value={form.replaces} onChange={e => set('replaces', e.target.value)} placeholder="The rule as written" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="hr-why">Why</Label>
              <Textarea id="hr-why" rows={3} value={form.why} onChange={e => set('why', e.target.value)} placeholder="What it fixes at your table" />
            </div>
          </div>
          <div className="grid gap-1.5 max-w-[180px]">
            <Label htmlFor="hr-since">Since issue #</Label>
            <Input id="hr-since" type="number" min={1} value={form.sinceSession} onChange={e => set('sinceSession', e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {rule && <Button variant="ghost" onClick={remove} className="mr-auto">Delete</Button>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!valid || saving}>Save rule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
