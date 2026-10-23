'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getRuleInfo } from '@/app/actions';
import { idTokenFor, useUser } from '@/firebase';
import { Markdown } from '@/components/markdown';
import { MonoLabel, SectionHeader } from '@/components/shared/section-header';
import { GLYPH, rulesHref } from '@/lib/pages';

export default function RulesPage() {
  return (
    <React.Suspense fallback={null}>
      <Rules />
    </React.Suspense>
  );
}

/**
 * Stand-in until the Rulebook (Stage 6). It keeps the one rules feature v3 had,
 * the AI lookup that lived in Spotlight, reachable from the command bar.
 */
function Rules() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useUser();
  const q = params.get('q')?.trim() ?? '';

  const [draft, setDraft] = React.useState(q);
  const [result, setResult] = React.useState<{ term: string; text: string | null; error: string | null } | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => { setDraft(q); }, [q]);

  // One lookup per term in the URL; the model call is paid for.
  React.useEffect(() => {
    if (!q || !user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await getRuleInfo(await idTokenFor(user), q);
      if (cancelled) return;
      setResult({ term: q, text: data?.explanation ?? null, error });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [q, user]);

  return (
    <div className="max-w-[1240px] mx-auto w-full px-[clamp(20px,3vw,48px)] pt-9 pb-24 flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <MonoLabel className="text-muted-foreground">{GLYPH.rule} Rules</MonoLabel>
        <h1 className="font-headline font-black uppercase leading-[0.84] text-[clamp(56px,7vw,112px)]">The Rulebook</h1>
        <p className="italic text-[21px] max-w-[46ch]">
          House rules, 5e core and conditions arrive in Stage 6. Until then, look up any rule or term.
        </p>
      </header>

      <form
        className="flex gap-2 max-w-[620px]"
        onSubmit={e => { e.preventDefault(); if (draft.trim()) router.replace(rulesHref({ q: draft.trim() })); }}
      >
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Grappling, opportunity attacks, Exhausted…"
          aria-label="Rule, condition or term"
          className="flex-1 h-[42px] px-3 bg-card border-[1.5px] border-border/30 outline-none text-[18px]"
        />
        <button type="submit" disabled={!draft.trim() || loading} className="h-[42px] px-4 border-[1.5px] border-foreground font-mono font-bold text-[12px] tracking-[0.14em] disabled:opacity-50">
          LOOK UP
        </button>
      </form>

      {(loading || result) && (
        <section className="flex flex-col gap-3 max-w-[68ch]">
          <SectionHeader glyph={GLYPH.rule} label={loading ? q : result!.term} />
          {loading ? (
            <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Looking it up…</p>
          ) : result?.error ? (
            <p className="text-destructive">{result.error}</p>
          ) : (
            result?.text && <Markdown content={result.text} className="text-[19px] leading-[1.6]" />
          )}
        </section>
      )}
    </div>
  );
}
