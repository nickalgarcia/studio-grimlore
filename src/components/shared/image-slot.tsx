'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * A user-supplied image: a cover, a panel, a portrait. Empty slots are a
 * plain `--panel` fill, per the spec; the design ships no art.
 *
 * Dropping an image file on the slot always uploads. Clicking only uploads
 * when `clickToUpload` is set, because on the Longbox a click selects the
 * issue; those slots still get a keyboard-reachable upload button.
 */
export function ImageSlot({
  url, alt, onFile, clickToUpload = false, className, imgClassName, children, emptyLabel,
}: {
  url?: string;
  alt: string;
  /** Upload the file and save its URL. Throw to report failure. */
  onFile: (file: File) => Promise<void>;
  clickToUpload?: boolean;
  className?: string;
  imgClassName?: string;
  /** Overlays that sit above the image (number blocks, captions). */
  children?: React.ReactNode;
  /** Shown in an empty slot, e.g. "PORTRAIT". */
  emptyLabel?: string;
}) {
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const take = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      await onFile(file);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Image not saved', description: (e as Error).message });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const pick = () => inputRef.current?.click();

  return (
    <div
      className={cn('group relative overflow-hidden bg-panel', className)}
      onDragOver={e => {
        if (!Array.from(e.dataTransfer.types).includes('Files')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault();
        setOver(false);
        void take(e.dataTransfer.files?.[0]);
      }}
    >
      {url ? (
        // A plain <img>: download URLs are tokenised and already sized, and
        // next/image would need the Storage host allow-listed for no gain.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className={cn('absolute inset-0 w-full h-full object-cover', imgClassName)} />
      ) : (
        emptyLabel && (
          <span className="absolute inset-0 flex items-center justify-center p-3 text-center font-mono font-bold text-[11px] tracking-[0.16em] uppercase text-mute">
            {emptyLabel}
          </span>
        )
      )}

      {children}

      {clickToUpload && (
        <button
          type="button"
          onClick={pick}
          aria-label={url ? `Replace ${alt}` : `Add ${alt}`}
          className="absolute inset-0 w-full h-full focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-spot focus-visible:-outline-offset-[3px]"
        />
      )}
      {!clickToUpload && (
        <button
          type="button"
          onClick={pick}
          className="absolute bottom-1.5 left-1.5 z-[2] px-1.5 py-0.5 bg-ink text-bg font-mono font-bold text-[11px] tracking-[0.14em] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
        >
          {url ? 'REPLACE ART' : '+ ART'}
        </button>
      )}

      {(over || busy) && (
        <span
          aria-live="polite"
          className="absolute inset-0 flex items-center justify-center border-[3px] border-dashed border-spot bg-scrim font-mono font-bold text-[12px] tracking-[0.16em] text-spot pointer-events-none"
        >
          {busy ? 'UPLOADING…' : 'DROP ART'}
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={e => void take(e.target.files?.[0])}
      />
    </div>
  );
}
