'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { getArtBriefDraft } from '@/app/actions';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { MonoLabel } from '@/components/shared/section-header';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { idTokenFor, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { ART_ASPECT_CLASS, ART_LABEL, MAX_CAST, MAX_STYLE_REFS, type ArtKind } from '@/lib/art';
import { GLYPH } from '@/lib/pages';
import { cn } from '@/lib/utils';

type CastOption = { id: string; name: string; look?: string; portraitUrl?: string; party: boolean };

const field = 'w-full bg-panel border-[1.5px] border-line2 px-3 py-2 outline-none focus:border-ink';
const quiet = 'h-10 px-4 border-[1.5px] border-line2 font-mono font-bold text-[12px] tracking-[0.14em] hover:border-ink disabled:opacity-50';
const copilot = 'h-10 px-4 inline-flex items-center gap-2 border-[1.5px] border-holo text-holo font-mono font-bold text-[12px] tracking-[0.14em] disabled:opacity-50';

/**
 * Brief → Gemini → preview → USE THIS, for any image slot. The image only
 * becomes the slot's art through `onUse`, which is the slot's ordinary upload
 * handler: a generated image is re-encoded and stored exactly like a dropped
 * file, so nothing downstream knows the difference.
 */
export function GenerateArtDialog({
  open, onOpenChange, kind, title, initialBrief, context, caption, suggestedCast, defaultCast, onUse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ArtKind;
  /** What this image is for, e.g. "Issue #9: The Warden's Door". */
  title: string;
  initialBrief?: string;
  /** What the co-pilot drafts the brief from: a recap, a scene beat, a page. Absent hides the button. */
  context?: string;
  /** A panel's caption: the drafted brief shows exactly that moment. */
  caption?: string;
  /** Character and NPC ids listed first and marked IN THIS, e.g. the issue's mentions. */
  suggestedCast?: string[];
  /** Ids selected when the dialog opens. */
  defaultCast?: string[];
  onUse: (file: File) => Promise<void>;
}) {
  const { activeCampaign, codex } = useCampaign();
  const { user } = useUser();
  const { toast } = useToast();

  const [brief, setBrief] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>([]);
  const [drafting, setDrafting] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [using, setUsing] = React.useState(false);
  const [result, setResult] = React.useState<{ blob: Blob; url: string } | null>(null);

  // Everyone who can appear in art: the party, then NPCs worth offering
  // (in this issue or page, or with a portrait or Look to send).
  const suggested = React.useMemo(() => new Set(suggestedCast ?? []), [suggestedCast]);
  const options: CastOption[] = React.useMemo(() => {
    const party = (codex.raw.characters ?? []).map(c => ({ id: c.id, name: c.name, look: c.look, portraitUrl: c.portraitUrl, party: true }));
    const npcs = (codex.raw.npcs ?? [])
      .filter(n => suggested.has(n.id) || (defaultCast ?? []).includes(n.id) || n.portraitUrl || n.look)
      .map(n => ({ id: n.id, name: n.name, look: n.look, portraitUrl: n.portraitUrl, party: false }));
    const rank = (o: CastOption) => (suggested.has(o.id) ? 0 : 1);
    return [...party, ...npcs.sort((a, b) => a.name.localeCompare(b.name))]
      .sort((a, b) => rank(a) - rank(b));
  }, [codex.raw.characters, codex.raw.npcs, suggested, defaultCast]);

  // Fresh form each time the dialog opens, and only then. Callers pass
  // `defaultCast` inline, so depending on it would wipe the brief mid-edit
  // on every parent render (the codex streams).
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpen.current) {
      setBrief(initialBrief?.trim() ?? '');
      setSelected((defaultCast ?? []).filter(id => options.some(o => o.id === id)).slice(0, MAX_CAST));
      setResult(null);
    }
    wasOpen.current = open;
  });

  // Object URLs hold the blob in memory until revoked.
  React.useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const toggle = (id: string) => setSelected(prev => (
    prev.includes(id) ? prev.filter(x => x !== id) : prev.length < MAX_CAST ? [...prev, id] : prev
  ));

  const draft = async () => {
    if (!activeCampaign || !context?.trim()) return;
    setDrafting(true);
    const { data, error } = await getArtBriefDraft(await idTokenFor(user), {
      kind,
      campaignName: activeCampaign.name,
      title: title.slice(0, 200),
      ...(caption?.trim() ? { caption: caption.trim().slice(0, 400) } : {}),
      context: context.slice(0, 16_000),
      castNames: options.slice(0, 60).map(o => o.name.slice(0, 120)),
    });
    setDrafting(false);
    if (!data) {
      toast({ variant: 'destructive', title: 'No brief', description: error ?? 'Try again.' });
      return;
    }
    setBrief(data.brief);
    const byName = new Map(options.map(o => [o.name.trim().toLowerCase(), o.id]));
    setSelected(data.cast.map(n => byName.get(n.trim().toLowerCase())).filter((id): id is string => !!id).slice(0, MAX_CAST));
  };

  const generate = async () => {
    if (!activeCampaign || !brief.trim()) return;
    setGenerating(true);
    try {
      const cast = selected
        .map(id => options.find(o => o.id === id))
        .filter((o): o is CastOption => !!o)
        .map(o => ({ name: o.name, look: o.look?.slice(0, 800), portraitUrl: o.portraitUrl }));
      const res = await fetch('/api/generate-art', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await idTokenFor(user)}` },
        body: JSON.stringify({
          kind,
          campaignName: activeCampaign.name,
          brief: brief.trim(),
          style: activeCampaign.artStyle,
          styleRefUrls: (activeCampaign.styleRefUrls ?? []).slice(0, MAX_STYLE_REFS),
          cast,
        }),
      });
      if (!res.ok) {
        // The route's error bodies are written for the DM.
        const message = (await res.text()).slice(0, 300) || 'Try again.';
        toast({ variant: 'destructive', title: 'No image', description: message });
        return;
      }
      const blob = await res.blob();
      setResult({ blob, url: URL.createObjectURL(blob) });
    } catch {
      toast({ variant: 'destructive', title: 'No image', description: 'The request failed. Check your connection.' });
    } finally {
      setGenerating(false);
    }
  };

  const use = async () => {
    if (!result) return;
    setUsing(true);
    try {
      const ext = result.blob.type.split('/')[1] ?? 'png';
      await onUse(new File([result.blob], `generated.${ext}`, { type: result.blob.type || 'image/png' }));
      onOpenChange(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Image not saved', description: (e as Error).message });
    } finally {
      setUsing(false);
    }
  };

  const wide = kind === 'scene';
  const styled = !!(activeCampaign?.artStyle?.trim() || activeCampaign?.styleRefUrls?.length);
  const busy = drafting || generating || using;

  const preview = (
    <div className={cn('relative w-full bg-panel border-[3px] border-ink', ART_ASPECT_CLASS[kind])}>
      {result ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={result.url} alt={`Generated ${ART_LABEL[kind].toLowerCase()}`} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center font-mono font-bold text-[11px] tracking-[0.16em] text-mute">
          {generating ? <><Loader2 className="h-5 w-5 animate-spin text-holo" />DRAWING… 15–40 S</> : 'PREVIEW'}
        </span>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <MonoLabel className="text-holo">{GLYPH.copilot} Generate {ART_LABEL[kind].toLowerCase()}</MonoLabel>
          <DialogTitle className="font-headline font-black text-[30px] leading-[0.95] uppercase">{title}</DialogTitle>
          <DialogDescription>
            Gemini draws it from your brief, the campaign&apos;s art direction and the portraits of the characters you pick.
          </DialogDescription>
        </DialogHeader>

        <div className={cn('gap-5', wide ? 'flex flex-col' : 'grid md:grid-cols-[minmax(0,1fr)_260px]')}>
          {wide && preview}

          <div className="flex flex-col gap-4 min-w-0">
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between gap-2">
                <MonoLabel className="text-mute">Brief</MonoLabel>
                {context?.trim() && (
                  <button type="button" onClick={draft} disabled={busy} className={cn(copilot, 'h-8 px-2.5 text-[11px]')}>
                    {drafting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {GLYPH.copilot} DRAFT WITH CO-PILOT
                  </button>
                )}
              </span>
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                rows={5}
                maxLength={2_000}
                placeholder="Who is where, doing what. The camera (wide, close, low angle), the light, the mood."
                className={cn(field, 'text-[17px] leading-[1.5] resize-y')}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <MonoLabel className="text-mute">In the image · {selected.length} of {MAX_CAST}</MonoLabel>
              {options.length === 0 ? (
                <p className="italic text-[15px] text-mute">No characters in this campaign yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-[148px] overflow-y-auto">
                  {options.map(o => {
                    const on = selected.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(o.id)}
                        disabled={!on && selected.length >= MAX_CAST}
                        title={o.portraitUrl ? undefined : 'No portrait: only the name and Look are sent'}
                        className={cn(
                          'inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 border-[1.5px] text-[15px] disabled:opacity-40',
                          on ? 'bg-ink text-bg border-ink' : 'border-line2 hover:border-ink',
                        )}
                      >
                        {o.portraitUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={o.portraitUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                          : <span aria-hidden="true" className="w-5 text-center font-mono text-[11px]">{GLYPH.person}</span>}
                        {o.name}
                        {suggested.has(o.id) && <span className={cn('font-mono font-bold text-[11px] tracking-[0.12em]', on ? 'text-bg' : 'text-spot')}>IN THIS</span>}
                        {!o.portraitUrl && <span className="font-mono text-[11px] tracking-[0.12em] opacity-70">NO ART</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="font-mono text-[11px] tracking-[0.1em] text-mute">
              {styled
                ? `USING YOUR ART DIRECTION${activeCampaign?.styleRefUrls?.length ? ` + ${activeCampaign.styleRefUrls.length} STYLE REF` : ''}.`
                : 'NO ART DIRECTION SET: USING THE DEFAULT STYLE. SET IT IN THE CAMPAIGN MENU → ART DIRECTION.'}
            </p>
          </div>

          {!wide && preview}
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={() => onOpenChange(false)} disabled={busy} className={quiet}>CANCEL</button>
          <button type="button" onClick={generate} disabled={busy || !brief.trim()} className={copilot}>
            {generating && <Loader2 className="h-4 w-4 animate-spin" />}
            {GLYPH.copilot} {result ? 'TRY AGAIN' : 'GENERATE'}
          </button>
          {result && (
            <button
              type="button"
              onClick={use}
              disabled={busy}
              className="h-10 px-4 inline-flex items-center gap-2 bg-spot text-spot-on font-headline font-black text-[17px] uppercase disabled:opacity-50"
            >
              {using && <Loader2 className="h-4 w-4 animate-spin" />}
              Use this
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
