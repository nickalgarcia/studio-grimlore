'use client';

import { useEffect } from 'react';

/**
 * The recovery screen for a crash in any route (review item U2). Firestore
 * writes save as they happen, so reloading loses at most the last keystrokes.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-ink p-8">
      <div className="max-w-[46ch] flex flex-col gap-4">
        <span className="font-mono font-bold text-[12px] tracking-[0.2em] uppercase">Something broke</span>
        <h1 className="font-headline font-black uppercase text-[52px] leading-[0.86]">Reload and carry on</h1>
        <p className="italic text-[19px]">
          Your notes, captures and combat are saved as you go, so reloading loses at most the last few keystrokes.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.location.reload()} className="h-[42px] px-4 bg-spot text-spot-on font-headline font-black text-[18px] uppercase">
            Reload
          </button>
          <button type="button" onClick={reset} className="h-[42px] px-4 border-[1.5px] border-ink font-mono font-bold text-[12px] tracking-[0.14em]">
            TRY AGAIN
          </button>
        </div>
      </div>
    </div>
  );
}
