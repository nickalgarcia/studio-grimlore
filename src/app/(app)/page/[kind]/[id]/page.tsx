'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { PageView } from '@/components/page/page-view';
import { isPageKind, pageKindOf } from '@/lib/pages';

export default function EntityPage() {
  const params = useParams<{ kind: string; id: string }>();
  const kind = isPageKind(params.kind) ? params.kind : null;
  const id = decodeURIComponent(params.id);
  const { codex, threads } = useCampaign();

  const entry = kind && kind !== 'thread'
    ? codex.entries.find(e => e.id === id && pageKindOf(e.kind) === kind) ?? null
    : null;
  const thread = kind === 'thread' ? threads?.find(t => t.id === id) ?? null : null;
  const source = entry?.source ?? thread;

  const loading = codex.isLoading || threads === null;
  if (!kind || (!loading && !source)) {
    return (
      <div className="max-w-[1240px] mx-auto w-full px-[clamp(20px,3vw,48px)] pt-8 pb-24">
        <Link href="/" className="font-mono text-[12px] text-mute">← STORY</Link>
        <p className="mt-6 italic text-mute">This page doesn&apos;t exist, or it was deleted.</p>
      </div>
    );
  }
  if (!source) return null;

  // Keyed by page, so local state (an open draft) never carries over to the next page.
  return <PageView key={`${kind}:${id}`} kind={kind} id={id} source={source} entry={entry} />;
}
