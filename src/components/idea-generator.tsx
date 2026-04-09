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
import { Swords, BookMarked, Copy, Loader2, Skull, Scroll, User, Quote, Lightbulb } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { Session, Character } from '@/lib/types';

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
  const { data: campaign } = useDoc<Campaign>(campaignDocRef);

  const sessionsQuery = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return query(
      collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'sessions'),
      orderBy('sessionNumber', 'desc')
    );
  }, [user, campaignId, firestore]);
  const { data: sessions, isLoading: sessionsLoading } = useCollection<Session>(sessionsQuery);

  const charactersRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'characters');
  }, [user, campaignId, firestore]);
  const { data: characters, isLoading: charactersLoading } = useCollection<Character>(charactersRef);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratedIdeas(null);

    // Build the full session log — all sessions, not just 3
    const sessionLog = (sessions ?? [])
      .map(s => `Session ${s.sessionNumber}: ${s.summary}`)
      .join('\n\n') || undefined;

    // Map characters to the shape the flow expects
    const characterList = (characters ?? []).slice(0, 8).map(c => ({
      name: c.name,
      class: c.class,
      species: c.species,
      backstory: c.backstory,
    }));

    startTransition(async () => {
      const { data, error } = await getContextualIdeas({
        partyActions,
        campaignName: campaign?.name,
        campaignDescription: campaign?.description,
        sessionLog,
        characters: characterList.length > 0 ? characterList : undefined,
      });

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error });
      } else if (data) {
        setGeneratedIdeas(data);
      }
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard!' });
  };

  const getSaveContext = () =>
    campaign?.name ?? partyActions.substring(0, 50) + (partyActions.length > 50 ? '...' : '');

  const isLoading = isPending || sessionsLoading || charactersLoading;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-4xl font-headline font-bold">Idea Generator</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Describe what's happening at the table. The Grimlore will forge ideas grounded in your campaign's world, characters, and history.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-4">
        <Textarea
          placeholder="e.g., The party just burned down the tavern after a misunderstanding with the local thieves' guild..."
          value={partyActions}
          onChange={e => setPartyActions(e.target.value)}
          className="min-h-[120px] text-base"
          disabled={isLoading}
        />
        <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading || !partyActions}>
          {isLoading
            ? <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            : <Swords className="mr-2 h-5 w-5" />}
          Forge Ideas
        </Button>
      </form>

      {(isPending || generatedIdeas) && (
        <div className="grid md:grid-cols-2 gap-6 max-w-7xl mx-auto">
          {isPending ? (
            <>
              {[0, 1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                  <CardContent><div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div></CardContent>
                </Card>
              ))}
            </>
          ) : generatedIdeas && (
            <>
              <IdeaCard
                icon={<Scroll className="h-6 w-6 text-accent" />}
                title="Plot Hook"
                content={generatedIdeas.plotHook}
                onSave={() => onSave({ type: 'Plot Hook', content: generatedIdeas.plotHook, context: getSaveContext() })}
                onCopy={() => handleCopy(generatedIdeas.plotHook)}
              />
              <IdeaCard
                icon={<Skull className="h-6 w-6 text-accent" />}
                title="Encounter Idea"
                content={generatedIdeas.encounterIdea}
                onSave={() => onSave({ type: 'Encounter Idea', content: generatedIdeas.encounterIdea, context: getSaveContext() })}
                onCopy={() => handleCopy(generatedIdeas.encounterIdea)}
              />
              <IdeaCard
                icon={<User className="h-6 w-6 text-accent" />}
                title="NPC Concept"
                content={generatedIdeas.npcConcept}
                onSave={() => onSave({ type: 'NPC Concept', content: generatedIdeas.npcConcept, context: getSaveContext() })}
                onCopy={() => handleCopy(generatedIdeas.npcConcept)}
              />
              <IdeaCard
                icon={<Quote className="h-6 w-6 text-accent" />}
                title="Dialog Idea"
                content={generatedIdeas.dialogIdea}
                onSave={() => onSave({ type: 'Dialog', content: generatedIdeas.dialogIdea, context: getSaveContext() })}
                onCopy={() => handleCopy(generatedIdeas.dialogIdea)}
              />
              {/* New: DM Note card — private insight only shown here, not saveable as a concept type */}
              {generatedIdeas.dmNote && (
                <Card className="md:col-span-2 border-accent/20 bg-accent/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 font-headline text-accent/80">
                      <Lightbulb className="h-5 w-5" />
                      DM Note
                      <span className="text-xs font-normal text-muted-foreground ml-1">(private — not saveable)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground/80 italic">{generatedIdeas.dmNote}</p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="ghost" size="sm" onClick={() => handleCopy(generatedIdeas.dmNote!)}>
                      <Copy className="mr-2 h-4 w-4" />Copy
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable idea card
// ─────────────────────────────────────────────────────────────────────────────

function IdeaCard({
  icon, title, content, onSave, onCopy,
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
  onSave: () => void;
  onCopy: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 font-headline">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{content}</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="secondary" size="sm" onClick={onSave}>
          <BookMarked className="mr-2 h-4 w-4" />Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onCopy}>
          <Copy className="mr-2 h-4 w-4" />Copy
        </Button>
      </CardFooter>
    </Card>
  );
}
