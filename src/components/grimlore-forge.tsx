'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SavedConcept } from '@/lib/types';
import { IdeaGenerator } from '@/components/idea-generator';
import { InspirationGenerator } from '@/components/inspiration-generator';
import { ConceptLibrary } from '@/components/concept-library';
import { Swords, Sparkles, Library, ScrollText, HelpCircle } from 'lucide-react';
import { CampaignManager } from './campaign-manager';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, doc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { DMScreen } from './dm-screen';

export function GrimloreForge() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeCampaignId, setActiveCampaignId] = React.useState<string | null>(null);
  // State for re-fetching library is managed via a key now
  const [libraryUpdateKey, setLibraryUpdateKey] = React.useState(0);

  const conceptsRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'concepts');
  }, [user, firestore]);

  const addToLibrary = (concept: Omit<SavedConcept, 'id' | 'createdAt' | 'userId'>) => {
    if (!conceptsRef || !user) {
        toast({ variant: 'destructive', title: 'Error', description: 'Not signed in.' });
        return;
    };
    
    addDocumentNonBlocking(conceptsRef, {
      ...concept,
      userId: user.uid,
      createdAt: serverTimestamp(),
    }).then(() => {
      // Instead of fetching here, we just increment the key to trigger a refetch in the child.
      setLibraryUpdateKey(key => key + 1);
      toast({ title: `Saved to Library!` });
    });
  };

  return (
    <div className="container py-8">
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-4xl mx-auto h-14 p-2 text-sm bg-black/20 rounded-xl border-white/5 border">
          <TabsTrigger value="campaigns">
            <ScrollText className="mr-2 h-4 w-4" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="generator" disabled={!activeCampaignId}>
            <Swords className="mr-2 h-4 w-4" />
            Generator
          </TabsTrigger>
          <TabsTrigger value="inspiration">
            <Sparkles className="mr-2 h-4 w-4" />
            Inspiration
          </TabsTrigger>
          <TabsTrigger value="library">
            <Library className="mr-2 h-4 w-4" />
            Library
          </TabsTrigger>
          <TabsTrigger value="dm-screen">
            <HelpCircle className="mr-2 h-4 w-4" />
            DM Screen
          </TabsTrigger>
        </TabsList>
        <TabsContent value="campaigns" className="mt-6">
          <CampaignManager activeCampaignId={activeCampaignId} setActiveCampaignId={setActiveCampaignId} />
        </TabsContent>
        <TabsContent value="generator" className="mt-6">
          {activeCampaignId ? <IdeaGenerator onSave={addToLibrary} campaignId={activeCampaignId} /> : <p>Please select a campaign first.</p>}
        </TabsContent>
        <TabsContent value="inspiration" className="mt-6">
          <InspirationGenerator onSave={addToLibrary} />
        </TabsContent>
        <TabsContent value="library" className="mt-6">
          <ConceptLibrary key={libraryUpdateKey} />
        </TabsContent>
        <TabsContent value="dm-screen" className="mt-6">
          <DMScreen />
        </TabsContent>
      </Tabs>
    </div>
  );
}
