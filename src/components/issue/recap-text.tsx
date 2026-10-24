'use client';

import * as React from 'react';
import Link from 'next/link';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { Markdown, type RenderText } from '@/components/markdown';
import { refKey, sameRef } from '@/lib/mentions';
import { pageHref } from '@/lib/pages';
import type { MentionRef } from '@/lib/types';

/**
 * Markdown with the campaign's names made navigable:
 * - `[[links]]` get a solid 2px spot underline
 * - unbracketed names the matcher detected get a dotted mute underline
 * - `[[names]]` nothing matches render as their plain text
 *
 * `ignore` holds refs the DM marked as false hits for this issue; `self` is
 * the page being read, which shouldn't link to itself.
 */
export function RecapText({
  content, className, ignore, self,
}: {
  content: string;
  className?: string;
  ignore?: ReadonlySet<string>;
  self?: MentionRef;
}) {
  const { matcher } = useCampaign();

  const renderText = React.useCallback<RenderText>((text, key) => {
    const { hits, unresolved } = matcher.scan(text);
    if (hits.length === 0 && unresolved.length === 0) return <React.Fragment key={key}>{text}</React.Fragment>;

    const marks = [
      ...hits.map(h => ({ start: h.start, end: h.end, text: h.text, hit: h })),
      ...unresolved.map(u => ({ start: u.start, end: u.end, text: u.text, hit: null })),
    ].sort((a, b) => a.start - b.start);

    const out: React.ReactNode[] = [];
    let at = 0;
    marks.forEach((m, i) => {
      if (m.start > at) out.push(text.slice(at, m.start));
      const h = m.hit;
      const skip = !h || (self && sameRef(h.ref, self)) || (h.via === 'detected' && ignore?.has(refKey(h.ref)));
      if (skip) {
        out.push(m.text);
      } else {
        out.push(
          <Link
            key={`${key}-${i}`}
            href={pageHref(h.ref)}
            className={h.via === 'link'
              ? 'border-b-2 border-spot hover:bg-spot hover:text-spot-on'
              : 'border-b border-dotted border-mute hover:border-ink'}
          >
            {m.text}
          </Link>,
        );
      }
      at = m.end;
    });
    if (at < text.length) out.push(text.slice(at));
    return <React.Fragment key={key}>{out}</React.Fragment>;
  }, [matcher, ignore, self]);

  return <Markdown content={content} className={className} renderText={renderText} />;
}
