'use client';

import * as React from 'react';
import { getSessionPrep } from '@/app/actions';
import type { SessionPrepOutput } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { Session, Character, Campaign, SessionPrepState } from '@/lib/types';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useThreadWriter, useThreads } from '@/firebase';
import { Loader2, Wand2, Copy, GitBranch, Sparkles } from 'lucide-react';

interface SessionPrepProps {
  campaignId: string;
}

export function SessionPrep({ campaignId }: SessionPrepProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  // ── Firestore data ──
  const campaignDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid, 'campaigns', campaignId);
  }, [user, firestore, campaignId]);
  const { data: campaign } = useDoc<Campaign>(campaignDocRef);

  const sessionsQuery = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return query(
      collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'sessions'),
      orderBy('sessionNumber', 'desc')
    );
  }, [user, campaignId, firestore]);
  const { data: sessions } = useCollection<Session>(sessionsQuery);

  const charactersRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'characters');
  }, [user, campaignId, firestore]);
  const { data: characters } = useCollection<Character>(charactersRef);

  // The generated prep is persisted per-campaign: it costs a model call to
  // produce and was previously discarded by switching tabs.
  const prepDocRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return doc(firestore, 'users', user.uid, 'campaigns', campaignId, 'sessionPrep', 'current');
  }, [user, firestore, campaignId]);
  const { data: storedPrep, isLoading: storedPrepLoading } = useDoc<SessionPrepState>(prepDocRef);

  // ── Form state ──
  const [sessionGoals, setSessionGoals] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [tone, setTone] = React.useState('');
  const [extraNotes, setExtraNotes] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [prep, setPrep] = React.useState<SessionPrepOutput | null>(null);

  // Restore once per mount so our own write echoing back can't overwrite a
  // newer document generated in the meantime.
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    if (hydrated || storedPrepLoading) return;
    if (storedPrep?.prep) setPrep(storedPrep.prep);
    setHydrated(true);
  }, [storedPrep, storedPrepLoading, hydrated]);

  const savePrep = React.useCallback((next: SessionPrepOutput | null) => {
    if (!prepDocRef) return;
    setDocumentNonBlocking(prepDocRef, {
      campaignId,
      prep: next,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [prepDocRef, campaignId]);

  const discardPrep = () => {
    setPrep(null);
    savePrep(null);
  };

  const nextSessionNumber = (sessions?.[0]?.sessionNumber ?? 0) + 1;

  // openThreadsToPull arrives as loose strings the flow otherwise discards.
  // Promoting them into thread documents is what lets one survive the session.
  const { data: threads } = useThreads(campaignId);
  const { promoteThreads } = useThreadWriter(campaignId);
  const [isPromoting, setIsPromoting] = React.useState(false);

  const handleTrackThreads = async () => {
    if (!prep?.openThreadsToPull?.length) return;
    setIsPromoting(true);
    await promoteThreads(prep.openThreadsToPull, threads);
    setIsPromoting(false);
    toast({ title: 'Threads tracked', description: 'Open threads are now in the Codex.' });
  };

  const handleGenerate = async () => {
    if (!sessionGoals.trim()) {
      toast({ variant: 'destructive', title: 'Add session goals', description: 'Tell me what you want to accomplish this session.' });
      return;
    }
    setIsGenerating(true);
    setPrep(null);

    const sessionLog = sessions
      ?.slice(0, 8)
      .map(s => `Session ${s.sessionNumber}: ${s.summary}`)
      .join('\n\n');

    const { data, error } = await getSessionPrep({
      campaignName: campaign?.name ?? 'Campaign',
      campaignDescription: campaign?.description,
      sessionGoals,
      location: location || undefined,
      tone: tone || undefined,
      extraNotes: extraNotes || undefined,
      sessionLog: sessionLog || undefined,
      characters: characters?.slice(0, 8).map(c => ({
        name: c.name,
        class: c.class,
        backstory: c.backstory,
      })),
      campaignSummary: campaign?.aiSummary,
    });

    setIsGenerating(false);

    if (error || !data) {
      toast({ variant: 'destructive', title: 'Could not generate prep', description: error ?? 'Try again.' });
      return;
    }

    setPrep(data);
    savePrep(data);
  };

  const copyAll = () => {
    if (!prep) return;
    const text = [
      `# ${prep.sessionTitle}`,
      '',
      `## Opening Scene\n${prep.openingScene}`,
      '',
      `## Alternate Opening\n${prep.alternateOpening}`,
      '',
      `## Complications\n${prep.complications.map(c => `• ${c.title}: ${c.description}`).join('\n')}`,
      '',
      `## NPC Motivations\n${prep.npcMotivations.map(n => `• ${n.name}: ${n.currentGoal} — ${n.howTheyActToday}`).join('\n')}`,
      '',
      `## Character Spotlights\n${prep.characterSpotlights.map(c => `• ${c.character}: ${c.opportunity}`).join('\n')}`,
      '',
      `## Open Threads\n${prep.openThreadsToPull.map(t => `• ${t}`).join('\n')}`,
      '',
      `## Prep Reminders\n${prep.prepReminders.map(r => `• ${r}`).join('\n')}`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard!' });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ── Generator form ── */}
      <section className="surface-card border-t-4 border-t-oxblood px-5 py-4">
        <div className="font-mono text-[9px] font-extrabold tracking-[0.24em] text-oxblood-bright mb-2.5">
          PREP · SESSION {nextSessionNumber}
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Textarea
            value={sessionGoals}
            onChange={e => setSessionGoals(e.target.value)}
            placeholder="What do you want to accomplish this session? *"
            className="sm:col-span-2 min-h-[72px] text-[13.5px]"
            disabled={isGenerating}
          />
          <Input value={location} onChange={e => setLocation(e.target.value)}
            placeholder="Where does it start?" disabled={isGenerating} className="text-[13px]" />
          <Input value={tone} onChange={e => setTone(e.target.value)}
            placeholder="Tone — tense, comic, elegiac…" disabled={isGenerating} className="text-[13px]" />
          <Textarea
            value={extraNotes}
            onChange={e => setExtraNotes(e.target.value)}
            placeholder="Anything else I should know?"
            className="sm:col-span-2 min-h-[56px] text-[13px]"
            disabled={isGenerating}
          />
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Button onClick={handleGenerate} disabled={isGenerating || !sessionGoals.trim()} size="sm">
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-2" />}
            Generate beats
          </Button>
          {prep && (
            <>
              <Button variant="outline" size="sm" onClick={copyAll}>
                <Copy className="h-3.5 w-3.5 mr-2" /> Copy all
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="ml-auto text-bone-faint hover:text-oxblood-bright">
                    Discard
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Discard this prep document?</AlertDialogTitle>
                    <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={discardPrep} className="bg-destructive text-destructive-foreground">
                      Discard
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </section>

      {isGenerating && (
        <div className="surface-card px-5 py-10 flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-oxblood-bright" />
          <p className="label-forge">Forging the session…</p>
        </div>
      )}

      {prep && !isGenerating && (
        <>
          <h2 className="font-headline text-[27px] font-bold uppercase tracking-[0.02em] text-bone mt-1">
            {prep.sessionTitle}
          </h2>

          {/* ── Opening scene ── */}
          <section className="surface-card border-t-4 border-t-oxblood px-5 py-[18px] animate-rise">
            <div className="font-mono text-[9px] font-extrabold tracking-[0.24em] text-oxblood-bright mb-2.5">
              OPENING SCENE
            </div>
            <p className="m-0 mb-3.5 text-[14px] leading-[1.62] text-bone-soft">{prep.openingScene}</p>
            <div className="h-px bg-border/[0.08] mb-3" />
            <div className="font-mono text-[8.5px] font-extrabold tracking-[0.2em] text-bone-faint mb-1.5">
              ALTERNATE OPENING
            </div>
            <p className="m-0 text-[13.5px] leading-[1.6] text-bone-dim">{prep.alternateOpening}</p>
          </section>

          {/* ── Complications ── */}
          <SectionHead label="COMPLICATIONS" />
          <div className="flex flex-col gap-2">
            {prep.complications.map((c, i) => (
              <div key={c.title + i} className="surface-card surface-card-hover px-[17px] py-[15px] animate-rise"
                   style={{ animationDelay: `${(0.2 + i * 0.07).toFixed(2)}s` }}>
                <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-3">
                  <span className="font-mono text-[15px] font-extrabold text-oxblood">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <div className="font-headline text-[16px] font-bold uppercase text-bone-body mb-1.5">
                      {c.title}
                    </div>
                    <p className="m-0 text-[13px] leading-[1.55] text-bone-dim">{c.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── NPC motivations ── */}
          <SectionHead label="NPC MOTIVATIONS TODAY" />
          <div className="flex flex-col gap-2">
            {prep.npcMotivations.map((n, i) => (
              <div key={n.name + i} className="surface-card px-[17px] py-[15px] animate-rise"
                   style={{ animationDelay: `${(0.2 + i * 0.07).toFixed(2)}s` }}>
                <div className="font-headline text-[16px] font-bold uppercase text-bone-body mb-2">
                  {n.name}
                </div>
                <div className="grid grid-cols-[58px_minmax(0,1fr)] gap-x-3 gap-y-1.5">
                  <span className="font-mono text-[8.5px] font-extrabold tracking-[0.18em] text-oxblood-bright pt-0.5">GOAL</span>
                  <span className="text-[13px] leading-[1.5] text-bone-soft">{n.currentGoal}</span>
                  <span className="font-mono text-[8.5px] font-extrabold tracking-[0.18em] text-bone-faint pt-0.5">TODAY</span>
                  <span className="text-[13px] leading-[1.5] text-bone-dim">{n.howTheyActToday}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Character spotlights ── */}
          {prep.characterSpotlights.length > 0 && (
            <>
              <SectionHead label="CHARACTER SPOTLIGHTS" />
              <div className="surface-card">
                {prep.characterSpotlights.map((cs, i) => (
                  <div key={cs.character + i}
                       className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 px-4 py-[11px] items-baseline border-b border-border/[0.05] last:border-b-0">
                    <span className="text-[13px] text-bone-body">{cs.character}</span>
                    <span className="text-[13px] leading-[1.5] text-bone-dim">{cs.opportunity}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Open threads ── */}
          {prep.openThreadsToPull.length > 0 && (
            <>
              <SectionHead label="OPEN THREADS TO PULL">
                <button
                  onClick={handleTrackThreads}
                  disabled={isPromoting}
                  className="font-mono text-[9px] font-bold tracking-[0.14em] uppercase px-2 py-1
                             border border-border/[0.12] text-bone-faint hover:text-bone-dim hover:border-oxblood
                             transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isPromoting ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitBranch className="h-3 w-3" />}
                  Track these
                </button>
              </SectionHead>
              <div className="surface-card px-4 py-3 flex flex-col gap-2">
                {prep.openThreadsToPull.map((t, i) => (
                  <div key={i} className="flex gap-2.5">
                    <span className="text-oxblood-bright flex-shrink-0 text-[13px]">→</span>
                    <span className="text-[13px] leading-[1.55] text-bone-soft">{t}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Prep reminders ── */}
          {prep.prepReminders.length > 0 && (
            <>
              <SectionHead label="PREP REMINDERS" />
              <div className="surface-card px-4 py-3 flex flex-col gap-2">
                {prep.prepReminders.map((r, i) => (
                  <div key={i} className="flex gap-2.5">
                    <span className="text-brass flex-shrink-0 text-[13px]">→</span>
                    <span className="text-[13px] leading-[1.55] text-bone-soft">{r}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {!prep && !isGenerating && (
        <div className="surface-card px-5 py-12 text-center">
          <Sparkles className="h-6 w-6 mx-auto text-oxblood/60 mb-3" />
          <p className="text-[13px] text-bone-faint max-w-[42ch] mx-auto leading-relaxed">
            Describe what you want from the session and the forge will draft an opening,
            complications, NPC motivations, and beats to hit.
          </p>
        </div>
      )}
    </div>
  );
}

/** Section rule used between blocks of the prep document. */
function SectionHead({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mt-4 mb-1">
      <span className="font-mono text-[10px] font-extrabold tracking-[0.3em] text-bone-faint">{label}</span>
      <span className="flex-1 h-[3px] bg-[hsl(var(--border)/0.06)]" />
      {children}
    </div>
  );
}
