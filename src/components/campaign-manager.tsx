'use client';

import React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { PlusCircle, Trash2, Loader2, BookOpen, Swords } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

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

  const [dialogOpen, setDialogOpen] = React.useState(false);
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
      setDialogOpen(false);
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
    deleteDocumentNonBlocking(campaignDocRef);
    if (activeCampaignId === campaignId) setActiveCampaignId(null);
    toast({ title: 'Campaign deleted.' });
  };

  if (activeCampaignId) {
    const campaign = campaigns?.find(c => c.id === activeCampaignId);
    if (campaign) {
      return <CampaignDashboard campaign={campaign} onBack={() => setActiveCampaignId(null)} />;
    }
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-headline font-bold">Campaign Chronicles</h2>
          <p className="text-muted-foreground mt-1 font-body">
            Your active campaigns. Select one to open its dashboard.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="flex-shrink-0">
          <PlusCircle className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Campaign grid — the hero of this page */}
      {campaignsLoading ? (
        <div className="text-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        </div>
      ) : campaigns && campaigns.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map(campaign => (
            <Card key={campaign.id} className="flex flex-col group hover:border-primary/30 transition-colors">
              <CardHeader>
                <CardTitle className="font-headline text-xl">{campaign.name}</CardTitle>
                <CardDescription className="pt-1 line-clamp-4 font-body leading-relaxed">
                  {campaign.description}
                </CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto flex justify-between pt-4">
                <Button onClick={() => setActiveCampaignId(campaign.id)}>
                  <BookOpen className="mr-2 h-4 w-4" /> Open Campaign
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon"
                      className="h-9 w-9 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{campaign.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the campaign and all its sessions. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
        /* Empty state — only shown when no campaigns exist */
        <div className="text-center py-24 border border-dashed border-primary/20 rounded-xl space-y-4">
          <Swords className="h-12 w-12 mx-auto text-primary/30" />
          <div>
            <h3 className="font-headline text-xl text-foreground/70">No campaigns yet</h3>
            <p className="text-muted-foreground mt-1 text-sm">Start your first saga to begin.</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Your First Campaign
          </Button>
        </div>
      )}

      {/* Create campaign dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => {
        setDialogOpen(open);
        if (!open) { setNewCampaignName(''); setNewCampaignDescription(''); }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl">Start a New Campaign</DialogTitle>
            <DialogDescription className="font-body">
              Give your campaign a name and a brief description to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="Campaign Name *"
              value={newCampaignName}
              onChange={e => setNewCampaignName(e.target.value)}
              disabled={isCreating}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && !isCreating && newCampaignName.trim() && handleCreateCampaign()}
              className="text-base"
            />
            <Textarea
              placeholder="A brief description of your campaign..."
              value={newCampaignDescription}
              onChange={e => setNewCampaignDescription(e.target.value)}
              disabled={isCreating}
              className="min-h-[100px] text-base font-body"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isCreating}>Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleCreateCampaign}
              disabled={isCreating || !newCampaignName.trim()}
            >
              {isCreating
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
                : <><PlusCircle className="mr-2 h-4 w-4" />Create Campaign</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
