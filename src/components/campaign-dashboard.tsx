
'use client';

import { Campaign, Session, SavedConcept, Character } from "@/lib/types";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, orderBy, where, limit, serverTimestamp, addDoc, doc, updateDoc } from "firebase/firestore";
import { Button } from "./ui/button";
import { ArrowLeft, Loader2, BookOpen, Scroll, Skull, User, Quote, Sparkles, PlusCircle, Users, Map, BrainCircuit } from "lucide-react";
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CampaignDetails } from "./campaign-details";
import { Textarea } from "./ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CharacterManager } from "./character-manager";
import { NpcManager } from "./npc-manager";
import { LocationManager } from "./location-manager";
import { getCampaignSummary } from "@/app/actions";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";

interface CampaignDashboardProps {
    campaign: Campaign;
    onBack: () => void;
}

const iconMap: { [key: string]: React.ReactElement } = {
  'Plot Hook': <Scroll className="h-4 w-4 text-accent" />,
  'Encounter Idea': <Skull className="h-4 w-4 text-accent" />,
  'NPC Concept': <User className="h-4 w-4 text-accent" />,
  'Dialog': <Quote className="h-4 w-4 text-accent" />,
  'Inspiration': <Sparkles className="h-4 w-4 text-accent" />,
};

export function CampaignDashboard({ campaign, onBack }: CampaignDashboardProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState("overview");
  
  // --- Data Fetching ---
  const campaignDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid, 'campaigns', campaign.id);
  }, [user, firestore, campaign.id]);
  const { data: campaignData, isLoading: campaignLoading } = useDoc<Campaign>(campaignDocRef);
  const currentCampaign = campaignData || campaign;


  const sessionsCollectionRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaign.id, 'sessions');
  }, [user, firestore, campaign.id]);

  const sessionsQuery = useMemoFirebase(() => {
    if (!sessionsCollectionRef) return null;
    return query(sessionsCollectionRef, orderBy('sessionNumber', 'asc'));
  }, [sessionsCollectionRef]);

  const { data: sessions, isLoading: sessionsLoading } = useCollection<Session>(sessionsQuery);

  const conceptsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, `users/${user.uid}/concepts`));
  }, [user, firestore]);
  
  const { data: allConcepts, isLoading: conceptsLoading } = useCollection<SavedConcept>(conceptsQuery);

  const charactersRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaign.id, 'characters');
  }, [user, firestore, campaign.id]);

  const { data: characters, isLoading: charactersLoading } = useCollection<Character>(charactersRef);
  
  const campaignConcepts = React.useMemo(() => {
      if (!allConcepts) return [];
      return allConcepts.filter(c => c.context?.includes(campaign.name));
  }, [allConcepts, campaign.name]);

  const groupedConcepts = React.useMemo(() => {
    return campaignConcepts.reduce((acc, concept) => {
      (acc[concept.type] = acc[concept.type] || []).push(concept);
      return acc;
    }, {} as Record<string, SavedConcept[]>);
  }, [campaignConcepts]);

  // --- Session Management & AI Summary ---
  const [newSessionSummary, setNewSessionSummary] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);

  const handleAddSession = () => {
    if (!sessionsCollectionRef || !sessionsQuery || !newSessionSummary.trim() || !user || !sessions || !characters || !campaignDocRef) return;
    setIsCreating(true);

    const highestSessionNumber = sessions.reduce((max, s) => Math.max(max, s.sessionNumber), 0);
    const nextSessionNumber = highestSessionNumber + 1;
    const sessionData = {
        campaignId: campaign.id,
        sessionNumber: nextSessionNumber,
        date: serverTimestamp(),
        summary: newSessionSummary,
      };

    addDocumentNonBlocking(sessionsCollectionRef, sessionData)
    .then(async () => {
        toast({ title: "Session logged successfully!" });
        setNewSessionSummary('');

        // Now, trigger the AI summary update in the background.
        const updatedSessions = [...sessions, { ...sessionData, id: 'temp', date: new Date().toISOString() }];
        const summaryInput = {
            campaignName: campaign.name,
            campaignDescription: campaign.description,
            sessions: updatedSessions.map(s => ({ sessionNumber: s.sessionNumber, summary: s.summary })),
            characters: characters.map(c => ({ name: c.name, class: c.class, species: c.species, backstory: c.backstory })),
        };

        const { data: summaryData, error } = await getCampaignSummary(summaryInput);

        if (summaryData?.campaignSummary) {
            updateDocumentNonBlocking(campaignDocRef, {
                aiSummary: summaryData.campaignSummary,
            }).then(() => {
                toast({ title: "Campaign summary updated!", description: "The AI has chronicled the latest events." });
            }).catch((err) => {
                console.error('Error updating campaign summary:', err);
                toast({ variant: 'destructive', title: 'Could not update campaign summary', description: 'Check your connection or permissions and try again.' });
            });
        } else if (error) {
            throw new Error(error);
        }
    })
    .catch((error) => {
        // This error is for adding the session doc itself.
        // The global handler will also catch it, but we can add UI feedback here if needed.
        console.error("Error adding session:", error);
        toast({ variant: "destructive", title: "Uh oh!", description: "There was a problem saving your session log." })
    })
    .finally(() => {
        setIsCreating(false);
    });
  };

  // --- Render Logic ---
  const isLoading = sessionsLoading || conceptsLoading || charactersLoading || campaignLoading;

  return (
    <div className="space-y-8">
        <Button variant="ghost" onClick={onBack} className="text-sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Campaigns
        </Button>

      <div className="text-center mb-8">
        <h2 className="text-5xl font-headline font-bold text-foreground tracking-wide">{campaign.name}</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto font-body">
          {campaign.description}
        </p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-3xl mx-auto h-12 text-sm bg-black/20 rounded-xl border-white/5 border">
            <TabsTrigger value="overview"><BookOpen className="mr-2 h-4 w-4" />Overview</TabsTrigger>
            <TabsTrigger value="characters"><Users className="mr-2 h-4 w-4" />Characters</TabsTrigger>
            <TabsTrigger value="npcs"><User className="mr-2 h-4 w-4" />NPCs</TabsTrigger>
            <TabsTrigger value="locations"><Map className="mr-2 h-4 w-4" />Locations</TabsTrigger>
            <TabsTrigger value="logs"><Scroll className="mr-2 h-4 w-4" />All Logs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6">
            {isLoading ? (
                <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
            ) : (
                <div className="grid lg:grid-cols-3 gap-8 items-start">
                  {/* Main Column */}
                  <div className="lg:col-span-2 space-y-8">
                     <Card>
                         <CardHeader>
                            <CardTitle className="font-headline text-2xl flex items-center gap-3"><BrainCircuit className="h-6 w-6 text-accent"/> The Story So Far</CardTitle>
                             <CardDescription>An AI-generated summary of your campaign's progress.</CardDescription>
                         </CardHeader>
                         <CardContent className="font-body text-base">
                             {currentCampaign.aiSummary ? (
                                <p className="whitespace-pre-wrap pt-2 leading-relaxed">{currentCampaign.aiSummary}</p>
                             ) : (
                                 <p className="text-muted-foreground">No summary generated yet. Add your first session log to create one!</p>
                             )}
                         </CardContent>
                     </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl">Log New Session</CardTitle>
                            <CardDescription className="font-body tracking-wider">Quickly add notes from your latest adventure. This will update the campaign summary.</CardDescription>
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
                                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                {isCreating ? 'Logging...' : 'Log Session'}
                            </Button>
                        </CardFooter>
                    </Card>

                  </div>
                  
                  {/* Side Column */}
                  <div className="space-y-8">
                    <Card className="sticky top-24">
                       <CardHeader>
                           <CardTitle className="font-headline text-2xl">Campaign Ideas</CardTitle>
                           <CardDescription className="font-body tracking-wider">Generated for this campaign.</CardDescription>
                       </CardHeader>
                       <CardContent className="font-body">
                           {campaignConcepts.length > 0 ? (
                              <div className="space-y-6">
                                {Object.entries(groupedConcepts).map(([type, concepts]) => (
                                    <div key={type}>
                                        <h4 className="font-headline flex items-center gap-2 mb-2 text-lg text-accent-foreground">{iconMap[type]} {type}s</h4>
                                        <div className="space-y-3 text-sm border-l-2 border-accent/20 pl-4 ml-2">
                                          {concepts.map(concept => (
                                              <p key={concept.id} className="text-muted-foreground">{concept.content}</p>
                                          ))}
                                        </div>
                                    </div>
                                ))}
                              </div>
                           ) : (
                              <p className="text-muted-foreground text-sm">No specific ideas have been generated for this campaign yet. Use the 'Generator' tab!</p>
                           )}
                       </CardContent>
                    </Card>
                  </div>
                </div>
            )}
        </TabsContent>

        <TabsContent value="characters" className="mt-6">
            <CharacterManager campaign={campaign} />
        </TabsContent>
        
        <TabsContent value="npcs" className="mt-6">
            <NpcManager campaign={campaign} />
        </TabsContent>

        <TabsContent value="locations" className="mt-6">
            <LocationManager campaign={campaign} />
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
            <CampaignDetails campaign={campaign} onBack={() => setActiveTab("overview")} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

    
