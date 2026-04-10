'use client';

import * as React from 'react';
import { IdeaGenerator } from '@/components/idea-generator';
import { InspirationGenerator } from '@/components/inspiration-generator';
import { ConceptLibrary } from '@/components/concept-library';
import { LiveSession } from '@/components/live-session';
import { SessionSidebar } from '@/components/session-sidebar';
import { SessionPrep } from '@/components/session-prep';
import { DMScreen } from '@/components/dm-screen';
import { CampaignManager } from './campaign-manager';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import type { SavedConcept } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Zap, Swords, ScrollText, Sparkles, Library, HelpCircle, ClipboardList } from 'lucide-react';

type TabId = 'live' | 'prep' | 'generator' | 'campaigns' | 'inspiration' | 'library' | 'rules';

const TABS: { id: TabId; label: string; icon: React.ReactNode; requiresCampaign?: boolean }[] = [
  { id: 'live',        label: 'Live Session', icon: <Zap className="h-3.5 w-3.5" />,            requiresCampaign: true },
  { id: 'prep',        label: 'Prep',         icon: <ClipboardList className="h-3.5 w-3.5" />,   requiresCampaign: true },
  { id: 'generator',  label: 'Generator',    icon: <Swords className="h-3.5 w-3.5" />,          requiresCampaign: true },
  { id: 'campaigns',  label: 'Campaigns',    icon: <ScrollText className="h-3.5 w-3.5" /> },
  { id: 'inspiration',label: 'Inspiration',  icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: 'library',    label: 'Library',      icon: <Library className="h-3.5 w-3.5" /> },
  { id: 'rules',      label: 'Rules',        icon: <HelpCircle className="h-3.5 w-3.5" /> },
];

const SIDEBAR_TABS: TabId[] = ['live', 'prep', 'generator'];

export function GrimloreForge() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<TabId>('campaigns');
  const [activeCampaignId, setActiveCampaignId] = React.useState<string | null>(null);
  const [libraryUpdateKey, setLibraryUpdateKey] = React.useState(0);

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
      .then(() => { setLibraryUpdateKey(k => k + 1); toast({ title: 'Saved to Library!' }); })
      .catch(() => { toast({ variant: 'destructive', title: 'Could not save concept' }); });
  };

  const handleCampaignSelect = (id: string | null) => {
    setActiveCampaignId(id);
    if (id) setActiveTab('live');
  };

  const handleTabClick = (tab: TabId) => {
    if (TABS.find(t => t.id === tab)?.requiresCampaign && !activeCampaignId) {
      setActiveTab('campaigns');
      toast({ title: 'Select a campaign first' });
      return;
    }
    setActiveTab(tab);
  };

  const showSidebar = SIDEBAR_TABS.includes(activeTab) && !!activeCampaignId;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Nav */}
      <nav className="border-b border-primary/10 bg-background/80 backdrop-blur sticky top-16 z-40">
        <div className="container">
          <div className="flex items-end gap-0 overflow-x-auto">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              const isDisabled = !!tab.requiresCampaign && !activeCampaignId;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={cn(
                    'relative flex items-center gap-2 px-5 py-3.5 font-headline text-[0.65rem] tracking-[0.12em] uppercase transition-all border-b-2 whitespace-nowrap',
                    isActive
                      ? 'text-accent border-accent'
                      : isDisabled
                        ? 'text-muted-foreground/30 border-transparent cursor-not-allowed'
                        : 'text-muted-foreground/60 border-transparent hover:text-foreground/80 hover:border-primary/30'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.id === 'live' && activeCampaignId && !isActive && (
                    <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary animate-forge-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Body */}
      <div className="flex flex-1 min-h-0 container px-0">
        {showSidebar && <SessionSidebar campaignId={activeCampaignId!} />}
        <main className={cn('flex-1 overflow-y-auto', showSidebar ? 'px-8 py-6' : 'px-4 py-8')}>
          {activeTab === 'live' && (
            activeCampaignId
              ? <LiveSession campaignId={activeCampaignId} />
              : <EmptyState message="Select a campaign to start your live session assistant." />
          )}
          {activeTab === 'prep' && (
            activeCampaignId
              ? <SessionPrep campaignId={activeCampaignId} />
              : <EmptyState message="Select a campaign to generate session prep." />
          )}
          {activeTab === 'generator' && (
            activeCampaignId
              ? <IdeaGenerator onSave={addToLibrary} campaignId={activeCampaignId} />
              : <EmptyState message="Select a campaign to use the idea generator." />
          )}
          {activeTab === 'campaigns' && (
            <CampaignManager activeCampaignId={activeCampaignId} setActiveCampaignId={handleCampaignSelect} />
          )}
          {activeTab === 'inspiration' && <InspirationGenerator onSave={addToLibrary} />}
          {activeTab === 'library' && <ConceptLibrary key={libraryUpdateKey} />}
          {activeTab === 'rules' && <DMScreen />}
        </main>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground font-body italic text-lg">
      {message}
    </div>
  );
}
