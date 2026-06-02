'use client';

import React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, doc, query, orderBy } from 'firebase/firestore';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { PlusCircle, Trash2, Loader2, BookOpen, Swords, Scroll, Clock } from 'lucide-react';
import { Campaign, Session } from '@/lib/types';
import { addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { CampaignDashboard } from './campaign-dashboard';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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

// ─────────────────────────────────────────────────────────────────────────────
// Campaign card — loads its own session data for count + last played
// ─────────────────────────────────────────────────────────────────────────────
function timeAgo(dateVal: any): string {
  if (!dateVal) return '';
  try {
    const date = typeof dateVal === 'string'
      ? new Date(dateVal)
      : dateVal?.toDate?.() ?? new Date(dateVal);
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
    return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
  } catch { return ''; }
}

function CampaignCard({
  campaign,
  onOpen,
  onDelete,
}: {
  campaign: Campaign;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { user } = useUser();
  const firestore = useFirestore();

  const sessionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'campaigns', campaign.id, 'sessions'),
      orderBy('sessionNumber', 'desc')
    );
  }, [user, firestore, campaign.id]);
  const { data: sessions } = useCollection<Session>(sessionsQuery);

  const sessionCount = sessions?.length ?? 0;
  const latestSession = sessions?.[0];
  const lastPlayed = latestSession?.date ? timeAgo(latestSession.date) : null;

  return (
    <Card className="flex flex-col group hover:border-primary/40 transition-all hover:shadow-[0_0_20px_hsl(174_50%_48%/0.06)] cursor-pointer"
      onClick={onOpen}>
      <CardHeader className="pb-3">
        <CardTitle className="font-headline text-xl leading-snug">{campaign.name}</CardTitle>
        <CardDescription className="pt-1 line-clamp-3 font-body leading-relaxed text-sm">
          {campaign.description}
        </CardDescription>
      </CardHeader>

      {/* Stats row */}
      <div className="px-6 pb-4 flex items-center gap-4 mt-auto">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Scroll className="h-3.5 w-3.5 text-primary/50" />
          <span>
            {sessionCount === 0
              ? 'No sessions yet'
              : `${sessionCount} session${sessionCount !== 1 ? 's' : ''}`}
          </span>
        </div>
        {lastPlayed && (
          <>
            <span className="text-muted-foreground/30">·</span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-primary/50" />
              <span>{lastPlayed}</span>
            </div>
          </>
        )}
      </div>

      <CardFooter className="flex justify-between pt-3 border-t border-border/50">
        <Button onClick={e => { e.stopPropagation(); onOpen(); }} size="sm">
          <BookOpen className="mr-2 h-4 w-4" /> Open Campaign
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
              onClick={e => e.stopPropagation()}
            >
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
                onClick={onDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
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
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onOpen={() => setActiveCampaignId(campaign.id)}
              onDelete={() => handleDeleteCampaign(campaign.id)}
            />
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
