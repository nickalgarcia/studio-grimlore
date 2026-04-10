'use client';

import * as React from 'react';
import { getSessionPrep } from '@/app/actions';
import type { SessionPrepOutput } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { Session, Character, Campaign } from '@/lib/types';
import {
  Loader2, Wand2, ChevronDown, ChevronUp, Copy,
  Drama, Zap, User, ScrollText, Brain, Bookmark
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SessionPrepProps {
  campaignId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible section used throughout the prep document
// ─────────────────────────────────────────────────────────────────────────────
function PrepSection({
  icon, title, children, defaultOpen = true, accent = false,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accent?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={cn(
      'rounded-lg border overflow-hidden',
      accent ? 'border-primary/25 bg-primary/4' : 'border-border bg-card'
    )}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/3 transition-colors"
      >
        <span className={accent ? 'text-primary' : 'text-accent'}>{icon}</span>
        <span className="font-headline text-sm tracking-wide flex-1">{title}</span>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-border/50">
          {children}
        </div>
      )}
    </div>
  );
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

  // ── Form state ──
  const [sessionGoals, setSessionGoals] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [tone, setTone] = React.useState('');
  const [extraNotes, setExtraNotes] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [prep, setPrep] = React.useState<SessionPrepOutput | null>(null);

  const nextSessionNumber = (sessions?.[0]?.sessionNumber ?? 0) + 1;

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
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="font-headline text-3xl font-bold">Session Prep</h2>
        <p className="text-muted-foreground text-base">
          Session {nextSessionNumber} — {campaign?.name ?? '...'}
        </p>
      </div>

      {/* Input form */}
      {!prep && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-headline text-lg">What do you need for Session {nextSessionNumber}?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="label-forge mb-2 block">Session Goals *</label>
              <Textarea
                value={sessionGoals}
                onChange={e => setSessionGoals(e.target.value)}
                placeholder="What do you want to accomplish? e.g. 'Introduce the Circle of Sundering agent in Mirathen, give Doc a consequence for the pickpocket incident, move the party toward the ruins district'"
                className="min-h-[100px] text-base font-body"
                disabled={isGenerating}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-forge mb-2 block">Location</label>
                <Input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Mirathen, Broken Bell Tavern"
                  className="text-base"
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className="label-forge mb-2 block">Tone</label>
                <Input
                  value={tone}
                  onChange={e => setTone(e.target.value)}
                  placeholder="e.g. tense investigation, action-heavy"
                  className="text-base"
                  disabled={isGenerating}
                />
              </div>
            </div>

            <div>
              <label className="label-forge mb-2 block">DM Notes (optional)</label>
              <Textarea
                value={extraNotes}
                onChange={e => setExtraNotes(e.target.value)}
                placeholder="Player absent? Things to avoid? Pacing notes?"
                className="min-h-[70px] text-base font-body"
                disabled={isGenerating}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !sessionGoals.trim()}
              className="w-full h-12 text-base font-headline tracking-wide"
            >
              {isGenerating
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing Session {nextSessionNumber}...</>
                : <><Wand2 className="mr-2 h-4 w-4" />Generate Prep Document</>}
            </Button>

            {isGenerating && (
              <p className="text-center text-sm text-muted-foreground italic animate-pulse">
                Reading your campaign history and crafting the prep document...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Generated prep document */}
      {prep && (
        <div className="space-y-4 animate-in fade-in">

          {/* Title bar */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-headline text-2xl text-accent">{prep.sessionTitle}</h3>
              <p className="text-sm text-muted-foreground">Session {nextSessionNumber} Prep</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyAll}>
                <Copy className="h-3.5 w-3.5 mr-2" />Copy All
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPrep(null)}>
                Start Over
              </Button>
            </div>
          </div>

          {/* Opening Scenes */}
          <PrepSection icon={<Drama className="h-4 w-4" />} title="Opening Scene" accent>
            <p className="text-base leading-relaxed text-foreground/90 font-body mt-2">{prep.openingScene}</p>
            {prep.alternateOpening && (
              <div className="mt-4 pt-4 border-t border-primary/15">
                <p className="label-forge mb-2">Alternate Opening</p>
                <p className="text-base leading-relaxed text-foreground/70 font-body italic">{prep.alternateOpening}</p>
              </div>
            )}
          </PrepSection>

          {/* Complications */}
          <PrepSection icon={<Zap className="h-4 w-4" />} title="Complications">
            <div className="space-y-4 mt-2">
              {prep.complications.map((c, i) => (
                <div key={i} className="flex gap-3">
                  <span className="font-headline text-xs text-accent/60 pt-1 w-4 flex-shrink-0">{i + 1}</span>
                  <div>
                    <p className="font-headline text-sm text-foreground/90 mb-0.5">{c.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed font-body">{c.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </PrepSection>

          {/* NPC Motivations */}
          {prep.npcMotivations.length > 0 && (
            <PrepSection icon={<User className="h-4 w-4" />} title="NPC Motivations Today">
              <div className="space-y-4 mt-2">
                {prep.npcMotivations.map((n, i) => (
                  <div key={i} className="border-l-2 border-accent/20 pl-4">
                    <p className="font-headline text-sm text-accent/80 mb-1">{n.name}</p>
                    <p className="text-sm text-foreground/80 font-body"><span className="text-muted-foreground">Goal: </span>{n.currentGoal}</p>
                    <p className="text-sm text-foreground/70 font-body italic mt-0.5">{n.howTheyActToday}</p>
                  </div>
                ))}
              </div>
            </PrepSection>
          )}

          {/* Character Spotlights */}
          {prep.characterSpotlights.length > 0 && (
            <PrepSection icon={<Drama className="h-4 w-4" />} title="Character Spotlights">
              <div className="space-y-3 mt-2">
                {prep.characterSpotlights.map((c, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-accent/50 pt-0.5">•</span>
                    <div>
                      <span className="font-headline text-sm text-foreground/90">{c.character}: </span>
                      <span className="text-sm text-muted-foreground font-body">{c.opportunity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </PrepSection>
          )}

          {/* Open Threads */}
          {prep.openThreadsToPull.length > 0 && (
            <PrepSection icon={<ScrollText className="h-4 w-4" />} title="Open Threads to Pull">
              <ul className="space-y-2 mt-2">
                {prep.openThreadsToPull.map((t, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="text-accent/50 pt-0.5 flex-shrink-0">◈</span>
                    <span className="text-foreground/80 font-body leading-relaxed">{t}</span>
                  </li>
                ))}
              </ul>
            </PrepSection>
          )}

          {/* Prep Reminders */}
          <PrepSection icon={<Brain className="h-4 w-4" />} title="Prep Reminders" defaultOpen>
            <ul className="space-y-2 mt-2">
              {prep.prepReminders.map((r, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="text-primary/60 pt-0.5 flex-shrink-0">→</span>
                  <span className="text-foreground/85 font-body leading-relaxed">{r}</span>
                </li>
              ))}
            </ul>
          </PrepSection>

        </div>
      )}
    </div>
  );
}
