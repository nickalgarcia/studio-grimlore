'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { getPageDraft } from '@/app/actions';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { MonoLabel } from '@/components/shared/section-header';
import { idTokenFor, useEntityWriter, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { GLYPH } from '@/lib/pages';
import type { HistoryEntry } from '@/lib/types';

export type DraftableKind = 'npc' | 'faction' | 'place' | 'thread';

const LABELS: Record<DraftableKind, { primary: string; secondary?: string; history: boolean }> = {
  npc: { primary: 'Wants · now', secondary: 'Knows', history: true },
  faction: { primary: 'Agenda · now', secondary: 'What they know', history: false },
  place: { primary: "What's known", history: false },
  thread: { primary: 'Where it stands', secondary: 'What each side offers', history: true },
};

type Draft = { lede: string; primary: string; secondary: string; history: HistoryEntry[] };

const orUndefined = (s: string) => (s.trim() ? s.trim() : undefined);

/** A draft maps onto each kind's own fields. Empty fields aren't written. */
function toPatch(kind: DraftableKind, d: Draft): Record<string, unknown> {
  const history = d.history.filter(h => h.text.trim());
  switch (kind) {
    case 'npc':
      return { description: orUndefined(d.lede), wants: orUndefined(d.primary), knows: orUndefined(d.secondary), ...(history.length ? { history } : {}) };
    case 'faction':
      return { description: orUndefined(d.lede), currentAgenda: orUndefined(d.primary), whatTheyKnow: orUndefined(d.secondary) };
    case 'place':
      return { description: orUndefined([d.lede, d.primary].filter(s => s.trim()).join('\n\n')) };
    case 'thread': {
      // Nested, so stripUndefined in the writer can't reach it: drop empties here.
      const body = Object.fromEntries(
        Object.entries({ whereItStands: orUndefined(d.primary), whatEachSideOffers: orUndefined(d.secondary) })
          .filter(([, v]) => v !== undefined),
      );
      return {
        note: orUndefined(d.lede),
        ...(Object.keys(body).length ? { body } : {}),
        ...(history.length ? { history } : {}),
      };
    }
  }
}

/**
 * The STUB PAGE box and the co-pilot draft that fills it. The draft is
 * written from recap passages that mention the page, shown for editing, and
 * saved only when the DM saves it.
 */
export function PageDraft({
  kind, id, name, known, excerpts,
}: {
  kind: DraftableKind;
  id: string;
  name: string;
  known?: string;
  excerpts: { session: number; text: string }[];
}) {
  const { activeCampaign } = useCampaign();
  const { user } = useUser();
  const { toast } = useToast();
  const write = useEntityWriter(activeCampaign?.id);
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const labels = LABELS[kind];

  const run = async () => {
    if (!activeCampaign) return;
    setBusy(true);
    const { data, error } = await getPageDraft(await idTokenFor(user), {
      campaignName: activeCampaign.name,
      kind,
      name,
      ...(known ? { known: known.slice(0, 4_000) } : {}),
      excerpts: excerpts.slice(-12),
    });
    setBusy(false);
    if (!data) {
      toast({ variant: 'destructive', title: 'No draft', description: error ?? 'Try again.' });
      return;
    }
    setDraft(data);
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await write(kind, id, toPatch(kind, draft));
      setDraft(null);
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full bg-panel border-[1.5px] border-line2 px-3 py-2 outline-none focus:border-ink';

  if (draft) {
    const area = (label: string, key: 'lede' | 'primary' | 'secondary', italic = false) => (
      <label className="flex flex-col gap-1">
        <MonoLabel className="text-mute">{label}</MonoLabel>
        <textarea
          value={draft[key]}
          onChange={e => setDraft({ ...draft, [key]: e.target.value })}
          rows={key === 'lede' ? 2 : 4}
          className={`${field} text-[18px] leading-[1.5] resize-y ${italic ? 'italic' : ''}`}
        />
      </label>
    );
    return (
      <div className="border-[3px] border-holo p-5 flex flex-col gap-4">
        <MonoLabel className="text-holo">{GLYPH.copilot} Co-pilot draft · edit, then save</MonoLabel>
        {area('Lede', 'lede', true)}
        {area(labels.primary, 'primary')}
        {labels.secondary && area(labels.secondary, 'secondary')}
        {labels.history && draft.history.length > 0 && (
          <div className="flex flex-col gap-2">
            <MonoLabel className="text-mute">History</MonoLabel>
            {draft.history.map((h, i) => (
              <div key={i} className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-2 items-start">
                <span className="font-mono text-[13px] text-spot pt-2">#{h.session}</span>
                <input
                  value={h.text}
                  onChange={e => setDraft({ ...draft, history: draft.history.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                  aria-label={`Issue ${h.session}`}
                  className={`${field} text-[17px]`}
                />
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, history: draft.history.filter((_, j) => j !== i) })}
                  aria-label={`Remove issue ${h.session}`}
                  className="h-9 px-2 font-mono font-bold text-[12px] text-mute hover:text-ink"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={() => setDraft(null)} className="h-10 px-4 border-[1.5px] border-line2 font-mono font-bold text-[12px] tracking-[0.14em]">
            DISCARD
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="h-10 px-5 bg-spot text-spot-on font-headline font-black text-[18px] uppercase disabled:opacity-50"
          >
            Save to page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-[3px] border-dashed border-line2 p-6 flex flex-col items-start gap-3">
      <MonoLabel>Stub page</MonoLabel>
      <p className="italic text-[17px] text-mute max-w-[52ch]">
        {excerpts.length
          ? `Nothing written yet. ${excerpts.length === 1 ? 'One recap mentions' : `${excerpts.length} recaps mention`} ${name}; the co-pilot can draft this page from them.`
          : `Nothing written yet, and no recap mentions ${name}, so there is nothing to draft from.`}
      </p>
      <button
        type="button"
        onClick={run}
        disabled={busy || excerpts.length === 0}
        className="h-10 px-4 inline-flex items-center gap-2 border-[1.5px] border-holo text-holo font-mono font-bold text-[12px] tracking-[0.14em] disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {GLYPH.copilot} DRAFT FROM RECAPS
      </button>
    </div>
  );
}
