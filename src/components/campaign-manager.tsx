'use client';

import React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { PlusCircle, Trash2, Loader2, BookOpen } from 'lucide-react';
import { Campaign } from '@/lib/types';
import { addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { CampaignDashboard } from './campaign-dashboard';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface CampaignManagerProps {
  activeCampaignId: string | null;
  setActiveCampaignId: (id: string | null) => void;
}

export function CampaignManager({ activeCampaignId, setActiveCampaignId }: CampaignManagerProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const campaignsRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'campaigns');
  }, [user, firestore]);

  const { data: campaigns, isLoading: campaignsLoading } = useCollection<Campaign>(campaignsRef);

  const [newCampaignName, setNewCampaignName] = React.useState('');
  const [newCampaignDescription, setNewCampaignDescription] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);


  const handleCreateCampaign = async () => {
    if (!campaignsRef || !newCampaignName.trim()) return;
    setIsCreating(true);

    try {
      await addDocumentNonBlocking(campaignsRef, {
          name: newCampaignName,
          description: newCampaignDescription,
          createdAt: serverTimestamp(),
      });
      setNewCampaignName('');
      setNewCampaignDescription('');
      toast({ title: 'Campaign created!' });
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({ variant: 'destructive', title: 'Could not create campaign', description: 'Check your connection or permissions and try again.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCampaign = (campaignId: string) => {
    if (!user) return;
    const campaignDocRef = doc(firestore, 'users', user.uid, 'campaigns', campaignId);
    // TODO: This doesn't delete subcollections. For a real app, a Cloud Function would be needed.
    deleteDocumentNonBlocking(campaignDocRef);
    if(activeCampaignId === campaignId) {
      setActiveCampaignId(null);
    }
    toast({ title: 'Campaign deleted.' });
  };
  
  if (activeCampaignId) {
    const campaign = campaigns?.find(c => c.id === activeCampaignId);
    if(campaign) {
      return <CampaignDashboard campaign={campaign} onBack={() => setActiveCampaignId(null)} />;
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-4xl font-headline font-bold">Campaign Chronicles</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Manage your grand adventures. Select a campaign to view its dashboard or start a new saga.
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Start a New Campaign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Campaign Name"
            value={newCampaignName}
            onChange={(e) => setNewCampaignName(e.target.value)}
            disabled={isCreating}
          />
          <Textarea
            placeholder="A brief description of your campaign..."
            value={newCampaignDescription}
            onChange={(e) => setNewCampaignDescription(e.target.value)}
            disabled={isCreating}
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleCreateCampaign} disabled={isCreating || !newCampaignName.trim()}>
            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Create Campaign
          </Button>
        </CardFooter>
      </Card>

      <div className="space-y-4">
        <h3 className="text-2xl font-headline text-center">Your Campaigns</h3>
        {campaignsLoading ? (
          <div className="text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
        ) : campaigns && campaigns.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="font-headline">{campaign.name}</CardTitle>
                  <CardDescription className="pt-2">{campaign.description}</CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto flex justify-between">
                  <Button onClick={() => setActiveCampaignId(campaign.id)}>
                    <BookOpen className="mr-2 h-4 w-4" /> View Dashboard
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the "{campaign.name}" campaign and all its sessions. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteCampaign(campaign.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">You haven't created any campaigns yet.</p>
        )}
      </div>
    </div>
  );
}
