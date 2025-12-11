'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { getContextualIdeas } from '@/app/actions';
import type { GenerateContextSensitiveIdeasOutput } from '@/ai/flows/generate-context-sensitive-ideas';
import type { SavedConcept, Campaign } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Swords, BookMarked, Copy, Loader2, Skull, Scroll, User, Quote } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { Session } from '@/lib/types';

type IdeaGeneratorProps = {
  onSave: (concept: Omit<SavedConcept, 'id' | 'createdAt' | 'userId'>) => void;
  campaignId: string;
};

export function IdeaGenerator({ onSave, campaignId }: IdeaGeneratorProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [partyActions, setPartyActions] = React.useState('');
  const [generatedIdeas, setGeneratedIdeas] = React.useState<GenerateContextSensitiveIdeasOutput | null>(null);

  const { user } = useUser();
  const firestore = useFirestore();
  
  const campaignDocRef = useMemoFirebase(() => {
      if (!user) return null;
      return doc(firestore, 'users', user.uid, 'campaigns', campaignId);
  }, [user, firestore, campaignId]);
  const {data: campaign} = useDoc<Campaign>(campaignDocRef);

  const sessionsQuery = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return query(
        collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'sessions'), 
        orderBy('sessionNumber', 'desc')
    );
  }, [user, campaignId, firestore]);
  
  const { data: sessions, isLoading: sessionsLoading } = useCollection<Session>(sessionsQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratedIdeas(null);

    const campaignLog = sessions?.map(s => `Session ${s.sessionNumber}: ${s.summary}`).join('\n\n') || '';
    const campaignContext = campaign ? `Campaign: ${campaign.name}\nDescription: ${campaign.description}\n\n` : '';

    let fullContext = `${campaignContext}Campaign Log:\n${campaignLog}\n\n`;
    fullContext += `Recent Party Actions:\n${partyActions}`;

    startTransition(async () => {
      const { data, error } = await getContextualIdeas(fullContext);
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error,
        });
      } else if (data) {
        setGeneratedIdeas(data);
      }
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard!' });
  };
  
  const getContextForSaving = () => {
      if (campaign?.name) {
          return campaign.name;
      }
      return partyActions.substring(0, 50) + (partyActions.length > 50 ? '...' : '');
  }

  const isLoading = isPending || sessionsLoading;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-4xl font-headline font-bold">Idea Generator</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Describe your party's latest shenanigans, and the Grimlore will forge new adventures from the chaos, using your campaign log for context.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-4">
        <Textarea
          placeholder="e.g., The party just burned down the tavern after a misunderstanding with the local thieves' guild..."
          value={partyActions}
          onChange={(e) => setPartyActions(e.target.value)}
          className="min-h-[120px] text-base"
          disabled={isLoading}
        />
        <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading || !partyActions}>
          {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Swords className="mr-2 h-5 w-5" />}
          Forge Ideas
        </Button>
      </form>

      {(isPending || generatedIdeas) && (
        <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
          {isPending ? (
            <>
              <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div></CardContent></Card>
              <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div></CardContent></Card>
              <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div></CardContent></Card>
              <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div></CardContent></Card>
            </>
          ) : generatedIdeas && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 font-headline"><Scroll className="h-6 w-6 text-accent" />Plot Hook</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{generatedIdeas.plotHook}</p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onSave({ type: 'Plot Hook', content: generatedIdeas.plotHook, context: getContextForSaving() })}><BookMarked className="mr-2 h-4 w-4"/>Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(generatedIdeas.plotHook)}><Copy className="mr-2 h-4 w-4"/>Copy</Button>
                </CardFooter>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 font-headline"><Skull className="h-6 w-6 text-accent" />Encounter Idea</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{generatedIdeas.encounterIdea}</p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onSave({ type: 'Encounter Idea', content: generatedIdeas.encounterIdea, context: getContextForSaving() })}><BookMarked className="mr-2 h-4 w-4"/>Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(generatedIdeas.encounterIdea)}><Copy className="mr-2 h-4 w-4"/>Copy</Button>
                </CardFooter>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 font-headline"><User className="h-6 w-6 text-accent" />NPC Concept</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{generatedIdeas.npcConcept}</p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onSave({ type: 'NPC Concept', content: generatedIdeas.npcConcept, context: getContextForSaving() })}><BookMarked className="mr-2 h-4 w-4"/>Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(generatedIdeas.npcConcept)}><Copy className="mr-2 h-4 w-4"/>Copy</Button>
                </CardFooter>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 font-headline"><Quote className="h-6 w-6 text-accent" />Dialog Idea</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{generatedIdeas.dialogIdea}</p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onSave({ type: 'Dialog', content: generatedIdeas.dialogIdea, context: getContextForSaving() })}><BookMarked className="mr-2 h-4 w-4"/>Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(generatedIdeas.dialogIdea)}><Copy className="mr-2 h-4 w-4"/>Copy</Button>
                </CardFooter>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
