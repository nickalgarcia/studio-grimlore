'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A deliberately small markdown renderer for AI output.
 *
 * It covers exactly what the prompts ask the model to produce — bold names,
 * italics, bullet and numbered lists, and `##` sub-headings — and nothing else.
 *
 * It builds React elements rather than an HTML string, so there is no
 * dangerouslySetInnerHTML and nothing to sanitize: any HTML the model emits is
 * rendered as literal text by React.
 *
 * `renderText` lets a caller take over plain text runs (inside bold and
 * italics too), which is how recaps render `[[links]]` and detected names
 * without a second parser.
 */

export type RenderText = (text: string, key: string) => React.ReactNode;

const plain: RenderText = (text, key) => <React.Fragment key={key}>{text}</React.Fragment>;

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'p'; text: string };

// Captures **bold**, *italic*, and `code` so String.split keeps the delimiters.
const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^\s*#{1,6}\s+/;
const RULE = /^\s*([-*_])\1{2,}\s*$/;

function renderInline(text: string, keyPrefix: string, renderText: RenderText = plain): React.ReactNode[] {
  return text
    .split(INLINE_PATTERN)
    .filter(part => part !== '')
    .map((part, i) => {
      const key = `${keyPrefix}-${i}`;

      if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={key} className="font-semibold text-ink">
            {renderText(part.slice(2, -2), `${key}-t`)}
          </strong>
        );
      }
      if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
        return <em key={key}>{renderText(part.slice(1, -1), `${key}-t`)}</em>;
      }
      if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={key} className="bg-panel px-1 py-0.5 text-[0.9em] font-mono">
            {part.slice(1, -1)}
          </code>
        );
      }
      return renderText(part, key);
    });
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];

  // Buffered paragraph lines, flushed when a different block type starts.
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'p', text: paragraph.join(' ').trim() });
      paragraph = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '' || RULE.test(trimmed)) {
      flushParagraph();
      continue;
    }

    if (HEADING.test(trimmed)) {
      flushParagraph();
      blocks.push({ kind: 'heading', text: trimmed.replace(HEADING, '') });
      continue;
    }

    if (BULLET.test(line)) {
      flushParagraph();
      const item = line.replace(BULLET, '');
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'ul') last.items.push(item);
      else blocks.push({ kind: 'ul', items: [item] });
      continue;
    }

    if (NUMBERED.test(line)) {
      flushParagraph();
      const item = line.replace(NUMBERED, '');
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'ol') last.items.push(item);
      else blocks.push({ kind: 'ol', items: [item] });
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

export function Markdown({
  content, className, renderText,
}: {
  content: string;
  className?: string;
  renderText?: RenderText;
}) {
  const blocks = React.useMemo(() => parseBlocks(content), [content]);

  return (
    <div className={cn('space-y-3 font-body leading-relaxed', className)}>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'heading':
            return (
              <p key={i} className="font-headline font-extrabold text-[1.05em] tracking-[0.06em] text-ink pt-1">
                {renderInline(block.text, `h-${i}`, renderText)}
              </p>
            );
          case 'ul':
            return (
              <ul key={i} className="space-y-1.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span aria-hidden="true" className="text-mute flex-shrink-0 select-none">
                      •
                    </span>
                    <span>{renderInline(item, `ul-${i}-${j}`, renderText)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="space-y-1.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span aria-hidden="true" className="text-mute flex-shrink-0 select-none tabular-nums">
                      {j + 1}.
                    </span>
                    <span>{renderInline(item, `ol-${i}-${j}`, renderText)}</span>
                  </li>
                ))}
              </ol>
            );
          case 'p':
          default:
            return <p key={i}>{renderInline(block.text, `p-${i}`, renderText)}</p>;
        }
      })}
    </div>
  );
}
