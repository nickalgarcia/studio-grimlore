'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { getSessionRecap } from '@/app/actions';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { MonoLabel } from '@/components/shared/section-header';
import { idTokenFor, useSessionWriter, useUser, type WithId } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { GLYPH } from '@/lib/pages';
import type { Session } from '@/lib/types';

/** What the session left behind to write from: free notes plus captures. */
function notesOf(issue: Session): string {
  const captures = (issue.captures ?? []).map(c => `- ${c.text}`).join('\n');
  return [issue.notes?.trim(), captures && `Captured during play:\n${captures}`].filter(Boolean).join('\n\n');
}

type Draft = { title: string; logline: string; recap: string };

/**
 * The RECAP NOT WRITTEN YET state. The co-pilot drafts from the notes the
 * session archived; the DM edits the draft, and only their save publishes it.
 *
 * `autoStart` comes from `?draft=recap`, the END SESSION toast's link.
 */
export function RecapDraft({ issue, autoStart = false }: { issue: WithId<Session>; autoStart?: boolean }) {
  const { activeCampaign, codex, linkNames } = useCampaign();
  const { user } = useUser();
  const { toast } = useToast();
  const { updateSession } = useSessionWriter(activeCampaign?.id);

  const [drafting, setDrafting] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);

  const notes = notesOf(issue);

  const run = React.useCallback(async () => {
    if (!activeCampaign || !notes) return;
    setDrafting(true);
    const { data, error } = await getSessionRecap(await idTokenFor(user), {
      campaignName: activeCampaign.name,
      sessionNumber: issue.sessionNumber,
      dmNotes: notes.slice(0, 30_000),
      characters: (codex.raw.characters ?? []).slice(0, 12).map(c => ({ name: c.name, ...(c.class ? { class: c.class } : {}) })),
      previousSummary: activeCampaign.aiSummary?.slice(0, 4_000),
      linkNames: linkNames.slice(0, 300),
    });
    setDrafting(false);
    if (!data) {
      toast({ variant: 'destructive', title: 'No draft', description: error ?? 'Try again.' });
      return;
    }
    setDraft({
      title: issue.title?.trim() || data.title,
      logline: issue.logline?.trim() || data.logline,
      recap: data.recap,
    });
  }, [activeCampaign, notes, user, issue, codex.raw.characters, linkNames, toast]);

  // Once per mount, so a re-render can't fire a second paid call.
  const started = React.useRef(false);
  React.useEffect(() => {
    if (!autoStart || started.current || !notes) return;
    started.current = true;
    void run();
  }, [autoStart, notes, run]);

  const save = async () => {
    if (!draft?.recap.trim()) return;
    setSaving(true);
    try {
      await updateSession(issue.id, {
        recap: draft.recap.trim(),
        ...(draft.title.trim() ? { title: draft.title.trim() } : {}),
        ...(draft.logline.trim() ? { logline: draft.logline.trim() } : {}),
      });
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full bg-panel border-[1.5px] border-line2 px-3 py-2 outline-none focus:border-ink';

  if (draft) {
    return (
      <div className="border-[3px] border-holo p-5 flex flex-col gap-4">
        <MonoLabel className="text-holo">{GLYPH.copilot} Co-pilot draft · edit, then publish</MonoLabel>
        <label className="flex flex-col gap-1">
          <MonoLabel className="text-mute">Title</MonoLabel>
          <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className={`${field} font-headline font-black text-[26px]`} />
        </label>
        <label className="flex flex-col gap-1">
          <MonoLabel className="text-mute">Logline</MonoLabel>
          <input value={draft.logline} onChange={e => setDraft({ ...draft, logline: e.target.value })} className={`${field} italic text-[19px]`} />
        </label>
        <label className="flex flex-col gap-1">
          <MonoLabel className="text-mute">Recap · [[Name]] links a page</MonoLabel>
          <textarea
            value={draft.recap}
            onChange={e => setDraft({ ...draft, recap: e.target.value })}
            rows={16}
            className={`${field} text-[19px] leading-[1.55] resize-y`}
          />
        </label>
        <div className="flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={() => setDraft(null)} className="h-10 px-4 border-[1.5px] border-line2 font-mono font-bold text-[12px] tracking-[0.14em]">
            DISCARD
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !draft.recap.trim()}
            className="h-10 px-5 bg-spot text-spot-on font-headline font-black text-[18px] uppercase disabled:opacity-50"
          >
            Publish recap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-[3px] border-dashed border-line2 p-6 flex flex-col items-start gap-3">
      <MonoLabel>Recap not written yet</MonoLabel>
      <p className="italic text-[17px] text-mute max-w-[52ch]">
        {notes
          ? 'The co-pilot drafts it from the notes and captures saved with this issue. You edit it; nothing publishes until you do.'
          : 'No notes were saved with this issue, so there is nothing to draft from. Sessions ended from the new Table keep their notes. Write this one with EDIT.'}
      </p>
      <button
        type="button"
        onClick={run}
        disabled={!notes || drafting}
        className="h-10 px-4 inline-flex items-center gap-2 border-[1.5px] border-holo text-holo font-mono font-bold text-[12px] tracking-[0.14em] disabled:opacity-50"
      >
        {drafting && <Loader2 className="h-4 w-4 animate-spin" />}
        {GLYPH.copilot} DRAFT FROM NOTES
      </button>
    </div>
  );
}
