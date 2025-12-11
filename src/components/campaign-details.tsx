
'use client';

import { Campaign, Session } from "@/lib/types";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { Button } from "./ui/button";
import { Loader2, Trash2, Edit } from "lucide-react";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { getSafeDate } from "@/lib/utils";
import { Textarea } from "./ui/textarea";

interface CampaignDetailsProps {
    campaign: Campaign;
    onBack: () => void;
}

export function CampaignDetails({ campaign, onBack }: CampaignDetailsProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const sessionsRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaign.id, 'sessions');
  }, [user, firestore, campaign.id]);
  
  const sessionsQuery = useMemoFirebase(() => {
      if(!sessionsRef) return null;
      return query(sessionsRef, orderBy('sessionNumber', 'desc'));
  }, [sessionsRef])

  const { data: sessions, isLoading: sessionsLoading } = useCollection<Session>(sessionsQuery);

  const handleDeleteSession = (sessionId: string) => {
    if (!user) return;
    // This doesn't delete subcollections. For a production app, a Cloud Function would be better.
    const sessionDocRef = doc(firestore, 'users', user.uid, 'campaigns', campaign.id, 'sessions', sessionId);
    deleteDocumentNonBlocking(sessionDocRef);
    toast({ title: 'Session deleted.' });
  }

  const handleUpdateSession = async (sessionId: string, newSummary: string) => {
    if(!user || !sessionId || !newSummary.trim()) return;
    const sessionDocRef = doc(firestore, 'users', user.uid, 'campaigns', campaign.id, 'sessions', sessionId);
    try {
      await updateDocumentNonBlocking(sessionDocRef, { summary: newSummary });
      toast({ title: 'Session updated!' });
    } catch (error) {
      console.error('Error updating session:', error);
      toast({ variant: 'destructive', title: 'Could not update session', description: 'Check your connection or permissions and try again.' });
    }
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center">
        <h2 className="text-4xl font-headline font-bold">Campaign Logs</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Review, edit, or delete all session logs for "{campaign.name}".
        </p>
      </div>

      <div className="space-y-6">
        {sessionsLoading ? (
            <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
        ) : sessions && sessions.length > 0 ? (
            sessions.map(session => (
                <SessionCard 
                    key={session.id} 
                    session={session} 
                    onDelete={handleDeleteSession} 
                    onUpdate={handleUpdateSession}
                />
            ))
        ) : (
            <p className="text-center text-muted-foreground py-8">No sessions logged for this campaign yet.</p>
        )}
      </div>
    </div>
  )
}

function SessionCard({ session, onDelete, onUpdate }: { session: Session, onDelete: (sessionId: string) => void, onUpdate: (sessionId: string, summary: string) => void }) {
    const [isEditOpen, setIsEditOpen] = React.useState(false);
    const [editedSummary, setEditedSummary] = React.useState(session.summary);

    const safeDate = getSafeDate(session.date);
    
    const handleSaveChanges = () => {
        onUpdate(session.id, editedSummary);
        setIsEditOpen(false);
    }

    return (
        <Card>
            <CardHeader className="flex flex-row justify-between items-start">
                <div>
                    <CardTitle className="font-headline">Session {session.sessionNumber}</CardTitle>
                    <p className="text-sm text-muted-foreground pt-1">
                        {safeDate ? format(safeDate, 'MMMM d, yyyy') : 'Date not available'}
                    </p>
                </div>
                 <div className="flex items-center gap-1">
                    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                        <DialogTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-accent-foreground">
                                <Edit className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="font-headline">Edit Session {session.sessionNumber}</DialogTitle>
                                <DialogDescription>Modify the session summary below.</DialogDescription>
                            </DialogHeader>
                            <Textarea
                                value={editedSummary}
                                onChange={(e) => setEditedSummary(e.target.value)}
                                className="min-h-[200px] text-base"
                            />
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                <Button onClick={handleSaveChanges}>Save Changes</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                   
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
                                    This will permanently delete Session {session.sessionNumber}. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(session.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardHeader>
            <CardContent>
                <p className="whitespace-pre-wrap">{session.summary}</p>
            </CardContent>
        </Card>
    )
}
