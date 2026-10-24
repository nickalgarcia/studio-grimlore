'use client';

import * as React from 'react';
import { Markdown } from '@/components/markdown';
import { MonoLabel } from '@/components/shared/section-header';
import { GLYPH } from '@/lib/pages';
import { cn } from '@/lib/utils';
import type { useLiveSession } from './use-live-session';

/**
 * Quick prompts. The last three cover what the v3 idea, NPC and inspiration
 * generators did: those screens are gone, and the co-pilot is the one place AI
 * appears now.
 */
const PROMPTS = [
  'Guard tactics',
  'Name a servant',
  'If they refuse',
  'They attack — statblock?',
  'Raise the stakes',
  'A plot hook from here',
  'Overheard in the room',
];

/**
 * The AI column: the only holo surface in the app. Hideable from the live
 * bar; under ~1100px it renders inside a sheet instead (see the Table page).
 *
 * Review item U5: the textarea stays enabled while a reply streams (only Send
 * waits), and STOP cancels the stream, keeping what has arrived.
 */
export function CoPilot({ live, className }: { live: ReturnType<typeof useLiveSession>; className?: string }) {
  const { messages, input, setInput, isLoading, sendMessage, stop, textareaRef } = live;
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // scrollTop on the container, not scrollIntoView: scrollIntoView also
  // scrolls the page around the column.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = () => {
    if (!isLoading && input.trim()) void sendMessage(input);
  };

  return (
    <section aria-label="Co-pilot" className={cn('min-w-0 min-h-0 flex flex-col', className)}>
      <header className="flex-none px-4 pt-4 pb-3 flex flex-col gap-2">
        <span className="font-mono font-bold text-[12px] tracking-[0.2em] text-holo">{GLYPH.copilot} CO-PILOT</span>
        <span aria-hidden="true" className="h-px bg-holo/50" />
      </header>

      <div className="flex-none flex flex-wrap gap-1.5 px-4 pb-3">
        {PROMPTS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => void sendMessage(p)}
            disabled={isLoading}
            className="px-2 py-1 border border-holo/70 text-holo font-mono font-bold text-[11px] tracking-[0.08em] hover:bg-holo hover:text-bg disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-2 flex flex-col gap-4" aria-live="polite">
        {messages.length === 0 && (
          <p className="italic text-[17px] text-mute">
            It knows the campaign, the scene and who&apos;s on stage. Ask it anything mid-session.
          </p>
        )}
        {messages.map(m => (
          m.role === 'user' ? (
            <p key={m.id} className="self-end max-w-[88%] bg-panel border border-line2 px-3 py-2 text-[17px] leading-[1.45]">
              {m.content}
            </p>
          ) : (
            <div key={m.id} className="flex flex-col gap-1">
              <MonoLabel className="text-holo">Co-pilot</MonoLabel>
              {m.content
                ? <Markdown content={m.content} className="text-[17px] leading-[1.55]" />
                : <span className="font-mono text-[13px] text-holo">…</span>}
            </div>
          )
        ))}
      </div>

      <div className="flex-none p-4 border-t border-line flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={3}
          placeholder="What's happening at the table?"
          aria-label="Ask the co-pilot"
          className="w-full resize-none outline-none px-3 py-2 bg-panel border-[1.5px] border-line2 focus:border-holo text-[17px] leading-[1.45] placeholder:text-mute"
        />
        <div className="flex justify-end gap-2">
          {isLoading && (
            <button type="button" onClick={stop} className="h-9 px-4 border-[1.5px] border-holo text-holo font-mono font-bold text-[12px] tracking-[0.14em]">
              ■ STOP
            </button>
          )}
          <button
            type="button"
            onClick={send}
            disabled={isLoading || !input.trim()}
            className="h-9 px-5 bg-holo text-bg font-mono font-bold text-[12px] tracking-[0.14em] disabled:opacity-50"
          >
            SEND
          </button>
        </div>
      </div>
    </section>
  );
}
