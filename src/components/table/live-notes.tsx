'use client';

import * as React from 'react';

/**
 * Free-text notes for the session, kept alongside `+` captures; both are
 * archived with the issue and feed the recap draft.
 *
 * Owns its own text state so parent re-renders (a streaming reply, one token at
 * a time) cannot interrupt typing. `key` is bumped by the parent after hydrate
 * or END SESSION to remount it with fresh content.
 */
export const LiveNotes = React.memo(function LiveNotes({
  initialValue, onNotesChange,
}: {
  initialValue: string;
  onNotesChange: (notes: string) => void;
}) {
  const [value, setValue] = React.useState(initialValue);
  return (
    <textarea
      value={value}
      onChange={e => { setValue(e.target.value); onNotesChange(e.target.value); }}
      aria-label="Free notes for tonight"
      placeholder="Names, promises, dice that mattered…"
      className="w-full min-h-[140px] resize-y outline-none px-4 py-3 bg-panel border-[1.5px] border-line2 focus:border-ink text-[18px] leading-[1.55] placeholder:text-mute"
    />
  );
});
