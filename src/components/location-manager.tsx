
'use client';

import React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { PlusCircle, Trash2, Loader2, Edit, Map, Globe, Eye } from 'lucide-react';
import type { Campaign, Location } from '@/lib/types';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from './ui/scroll-area';

interface LocationManagerProps {
    campaign: Campaign;
}

const TruncatedContent: React.FC<{ title: string; content: string }> = ({ title, content }) => {
  if (!content) return null;
  const isLong = content.length > 150;
  const truncated = isLong ? `${content.substring(0, 150)}...` : content;

  return (
    <div>
      <h4 className="font-semibold mb-1 text-accent-foreground">{title}</h4>
      <div className="text-muted-foreground whitespace-pre-wrap text-sm relative">
        {truncated}
        {isLong && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="link" className="p-0 h-auto text-accent-foreground/80 hover:text-accent-foreground text-xs absolute bottom-0 right-0 bg-gradient-to-l from-card via-card to-transparent pl-8">
                <Eye className="mr-1 h-3 w-3" /> Show More
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-headline text-2xl">{title}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-6">
                <p className="whitespace-pre-wrap py-4">{content}</p>
              </ScrollArea>
               <DialogFooter>
                <DialogClose asChild>
                  <Button type="button">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
};


export function LocationManager({ campaign }: LocationManagerProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isCreateFormOpen, setIsCreateFormOpen] = React.useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = React.useState(false);

  const [newLocationName, setNewLocationName] = React.useState('');
  const [newLocationDescription, setNewLocationDescription] = React.useState('');
  
  const [editingLocation, setEditingLocation] = React.useState<Location | null>(null);
  const [editedName, setEditedName] = React.useState('');
  const [editedDescription, setEditedDescription] = React.useState('');
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const locationsRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaign.id, 'locations');
  }, [user, firestore, campaign.id]);

  const { data: locations, isLoading: locationsLoading } = useCollection<Location>(locationsRef);

  const handleCreateLocation = async () => {
    if (!locationsRef || !newLocationName.trim() || !newLocationDescription.trim()) return;
    setIsSubmitting(true);

    try {
      await addDocumentNonBlocking(locationsRef, {
        campaignId: campaign.id,
        name: newLocationName,
        description: newLocationDescription,
      });
      setNewLocationName('');
      setNewLocationDescription('');
      toast({ title: 'Location added!' });
      setIsCreateFormOpen(false);
    } catch (error) {
      console.error('Error adding location:', error);
      toast({ variant: 'destructive', title: 'Could not add location', description: 'Check your connection or permissions and try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLocation = (locationId: string) => {
    if (!user || !locationId) return;
    const charDocRef = doc(firestore, 'users', user.uid, 'campaigns', campaign.id, 'locations', locationId);
    deleteDocumentNonBlocking(charDocRef);
    toast({ title: 'Location removed.' });
  }

  const handleOpenEditDialog = (location: Location) => {
    setEditingLocation(location);
    setEditedName(location.name);
    setEditedDescription(location.description);
    setIsEditFormOpen(true);
  }

  const handleUpdateLocation = async () => {
    if (!user || !editingLocation || !editedName.trim() || !editedDescription.trim()) return;
    setIsSubmitting(true);

    try {
      const charDocRef = doc(firestore, 'users', user.uid, 'campaigns', campaign.id, 'locations', editingLocation.id);
      await updateDocumentNonBlocking(charDocRef, {
        name: editedName,
        description: editedDescription,
      });
      toast({ title: 'Location updated!' });
      setIsEditFormOpen(false);
      setEditingLocation(null);
    } catch (error) {
      console.error('Error updating location:', error);
      toast({ variant: 'destructive', title: 'Could not update location', description: 'Check your connection or permissions and try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
       <div className="text-center">
        <h2 className="text-4xl font-headline font-bold">World Atlas</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Chronicle the important locations in your campaign, "{campaign.name}".
        </p>
      </div>

      <div className="flex justify-center">
        <Dialog open={isCreateFormOpen} onOpenChange={setIsCreateFormOpen}>
            <DialogTrigger asChild>
                <Button><PlusCircle /> Add New Location</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                <DialogTitle className="font-headline text-2xl">Add a New Location</DialogTitle>
                <DialogDescription>
                    Provide the name and description for a new location in your world.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Input 
                        placeholder="Location Name (e.g., 'The Whispering Peaks')"
                        value={newLocationName}
                        onChange={(e) => setNewLocationName(e.target.value)}
                        disabled={isSubmitting}
                    />
                    <Textarea
                        placeholder="Describe the location's appearance, history, and significance..."
                        value={newLocationDescription}
                        onChange={(e) => setNewLocationDescription(e.target.value)}
                        disabled={isSubmitting}
                        className="min-h-[150px]"
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" disabled={isSubmitting}>
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button onClick={handleCreateLocation} disabled={isSubmitting || !newLocationName.trim() || !newLocationDescription.trim()}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Save Location
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>


      {locationsLoading ? (
          <div className="text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
        ) : locations && locations.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map((location) => (
              <Card key={location.id} className="flex flex-col group">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="font-headline text-2xl flex items-center gap-3"><Map /> {location.name}</CardTitle>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEditDialog(location)}>
                             <Edit className="h-4 w-4" />
                        </Button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This will permanently delete {location.name}. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteLocation(location.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 font-body flex-grow min-h-[140px]">
                   <TruncatedContent title="Description" content={location.description} />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-card/50 border border-dashed rounded-xl">
            <Globe className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-2xl font-headline">An undiscovered world...</h3>
            <p className="mt-2 text-muted-foreground">
                Map out your first location to begin world-building.
            </p>
         </div>
        )}
      {/* Edit Dialog */}
      <Dialog open={isEditFormOpen} onOpenChange={setIsEditFormOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="font-headline text-2xl">Edit {editingLocation?.name}</DialogTitle>
                    <DialogDescription>
                        Update the location's name and description.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Input 
                        placeholder="Location Name"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        disabled={isSubmitting}
                    />
                    <Textarea
                        placeholder="Location description..."
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        disabled={isSubmitting}
                        className="min-h-[150px]"
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" disabled={isSubmitting}>
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button onClick={handleUpdateLocation} disabled={isSubmitting || !editedName.trim() || !editedDescription.trim()}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
