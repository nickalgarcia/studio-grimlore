'use client';

import * as React from 'react';
import { deleteField, doc } from 'firebase/firestore';
import { ImageSlot } from '@/components/shared/image-slot';
import { MonoLabel } from '@/components/shared/section-header';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFirestore, useImageUpload, useUser, type WithId } from '@/firebase';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_ART_STYLE, MAX_STYLE_REFS } from '@/lib/art';
import type { Campaign } from '@/lib/types';

/**
 * The campaign's house style for generated art: a style paragraph and up to
 * two approved images Gemini copies the look of. Both are sent with every
 * generation, because the model remembers nothing between requests.
 */
export function ArtDirectionDialog({
  open, onOpenChange, campaign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: WithId<Campaign>;
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { upload, remove } = useImageUpload(campaign.id);
  const [style, setStyle] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const refs = campaign.styleRefUrls ?? [];

  React.useEffect(() => {
    if (open) setStyle(campaign.artStyle?.trim() || DEFAULT_ART_STYLE);
    // Only on open: the campaign doc re-streams after every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const write = (patch: Record<string, unknown>) => {
    if (!user) return Promise.resolve();
    return updateDocumentNonBlocking(doc(firestore, 'users', user.uid, 'campaigns', campaign.id), patch);
  };

  const saveStyle = async () => {
    setSaving(true);
    try {
      const text = style.trim();
      // The default isn't stored, so improving it later reaches campaigns that never changed it.
      await write({ artStyle: text && text !== DEFAULT_ART_STYLE ? text.slice(0, 1_500) : deleteField() });
      toast({ title: 'Art direction saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save art direction' });
    } finally {
      setSaving(false);
    }
  };

  const setRef = (i: number) => async (file: File) => {
    const url = await upload(file, 'style', `style-${i}`);
    const next = [...refs];
    const old = next[i];
    if (i < next.length) next[i] = url; else next.push(url);
    await write({ styleRefUrls: next.slice(0, MAX_STYLE_REFS) });
    void remove(old);
  };

  const removeRef = async (i: number) => {
    const old = refs[i];
    const next = refs.filter((_, j) => j !== i);
    await write({ styleRefUrls: next.length ? next : deleteField() });
    void remove(old);
  };

  // Filled slots, then one empty slot while there's room.
  const slots = Math.min(MAX_STYLE_REFS, refs.length + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-headline font-black text-[30px] leading-[0.95] uppercase">Art direction</DialogTitle>
          <DialogDescription>
            The house style for every generated cover, panel, scene and portrait in {campaign.name}.
          </DialogDescription>
        </DialogHeader>

        <label className="flex flex-col gap-1.5">
          <MonoLabel className="text-mute">Style</MonoLabel>
          <textarea
            value={style}
            onChange={e => setStyle(e.target.value)}
            rows={5}
            maxLength={1_500}
            className="w-full bg-panel border-[1.5px] border-line2 px-3 py-2 outline-none focus:border-ink text-[17px] leading-[1.5] resize-y"
          />
          <span className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStyle(DEFAULT_ART_STYLE)}
              className="font-mono font-bold text-[11px] tracking-[0.14em] text-mute hover:text-ink"
            >
              RESET TO DEFAULT
            </button>
            <button
              type="button"
              onClick={saveStyle}
              disabled={saving}
              className="h-9 px-4 bg-spot text-spot-on font-headline font-black text-[16px] uppercase disabled:opacity-50"
            >
              Save style
            </button>
          </span>
        </label>

        <div className="flex flex-col gap-1.5">
          <MonoLabel className="text-mute">Style references · {refs.length} of {MAX_STYLE_REFS}</MonoLabel>
          <p className="italic text-[15px] text-mute">
            Drop in one or two images you love. Gemini copies their look (linework, colour, texture), not their content.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-[420px]">
            {Array.from({ length: slots }, (_, i) => (
              <div key={i} className="flex flex-col gap-1">
                <ImageSlot
                  url={refs[i]}
                  alt={`style reference ${i + 1}`}
                  onFile={setRef(i)}
                  clickToUpload
                  emptyLabel="Drop a style reference"
                  className="aspect-square border-[3px] border-ink"
                  imgClassName="object-contain"
                />
                {refs[i] && (
                  <button
                    type="button"
                    onClick={() => void removeRef(i)}
                    className="self-start font-mono font-bold text-[11px] tracking-[0.14em] text-mute hover:text-ink"
                  >
                    ✕ REMOVE
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
