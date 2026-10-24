'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { getSessionPrep } from '@/app/actions';
import { useCampaign } from '@/components/campaign/campaign-provider';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { idTokenFor, usePrepWriter, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { recapOf } from '@/lib/issues';
import { GLYPH } from '@/lib/pages';
import type { PrepScene, SessionPrepState } from '@/lib/types';

/**
 * The co-pilot drafts the next issue's prep from the DM's goals. Prep is the
 * DM's private working document, so the draft is saved straight to it; every
 * part of it is then edited on the Prep screen.
 */
export function PrepDraftDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { activeCampaign, issues, codex, threads, matcher, nextIssueNumber, prep } = useCampaign();
  const { user } = useUser();
  const { toast } = useToast();
  const { savePrep } = usePrepWriter(activeCampaign?.id);

  const [goals, setGoals] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [tone, setTone] = React.useState('');
  const [extra, setExtra] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const draft = async () => {
    if (!activeCampaign || !goals.trim()) return;
    setBusy(true);
    const sessionLog = [...issues].reverse().slice(0, 8)
      .map(s => `Session ${s.sessionNumber}: ${recapOf(s)}`).join('\n\n').slice(0, 24_000);
    const { data, error } = await getSessionPrep(await idTokenFor(user), {
      campaignName: activeCampaign.name,
      ...(activeCampaign.description ? { campaignDescription: activeCampaign.description.slice(0, 2_000) } : {}),
      sessionGoals: goals.trim(),
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(tone.trim() ? { tone: tone.trim() } : {}),
      ...(extra.trim() ? { extraNotes: extra.trim() } : {}),
      ...(sessionLog ? { sessionLog } : {}),
      characters: (codex.raw.characters ?? []).slice(0, 12).map(c => ({
        name: c.name, ...(c.class ? { class: c.class } : {}), ...(c.backstory ? { backstory: c.backstory.slice(0, 1_500) } : {}),
      })),
      activeNpcs: (codex.raw.npcs ?? []).filter(n => n.importance === 'Key' || n.wants).slice(0, 40).map(n => ({
        name: n.name, description: [n.wants, n.description].filter(Boolean).join(' — ').slice(0, 1_000),
      })),
      ...(activeCampaign.aiSummary ? { campaignSummary: activeCampaign.aiSummary.slice(0, 4_000) } : {}),
      openThreads: (threads ?? []).filter(t => t.status !== 'cold').slice(0, 40).map(t => ({ id: t.id, title: t.title, status: t.status })),
    });
    setBusy(false);
    if (!data) {
      toast({ variant: 'destructive', title: 'No prep drafted', description: error ?? 'Try again.' });
      return;
    }

    // Cast names → page ids, for chips that open pages. Only people can be cast.
    const scenes: PrepScene[] = data.scenes.map(s => ({
      role: s.role, title: s.title, where: s.where, beat: s.beat,
      castIds: [...new Set(s.cast
        .map(name => matcher.resolveLink(name))
        .filter(r => r && (r.kind === 'npc' || r.kind === 'party'))
        .map(r => r!.id))],
    }));
    const { scenes: _drafted, ...rest } = data;
    const next: NonNullable<SessionPrepState['prep']> = { ...rest, scenes, done: [] };
    await savePrep(next);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={o => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-2xl border-holo">
        <DialogHeader>
          <DialogTitle className="text-holo">{GLYPH.copilot} {prep?.prep ? 'Redraft' : 'Draft'} issue #{nextIssueNumber}</DialogTitle>
          <DialogDescription>
            {prep?.prep
              ? 'Replaces the current prep, including ticked reminders and edited scenes.'
              : 'The co-pilot writes the pull, the script, complications, spotlights and a checklist. You edit all of it.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pd-goals">What is this issue for?</Label>
            <Textarea id="pd-goals" rows={3} value={goals} onChange={e => setGoals(e.target.value)} placeholder="Reveal the Circle agent; give Vashti her moment" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="pd-where">Where it starts</Label>
              <Input id="pd-where" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pd-tone">Tone</Label>
              <Input id="pd-tone" value={tone} onChange={e => setTone(e.target.value)} placeholder="Tense, comic, elegiac…" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pd-extra">Anything else</Label>
            <Textarea id="pd-extra" rows={2} value={extra} onChange={e => setExtra(e.target.value)} placeholder="Absences, pacing, things to avoid" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button type="button" onClick={() => onOpenChange(false)} disabled={busy} className="h-10 px-4 border-[1.5px] border-line2 font-mono font-bold text-[12px] tracking-[0.14em]">
            CANCEL
          </button>
          <button
            type="button"
            onClick={draft}
            disabled={busy || !goals.trim()}
            className="h-10 px-4 inline-flex items-center gap-2 bg-holo text-bg font-mono font-bold text-[12px] tracking-[0.14em] disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {GLYPH.copilot} DRAFT PREP
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
