
'use client';

import React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { PlusCircle, Trash2, Loader2, User, Edit, Wand2, Users, Eye } from 'lucide-react';
import type { Campaign, Npc } from '@/lib/types';
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
import { generateNewNpc } from '@/app/actions';
import { Skeleton } from './ui/skeleton';
import { ScrollArea } from './ui/scroll-area';

interface NpcManagerProps {
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


export function NpcManager({ campaign }: NpcManagerProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  // State for manual NPC creation/editing
  const [isCreateFormOpen, setIsCreateFormOpen] = React.useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = React.useState(false);
  const [newNpcName, setNewNpcName] = React.useState('');
  const [newNpcDescription, setNewNpcDescription] = React.useState('');
  const [newNpcLocation, setNewNpcLocation] = React.useState('');
  
  const [editingNpc, setEditingNpc] = React.useState<Npc | null>(null);
  const [editedName, setEditedName] = React.useState('');
  const [editedDescription, setEditedDescription] = React.useState('');
  const [editedLocation, setEditedLocation] = React.useState('');
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // State for AI NPC generation
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generatedNpc, setGeneratedNpc] = React.useState<ReturnType<typeof generateNewNpc> extends Promise<infer T> ? T['data'] : never>(null);
  const [generationLocation, setGenerationLocation] = React.useState('');


  const npcsRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaign.id, 'npcs');
  }, [user, firestore, campaign.id]);

  const { data: npcs, isLoading: npcsLoading } = useCollection<Npc>(npcsRef);

  const handleCreateNpc = async () => {
    if (!npcsRef || !newNpcName.trim() || !newNpcDescription.trim()) return;
    setIsSubmitting(true);

    try {
      await addDocumentNonBlocking(npcsRef, {
        campaignId: campaign.id,
        name: newNpcName,
        description: newNpcDescription,
        location: newNpcLocation,
      });
      setNewNpcName('');
      setNewNpcDescription('');
      setNewNpcLocation('');
      toast({ title: 'NPC added!' });
      setIsCreateFormOpen(false);
    } catch (error) {
      console.error('Error adding NPC:', error);
      toast({ variant: 'destructive', title: 'Could not add NPC', description: 'Check your connection or permissions and try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNpc = (npcId: string) => {
    if (!user || !npcId) return;
    const npcDocRef = doc(firestore, 'users', user.uid, 'campaigns', campaign.id, 'npcs', npcId);
    deleteDocumentNonBlocking(npcDocRef);
    toast({ title: 'NPC removed.' });
  }

  const handleOpenEditDialog = (npc: Npc) => {
    setEditingNpc(npc);
    setEditedName(npc.name);
    setEditedDescription(npc.description);
    setEditedLocation(npc.location || '');
    setIsEditFormOpen(true);
  }

  const handleUpdateNpc = async () => {
    if (!user || !editingNpc || !editedName.trim() || !editedDescription.trim()) return;
    setIsSubmitting(true);

    try {
      const npcDocRef = doc(firestore, 'users', user.uid, 'campaigns', campaign.id, 'npcs', editingNpc.id);
      await updateDocumentNonBlocking(npcDocRef, {
        name: editedName,
        description: editedDescription,
        location: editedLocation,
      });
      toast({ title: 'NPC updated!' });
      setIsEditFormOpen(false);
      setEditingNpc(null);
    } catch (error) {
      console.error('Error updating NPC:', error);
      toast({ variant: 'destructive', title: 'Could not update NPC', description: 'Check your connection or permissions and try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleGenerateNpc = async () => {
    setIsGenerating(true);
    setGeneratedNpc(null);
    const campaignContext = `Campaign: ${campaign.name}\nDescription: ${campaign.description}`;
    const result = await generateNewNpc(campaignContext, generationLocation);
    if(result.data) {
        setGeneratedNpc(result.data);
    } else {
        toast({ variant: "destructive", title: "NPC Generation Failed", description: result.error });
    }
    setIsGenerating(false);
  }

  const handleSaveGeneratedNpc = async () => {
    if(!npcsRef || !generatedNpc) return;
    try {
      await addDocumentNonBlocking(npcsRef, {
        campaignId: campaign.id,
        name: generatedNpc.name,
        description: generatedNpc.description,
        location: generatedNpc.location || generationLocation,
      });
      toast({ title: `Added ${generatedNpc.name} to your NPC list!` });
      setGeneratedNpc(null);
      setGenerationLocation('');
      setIsGenerateDialogOpen(false);
    } catch (error) {
      console.error('Error saving generated NPC:', error);
      toast({ variant: 'destructive', title: 'Could not save NPC', description: 'Check your connection or permissions and try again.' });
    }
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
       <div className="text-center">
        <h2 className="text-4xl font-headline font-bold">NPC Dossier</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Manage the allies, adversaries, and acquaintances in "{campaign.name}".
        </p>
      </div>

      <div className="flex justify-center gap-4">
        <Dialog open={isCreateFormOpen} onOpenChange={setIsCreateFormOpen}>
            <DialogTrigger asChild>
                <Button><PlusCircle /> Add NPC Manually</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                <DialogTitle className="font-headline text-2xl">Add a New NPC</DialogTitle>
                <DialogDescription>
                    Provide the details for a new non-player character.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Input placeholder="NPC Name" value={newNpcName} onChange={(e) => setNewNpcName(e.target.value)} disabled={isSubmitting}/>
                    <Input placeholder="Location (e.g., 'Neverwinter Market')" value={newNpcLocation} onChange={(e) => setNewNpcLocation(e.target.value)} disabled={isSubmitting}/>
                    <Textarea placeholder="NPC description, personality, and backstory..." value={newNpcDescription} onChange={(e) => setNewNpcDescription(e.target.value)} disabled={isSubmitting} className="min-h-[150px]"/>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancel</Button></DialogClose>
                    <Button onClick={handleCreateNpc} disabled={isSubmitting || !newNpcName.trim() || !newNpcDescription.trim()}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Save NPC
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <Dialog open={isGenerateDialogOpen} onOpenChange={(open) => { if(!open) { setGeneratedNpc(null); setGenerationLocation(''); } setIsGenerateDialogOpen(open);}}>
            <DialogTrigger asChild>
                <Button variant="outline"><Wand2 className="mr-2"/> Generate NPC with AI</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="font-headline text-2xl">Generate a New NPC</DialogTitle>
                    <DialogDescription>
                        Need an NPC on the fly? Describe the situation and let the AI create one for you.
                    </DialogDescription>
                </DialogHeader>
                 <div className="space-y-4">
                    <Input 
                        placeholder="Optional: Where is the NPC? (e.g., 'a tavern')"
                        value={generationLocation}
                        onChange={(e) => setGenerationLocation(e.target.value)}
                        disabled={isGenerating}
                    />
                    <Button onClick={handleGenerateNpc} disabled={isGenerating} className="w-full">
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        {isGenerating ? 'Generating...' : 'Generate NPC'}
                    </Button>
                </div>

                <ScrollArea className="max-h-[50vh] pr-6">
                  {isGenerating && (
                      <div className="space-y-4 pt-4">
                          <Skeleton className="h-6 w-1/2" />
                          <div className="space-y-2">
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-4 w-5/6" />
                          </div>
                      </div>
                  )}
                  
                  {generatedNpc && (
                      <Card className="mt-4 animate-in fade-in">
                          <CardHeader>
                              <CardTitle>{generatedNpc.name}</CardTitle>
                              {generatedNpc.location && <CardDescription>{generatedNpc.location}</CardDescription>}
                          </CardHeader>
                          <CardContent>
                              <p className="whitespace-pre-wrap">{generatedNpc.description}</p>
                          </CardContent>
                      </Card>
                  )}
                </ScrollArea>
                
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary" disabled={isGenerating}>Cancel</Button></DialogClose>
                    <Button onClick={handleSaveGeneratedNpc} disabled={!generatedNpc}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Save to Campaign
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>


      {npcsLoading ? (
          <div className="text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
        ) : npcs && npcs.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {npcs.map((npc) => (
              <Card key={npc.id} className="flex flex-col group">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="font-headline text-2xl flex items-center gap-3"><User /> {npc.name}</CardTitle>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEditDialog(npc)}>
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
                                <AlertDialogDescription>This will permanently delete {npc.name}. This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteNpc(npc.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                  </div>
                   {npc.location && <CardDescription>Last seen: {npc.location}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-4 font-body flex-grow min-h-[140px]">
                  <TruncatedContent title="Description" content={npc.description} />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-card/50 border border-dashed rounded-xl">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-2xl font-headline">A Quiet World...</h3>
            <p className="mt-2 text-muted-foreground">
                Add your first NPC to begin populating your campaign world.
            </p>
         </div>
        )}
      {/* Edit Dialog */}
      <Dialog open={isEditFormOpen} onOpenChange={setIsEditFormOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="font-headline text-2xl">Edit {editingNpc?.name}</DialogTitle>
                    <DialogDescription>Update the NPC's details.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Input placeholder="NPC Name" value={editedName} onChange={(e) => setEditedName(e.target.value)} disabled={isSubmitting}/>
                    <Input placeholder="Location" value={editedLocation} onChange={(e) => setEditedLocation(e.target.value)} disabled={isSubmitting}/>
                    <Textarea placeholder="NPC description..." value={editedDescription} onChange={(e) => setEditedDescription(e.target.value)} disabled={isSubmitting} className="min-h-[150px]"/>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancel</Button></DialogClose>
                    <Button onClick={handleUpdateNpc} disabled={isSubmitting || !editedName.trim() || !editedDescription.trim()}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
