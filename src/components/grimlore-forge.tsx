'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SavedConcept } from '@/lib/types';
import { IdeaGenerator } from '@/components/idea-generator';
import { InspirationGenerator } from '@/components/inspiration-generator';
import { ConceptLibrary } from '@/components/concept-library';
import { LiveSession } from '@/components/live-session';
import { Swords, Sparkles, Library, ScrollText, HelpCircle, Zap } from 'lucide-react';
import { CampaignManager } from './campaign-manager';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { DMScreen } from './dm-screen';
import { cn } from '@/lib/utils';

export function GrimloreForge() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeCampaignId, setActiveCampaignId] = React.useState<string | null>(null);
  const [libraryUpdateKey, setLibraryUpdateKey] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState('campaigns');

  const conceptsRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'concepts');
  }, [user, firestore]);

  const addToLibrary = (concept: Omit<SavedConcept, 'id' | 'createdAt' | 'userId'>) => {
    if (!conceptsRef || !user) {
      toast({ variant: 'destructive', title: 'Error', description: 'Not signed in.' });
      return;
    }
    addDocumentNonBlocking(conceptsRef, {
      ...concept,
      userId: user.uid,
      createdAt: serverTimestamp(),
    })
      .then(() => {
        setLibraryUpdateKey(key => key + 1);
        toast({ title: 'Saved to Library!' });
      })
      .catch(error => {
        console.error('Error saving concept:', error);
        toast({ variant: 'destructive', title: 'Could not save concept', description: 'Check your connection or permissions and try again.' });
      });
  };

  return (
    <div className="container py-8">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 max-w-4xl mx-auto h-14 p-2 text-sm bg-black/20 rounded-xl border-white/5 border">

          <TabsTrigger value="campaigns">
            <ScrollText className="mr-2 h-4 w-4" />
            Campaigns
          </TabsTrigger>

          {/* Live Session — prominent, highlighted */}
          <TabsTrigger
            value="live"
            disabled={!activeCampaignId}
            className={cn(
              'relative',
              activeTab === 'live' && 'text-accent'
            )}
          >
            <Zap className="mr-2 h-4 w-4" />
            Live
            {/* Pulse dot to draw attention */}
            {activeCampaignId && activeTab !== 'live' && (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            )}
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
            Rules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-6">
          <CampaignManager
            activeCampaignId={activeCampaignId}
            setActiveCampaignId={(id) => {
              setActiveCampaignId(id);
              // Auto-navigate to Live tab when a campaign is selected
              if (id) setActiveTab('live');
            }}
          />
        </TabsContent>

        <TabsContent value="live" className="mt-6">
          {activeCampaignId ? (
            <LiveSession campaignId={activeCampaignId} />
          ) : (
            <p className="text-center text-muted-foreground py-12">
              Select a campaign to start your live session assistant.
            </p>
          )}
        </TabsContent>

        <TabsContent value="generator" className="mt-6">
          {activeCampaignId ? (
            <IdeaGenerator onSave={addToLibrary} campaignId={activeCampaignId} />
          ) : (
            <p className="text-center text-muted-foreground py-12">Please select a campaign first.</p>
          )}
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
