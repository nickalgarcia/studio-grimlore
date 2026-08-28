'use client';

import * as React from 'react';
import { Markdown } from '@/components/markdown';
import { ArrowUp, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DisplayMessage } from './use-live-session';

const STARTERS = [
  'They attack — statblock?',
  'Give me a tense NPC here',
  'Raise the stakes right now',
  'Overheard in the room',
  'What would the antagonist do?',
  'They want to negotiate instead',
];

/**
 * The only violet surface in the app. Violet means arcane; it must not leak
 * onto ordinary chrome.
 *
 * No `backdrop-filter` anywhere here — it forces a full-surface repaint every
 * frame over the animated backdrop. Solid translucent fills look identical
 * against this ground and cost nothing.
 */
export function CoPilot({
  messages, input, setInput, isLoading, onSend, textareaRef, sessionCount,
}: {
  messages: DisplayMessage[];
  input: string;
  setInput: (v: string) => void;
  isLoading: boolean;
  onSend: (content: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  sessionCount: number;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Sets scrollTop on the container rather than calling scrollIntoView on a
  // sentinel: inside a fixed-height shell scrollIntoView scrolls the nearest
  // scrollable ancestor too, which fights the cockpit layout.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(input);
    }
  };

  return (
    <aside
      className="min-w-0 min-h-0 relative flex flex-col border-l border-[hsl(var(--violet)/0.34)]
                 shadow-[-30px_0_70px_-30px_rgba(0,0,0,0.9),inset_0_1px_0_hsl(var(--violet-bright)/0.28)]"
      style={{
        background:
          'linear-gradient(180deg, hsl(258 40% 22% / 0.96) 0%, hsl(265 22% 9% / 0.97) 34%, hsl(264 17% 6% / 0.97) 100%)',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-[linear-gradient(90deg,transparent,hsl(var(--violet-bright)/0.9),transparent)]" />
      <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-[hsl(var(--violet-bright)/0.7)] pointer-events-none" />
      <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-[hsl(var(--violet-bright)/0.7)] pointer-events-none" />

      <div className="flex items-center gap-[11px] px-[18px] h-[42px] flex-shrink-0 border-b border-[hsl(var(--violet)/0.26)]">
        <Sparkles className="h-3.5 w-3.5 text-violet-bright" />
        <span className="font-mono text-[10px] font-extrabold tracking-[0.24em] text-violet-text [text-shadow:0_0_18px_hsl(var(--violet)/0.9)]">
          CO-PILOT
        </span>
        <div className="flex-1" />
        <span className="font-mono text-[9.5px] tracking-[0.1em] text-violet-dim">
          {sessionCount} {sessionCount === 1 ? 'SESSION' : 'SESSIONS'}
        </span>
      </div>

      <div className="flex flex-wrap gap-[5px] px-[15px] py-[13px] border-b border-[hsl(var(--violet)/0.2)] flex-shrink-0">
        {STARTERS.map(s => (
          <button
            key={s}
            onClick={() => onSend(s)}
            disabled={isLoading}
            className="text-[11.5px] text-[hsl(258_15%_72%)] bg-[hsl(var(--violet)/0.1)] border border-[hsl(var(--violet)/0.26)]
                       px-2.5 py-[5px] whitespace-nowrap transition-colors
                       hover:bg-[hsl(var(--violet)/0.3)] hover:text-[hsl(258_60%_94%)] hover:border-[hsl(var(--violet-bright)/0.7)]
                       disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-[15px] py-4">
        {messages.length === 0 ? (
          <p className="text-[12.5px] text-violet-dim leading-relaxed">
            I know your campaign. Ask me anything mid-session — unexpected player moves,
            NPC reactions, complications, dialogue, whatever you need.
          </p>
        ) : (
          messages.map(m => (
            m.role === 'user' ? (
              <div key={m.id} className="flex gap-2.5 mb-[11px] animate-slideIn">
                <span className="font-mono text-[9.5px] font-extrabold text-oxblood-bright pt-0.5 flex-shrink-0 tracking-[0.1em]">
                  DM
                </span>
                <span className="text-[12.5px] text-violet-dim leading-relaxed">{m.content}</span>
              </div>
            ) : (
              /* Not a chat bubble: the answer is a violet-edged panel. */
              <div
                key={m.id}
                className="mb-5 bg-[hsl(var(--violet)/0.1)] border border-[hsl(var(--violet)/0.28)]
                           border-l-4 border-l-violet px-4 py-3.5 shadow-violet animate-slideIn"
              >
                {m.content
                  ? <Markdown content={m.content} className="text-[13.5px] text-[hsl(258_45%_90%)] leading-[1.64]" />
                  : <Loader2 className="h-4 w-4 animate-spin text-violet-bright" />}
              </div>
            )
          ))
        )}
      </div>

      <div className="border-t border-[hsl(var(--violet)/0.26)] px-[15px] py-[13px] flex gap-0.5 items-end flex-shrink-0">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="What's happening at the table?"
          aria-label="Ask the co-pilot"
          className={cn(
            'flex-1 min-h-[46px] max-h-[110px] resize-none outline-none px-2.5 py-2.5',
            'bg-[hsl(264_30%_5%/0.7)] border border-[hsl(var(--violet)/0.3)]',
            'text-[13px] text-[hsl(258_45%_90%)] placeholder:text-violet-dim',
          )}
        />
        <button
          onClick={() => onSend(input)}
          disabled={!input.trim() || isLoading}
          aria-label="Send"
          className="w-11 h-[46px] flex-shrink-0 bg-violet text-[hsl(264_30%_8%)] flex items-center justify-center
                     shadow-[0_0_30px_-8px_hsl(var(--violet)/0.95)] hover:bg-violet-bright disabled:opacity-40 transition-colors"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-[17px] w-[17px]" />}
        </button>
      </div>
    </aside>
  );
}
