'use client';

import * as React from 'react';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { getCampaignSummary } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  BrainCircuit, Download, Loader2, PlusCircle, Quote, RefreshCw, Scroll, Skull, Sparkles, User,
} from 'lucide-react';
import { generateCampaignExport, downloadMarkdown } from '@/lib/campaign-export';
import { conceptInCampaign } from '@/lib/codex';
import type { UseCodexEntriesResult } from '@/components/codex/use-codex-entries';
import type { Campaign, SavedConcept } from '@/lib/types';

const iconMap: Record<string, React.ReactElement> = {
  'Plot Hook': <Scroll className="h-4 w-4 text-accent" />,
  'Encounter Idea': <Skull className="h-4 w-4 text-accent" />,
  'NPC Concept': <User className="h-4 w-4 text-accent" />,
  'Dialog': <Quote className="h-4 w-4 text-accent" />,
  'Inspiration': <Sparkles className="h-4 w-4 text-accent" />,
};

export function CampaignOverview({
  campaign, codex,
}: {
  campaign: Campaign;
  /**
   * Reuses the shell's codex subscriptions. Querying sessions, characters,
   * npcs, locations and concepts again here would be five more listeners over
   * data already streaming one component up.
   */
  codex: UseCodexEntriesResult;
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const campaignDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid, 'campaigns', campaign.id);
  }, [user, firestore, campaign.id]);
  const { data: campaignData } = useDoc<Campaign>(campaignDocRef);
  const currentCampaign = campaignData || campaign;

  const sessionsCollectionRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaign.id, 'sessions');
  }, [user, firestore, campaign.id]);

  // The codex index streams sessions newest-first; summary generation and the
  // export both want oldest-first, so sort a copy rather than open a second
  // ordered query.
  const sessions = React.useMemo(
    () => [...(codex.raw.sessions ?? [])].sort((a, b) => a.sessionNumber - b.sessionNumber),
    [codex.raw.sessions],
  );
  const characters = codex.raw.characters;
  const npcs = codex.raw.npcs;
  const locations = codex.raw.locations;
  const isDataLoading = codex.isLoading;

  // Same rule as the Codex — see conceptInCampaign.
  const campaignConcepts = React.useMemo(
    () => (codex.raw.concepts ?? []).filter(c => conceptInCampaign(c.context, campaign.name)),
    [codex.raw.concepts, campaign.name],
  );

  const groupedConcepts = React.useMemo(() => {
    return (campaignConcepts ?? []).reduce((acc, concept) => {
      (acc[concept.type] = acc[concept.type] || []).push(concept);
      return acc;
    }, {} as Record<string, SavedConcept[]>);
  }, [campaignConcepts]);

  const [newSessionSummary, setNewSessionSummary] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);
  const [isSummarizing, setIsSummarizing] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  /**
   * Logging a session used to fire a full campaign-summary model call on every
   * save — one AI request per keystroke-worth-of-notes you committed. The write
   * and the summary are now separate actions; the summary is the button below.
   */
  const handleAddSession = async () => {
    if (!sessionsCollectionRef || !newSessionSummary.trim()) return;
    setIsCreating(true);

    const nextSessionNumber =
      sessions.reduce((max, s) => Math.max(max, s.sessionNumber), 0) + 1;

    try {
      await addDocumentNonBlocking(sessionsCollectionRef, {
        campaignId: campaign.id,
        sessionNumber: nextSessionNumber,
        date: serverTimestamp(),
        summary: newSessionSummary,
      });
      setNewSessionSummary('');
      toast({
        title: `Session ${nextSessionNumber} logged`,
        description: 'Update the story summary when you are ready.',
      });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save session log.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRegenerateSummary = async () => {
    if (!campaignDocRef || !characters) return;
    if (sessions.length === 0) {
      toast({ title: 'Nothing to summarize yet', description: 'Log a session first.' });
      return;
    }
    setIsSummarizing(true);

    const { data, error } = await getCampaignSummary({
      campaignName: campaign.name,
      campaignDescription: campaign.description,
      sessions: sessions.map(s => ({ sessionNumber: s.sessionNumber, summary: s.summary })),
      characters: characters.map(c => ({
        name: c.name, class: c.class, species: c.species, backstory: c.backstory,
      })),
    });

    setIsSummarizing(false);

    if (!data?.campaignSummary) {
      toast({ variant: 'destructive', title: 'Could not update summary', description: error ?? 'Try again.' });
      return;
    }

    updateDocumentNonBlocking(campaignDocRef, { aiSummary: data.campaignSummary })
      .then(() => toast({ title: 'Campaign summary updated' }))
      .catch(() => toast({ variant: 'destructive', title: 'Could not save summary' }));
  };

  const handleExport = () => {
    if (isDataLoading) {
      toast({ title: 'Still loading…', description: 'Wait a moment and try again.' });
      return;
    }
    const sessionList = sessions ?? [];
    if (sessionList.length === 0) {
      toast({ variant: 'destructive', title: 'No sessions found', description: 'Log a session before exporting.' });
      return;
    }

    setIsExporting(true);
    try {
      const markdown = generateCampaignExport({
        campaign: currentCampaign,
        sessions: sessionList,
        characters: characters ?? [],
        npcs: npcs ?? [],
        locations: locations ?? [],
      });
      const filename = `${campaign.name.replace(/[^a-z0-9]/gi, '_')}_Session${sessionList.length}_export.md`;
      downloadMarkdown(markdown, filename);
      toast({
        title: `Campaign exported — ${sessionList.length} sessions`,
        description: 'Drag the file into your Claude project to update context.',
      });
    } catch {
      toast({ variant: 'destructive', title: 'Export failed', description: 'Please try again.' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6 items-start">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="font-headline text-2xl flex items-center gap-3">
                  <BrainCircuit className="h-6 w-6 text-accent" /> The Story So Far
                </CardTitle>
                <CardDescription>An AI-generated summary of your campaign&apos;s progress.</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline" size="sm"
                  onClick={handleRegenerateSummary}
                  disabled={isSummarizing || isDataLoading}
                >
                  {isSummarizing
                    ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
                  Update summary
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
                  {isExporting
                    ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    : <Download className="h-3.5 w-3.5 mr-2" />}
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="font-body text-base">
            {currentCampaign.aiSummary ? (
              <p className="whitespace-pre-wrap pt-2 leading-relaxed">{currentCampaign.aiSummary}</p>
            ) : (
              <p className="text-muted-foreground">
                No summary yet. Log a session, then choose &ldquo;Update summary&rdquo;.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Log New Session</CardTitle>
            <CardDescription className="font-body tracking-wider">
              Add notes from your latest adventure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Summarize the events of your latest session..."
              value={newSessionSummary}
              onChange={e => setNewSessionSummary(e.target.value)}
              className="min-h-[100px] font-body text-base"
              disabled={isCreating}
            />
          </CardContent>
          <CardFooter>
            <Button onClick={handleAddSession} disabled={isCreating || !newSessionSummary.trim()}>
              {isCreating
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <PlusCircle className="mr-2 h-4 w-4" />}
              {isCreating ? 'Logging...' : 'Log Session'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card className="sticky top-24">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Campaign Ideas</CardTitle>
          <CardDescription className="font-body tracking-wider">Generated for this campaign.</CardDescription>
        </CardHeader>
        <CardContent className="font-body">
          {(campaignConcepts?.length ?? 0) > 0 ? (
            <div className="space-y-6">
              {Object.entries(groupedConcepts).map(([type, concepts]) => (
                <div key={type}>
                  <h4 className="font-headline flex items-center gap-2 mb-2 text-lg">
                    {iconMap[type]} {type}s
                  </h4>
                  <div className="space-y-3 text-sm border-l-2 border-accent/20 pl-4 ml-2">
                    {concepts.map(c => (
                      <p key={c.id} className="text-muted-foreground">{c.content}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No ideas saved yet. Use Generate.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
