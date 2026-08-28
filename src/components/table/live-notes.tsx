'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Always open. In the old live-session this sat behind a collapsed disclosure,
 * which is exactly why it went unused — the notes are what feed the recap.
 *
 * Owns its own text state so parent re-renders (a streaming reply, one token at
 * a time) cannot interrupt typing. `key` is bumped by the parent after hydrate
 * or clear to remount it with fresh content.
 */
export const LiveNotes = React.memo(function LiveNotes({
  initialValue, onNotesChange, roomy = false,
}: {
  initialValue: string;
  onNotesChange: (notes: string) => void;
  /** Taller when there is no scene above to fill the stage. */
  roomy?: boolean;
}) {
  const [value, setValue] = React.useState(initialValue);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-[11px]">
        <span className="font-mono text-[10px] font-extrabold tracking-[0.3em] text-bone-faint">
          LIVE NOTES
        </span>
        <span className="flex-1 h-[3px] bg-[hsl(var(--border)/0.06)]" />
        <span className="font-mono text-[9.5px] tracking-[0.14em] text-bone-faint">
          FEEDS THE RECAP
        </span>
      </div>
      <textarea
        value={value}
        onChange={e => { setValue(e.target.value); onNotesChange(e.target.value); }}
        aria-label="Live session notes"
        placeholder="Names, promises, dice that mattered…"
        className={cn(
          'w-full resize-y outline-none px-4 py-3.5',
          roomy ? 'min-h-[320px]' : 'min-h-[98px]',
          'bg-[hsl(var(--background)/0.72)] border border-border/[0.09] border-l-4 border-l-oxblood',
          'text-[13.5px] leading-[1.6] text-bone-soft placeholder:text-bone-faint',
          'shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9)]',
        )}
      />
    </div>
  );
});
