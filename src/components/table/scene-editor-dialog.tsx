'use client';

import * as React from 'react';
import { deleteField } from 'firebase/firestore';
import { useCampaign } from '@/components/campaign/campaign-provider';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useSceneWriter } from '@/firebase';
import { cn } from '@/lib/utils';
import type { Scene } from '@/lib/types';

const TEXT_FIELDS = ['name', 'location', 'timeOfDay', 'constraint', 'pressure', 'wayOut', 'secret'] as const;
type Field = (typeof TEXT_FIELDS)[number];
type Form = Record<Field, string> & { onStage: string[] };

/**
 * Write the current scene, or start the next one. A stand-in until the
 * inline-editing design: v3 never had a way to fill these fields in.
 */
export function SceneEditorDialog({
  open, onOpenChange, mode,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: 'edit' | 'new';
}) {
  const { activeCampaign, scene, codex, nextIssueNumber } = useCampaign();
  const { createScene, updateScene } = useSceneWriter(activeCampaign?.id);
  const [form, setForm] = React.useState<Form>(() => blank());

  function blank(): Form {
    return { name: '', location: '', timeOfDay: '', constraint: '', pressure: '', wayOut: '', secret: '', onStage: [] };
  }

  // Filled once per open, so a live update to the scene can't wipe the form.
  React.useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && scene) {
      setForm({
        name: scene.name ?? '', location: scene.location ?? '', timeOfDay: scene.timeOfDay ?? '',
        constraint: scene.constraint ?? '', pressure: scene.pressure ?? '', wayOut: scene.wayOut ?? '',
        secret: scene.secret ?? '', onStage: scene.onStageNpcIds ?? [],
      });
    } else {
      setForm(blank());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const set = (k: Field, v: string) => setForm(f => ({ ...f, [k]: v }));
  const toggle = (id: string) => setForm(f => ({
    ...f, onStage: f.onStage.includes(id) ? f.onStage.filter(x => x !== id) : [...f.onStage, id],
  }));

  const save = async () => {
    if (!form.name.trim()) return;
    if (mode === 'edit' && scene) {
      // An emptied field is removed, not stored as ''.
      const patch: Record<string, unknown> = { onStageNpcIds: form.onStage };
      for (const k of TEXT_FIELDS) patch[k] = form[k].trim() || (k === 'name' ? scene.name : deleteField());
      await updateScene(scene.id, patch as Partial<Scene>);
    } else {
      const text = Object.fromEntries(TEXT_FIELDS.map(k => [k, form[k].trim() || undefined]));
      await createScene({
        ...(text as Pick<Scene, Field>),
        name: form.name.trim(),
        onStageNpcIds: form.onStage,
        sessionNumber: nextIssueNumber,
        sceneNumber: (scene?.sessionNumber === nextIssueNumber ? scene.sceneNumber ?? 0 : 0) + 1,
      });
    }
    onOpenChange(false);
  };

  const area = (k: Field, label: string, hint?: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`sc-${k}`}>{label}</Label>
      <Textarea id={`sc-${k}`} rows={2} value={form[k]} onChange={e => set(k, e.target.value)} placeholder={hint} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit scene' : 'New scene'}</DialogTitle>
          <DialogDescription>
            {mode === 'new' ? 'It becomes the current scene on the Table.' : 'The secret stays blurred on screen until you tap it.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="sc-name">Scene</Label>
            <Input id="sc-name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="The Gilded Hall" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="sc-location">Where</Label>
              <Input id="sc-location" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Upper Ward" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sc-time">When</Label>
              <Input id="sc-time" value={form.timeOfDay} onChange={e => set('timeOfDay', e.target.value)} placeholder="Night" />
            </div>
          </div>
          {area('constraint', 'Constraint', 'The rule bending play: the party is unarmed by decree')}
          {area('pressure', 'Pressure', 'What pushes them to act now')}
          {area('wayOut', 'Way out', 'How it can end')}
          {area('secret', 'Secret (DM only)', 'What they don’t know yet')}
          {(codex.raw.npcs ?? []).length > 0 && (
            <div className="grid gap-1.5">
              <Label>On stage</Label>
              <div className="flex flex-wrap gap-1.5">
                {(codex.raw.npcs ?? []).map(n => {
                  const on = form.onStage.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(n.id)}
                      className={cn('px-2.5 py-1 border-[1.5px] text-[15px]', on ? 'border-ink bg-ink text-bg' : 'border-line2 hover:border-ink')}
                    >
                      {n.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!form.name.trim()}>{mode === 'edit' ? 'Save scene' : 'Start scene'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
