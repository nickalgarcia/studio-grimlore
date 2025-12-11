
'use client';

import React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { PlusCircle, Trash2, Loader2, User, Edit, Eye } from 'lucide-react';
import type { Campaign, Character } from '@/lib/types';
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
import { Users } from 'lucide-react';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface CharacterManagerProps {
    campaign: Campaign;
}

const TruncatedContent: React.FC<{ title: string; content?: string }> = ({ title, content }) => {
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


export function CharacterManager({ campaign }: CharacterManagerProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingCharacter, setEditingCharacter] = React.useState<Character | null>(null);
  const [formData, setFormData] = React.useState<Partial<Character>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const charactersRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaign.id, 'characters');
  }, [user, firestore, campaign.id]);

  const { data: characters, isLoading: charactersLoading } = useCollection<Character>(charactersRef);

  const handleDeleteCharacter = (characterId: string) => {
    if (!user || !characterId) return;
    const charDocRef = doc(firestore, 'users', user.uid, 'campaigns', campaign.id, 'characters', characterId);
    deleteDocumentNonBlocking(charDocRef);
    toast({ title: 'Character removed.' });
  }
  
  const openForm = (character: Character | null = null) => {
      setEditingCharacter(character);
      setFormData(character || {});
      setIsFormOpen(true);
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      const parsedValue = type === 'number' ? (value === '' ? undefined : Number(value)) : value;
      setFormData(prev => ({...prev, [name]: parsedValue}));
  }

  const handleSubmit = () => {
      if(!charactersRef || !formData.name || !formData.backstory) {
          toast({ variant: 'destructive', title: "Missing fields", description: "Name and Backstory are required."});
          return;
      }
      setIsSubmitting(true);
      const dataToSave = {
          campaignId: campaign.id,
          ...formData
      }

      if(editingCharacter) {
          const charDocRef = doc(firestore, 'users', user!.uid, 'campaigns', campaign.id, 'characters', editingCharacter.id);
          updateDocumentNonBlocking(charDocRef, dataToSave).finally(() => {
              toast({ title: "Character updated!" });
              setIsSubmitting(false);
              setIsFormOpen(false);
          });
      } else {
           addDocumentNonBlocking(charactersRef, dataToSave).finally(() => {
              toast({ title: "Character added!" });
              setIsSubmitting(false);
              setIsFormOpen(false);
          });
      }
  }


  return (
    <div className="space-y-8 max-w-7xl mx-auto">
       <div className="text-center">
        <h2 className="text-4xl font-headline font-bold">Character Roster</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Manage your party members for the "{campaign.name}" campaign.
        </p>
      </div>
      
      <div className="flex justify-center gap-4">
        <Button size="lg" onClick={() => openForm()}>
          <PlusCircle className="mr-2" /> Add Character
        </Button>
      </div>

       <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="font-headline text-2xl">{editingCharacter ? 'Edit Character' : 'Add New Character'}</DialogTitle>
                    <DialogDescription>
                        {editingCharacter ? `Editing ${editingCharacter.name}` : 'Enter the details for your new party member.'}
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] pr-6 -mr-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4 pr-6">
                      {/* Main Info */}
                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="name">Character Name</Label>
                        <Input id="name" name="name" placeholder="Character Name" value={formData.name || ''} onChange={handleFormChange} disabled={isSubmitting} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="species">Species</Label>
                          <Input id="species" name="species" placeholder="e.g., Human, Elf" value={formData.species || ''} onChange={handleFormChange} disabled={isSubmitting} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="class">Class</Label>
                          <Input id="class" name="class" placeholder="e.g., Fighter, Wizard" value={formData.class || ''} onChange={handleFormChange} disabled={isSubmitting} />
                      </div>
                      
                      {/* Stats */}
                      <div className="md:col-span-2 border-t pt-4 mt-2">
                        <h4 className="text-lg font-headline mb-2">At-a-Glance Stats</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="armorClass">AC</Label>
                                <Input id="armorClass" name="armorClass" type="number" placeholder="16" value={formData.armorClass ?? ''} onChange={handleFormChange} disabled={isSubmitting} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="speed">Speed</Label>
                                <Input id="speed" name="speed" type="number" placeholder="30" value={formData.speed ?? ''} onChange={handleFormChange} disabled={isSubmitting} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="passivePerception">Perception</Label>
                                <Input id="passivePerception" name="passivePerception" type="number" placeholder="14" value={formData.passivePerception ?? ''} onChange={handleFormChange} disabled={isSubmitting} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="passiveInvestigation">Investigation</Label>
                                <Input id="passiveInvestigation" name="passiveInvestigation" type="number" placeholder="12" value={formData.passiveInvestigation ?? ''} onChange={handleFormChange} disabled={isSubmitting} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="passiveInsight">Insight</Label>
                                <Input id="passiveInsight" name="passiveInsight" type="number" placeholder="15" value={formData.passiveInsight ?? ''} onChange={handleFormChange} disabled={isSubmitting} />
                            </div>
                        </div>
                      </div>

                      {/* Narrative */}
                       <div className="md:col-span-2 border-t pt-4 mt-2">
                          <h4 className="text-lg font-headline mb-2">Narrative Details</h4>
                           <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="originCity">Origin City</Label>
                                <Input id="originCity" name="originCity" placeholder="e.g., Waterdeep" value={formData.originCity || ''} onChange={handleFormChange} disabled={isSubmitting} />
                              </div>
                              <div className="space-y-2">
                                  <Label htmlFor="backstory">Backstory</Label>
                                  <Textarea id="backstory" name="backstory" placeholder="The character's history, motivations, and secrets..." value={formData.backstory || ''} onChange={handleFormChange} disabled={isSubmitting} className="min-h-[120px]" />
                              </div>
                           </div>
                       </div>
                  </div>
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !formData.name || !formData.backstory}>
                         {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        {editingCharacter ? 'Save Changes' : 'Save Character'}
                    </Button>
                </DialogFooter>
            </DialogContent>
      </Dialog>


      {charactersLoading ? (
          <div className="text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
        ) : characters && characters.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {characters.map((character) => (
              <Card key={character.id} className="flex flex-col group">
                  <CardHeader>
                  <div className="flex justify-between items-start">
                      <CardTitle className="font-headline text-2xl flex items-center gap-3"><User /> {character.name}</CardTitle>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openForm(character)}>
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
                                  This will permanently delete {character.name}. This action cannot be undone.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteCharacter(character.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete
                                  </AlertDialogAction>
                              </AlertDialogFooter>
                              </AlertDialogContent>
                          </AlertDialog>
                      </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                          {character.species && <Badge variant="outline">{character.species}</Badge>}
                          {character.class && <Badge variant="outline">{character.class}</Badge>}
                          {character.originCity && <Badge variant="outline">From {character.originCity}</Badge>}
                      </div>
                  </CardHeader>
                  <CardContent className="space-y-4 font-body flex-grow">
                      <div className="flex justify-around text-center border-t border-b py-3">
                          <div className="px-2"><p className="font-bold text-lg">{character.armorClass || '—'}</p><p className="text-xs text-muted-foreground">AC</p></div>
                          <div className="px-2"><p className="font-bold text-lg">{character.speed || '—'}</p><p className="text-xs text-muted-foreground">Speed</p></div>
                          <div className="px-2"><p className="font-bold text-lg">{character.passivePerception || '—'}</p><p className="text-xs text-muted-foreground">Perception</p></div>
                          <div className="px-2"><p className="font-bold text-lg">{character.passiveInvestigation || '—'}</p><p className="text-xs text-muted-foreground">Investigation</p></div>
                          <div className="px-2"><p className="font-bold text-lg">{character.passiveInsight || '—'}</p><p className="text-xs text-muted-foreground">Insight</p></div>
                      </div>
                      <TruncatedContent title="Backstory" content={character.backstory} />
                  </CardContent>
              </Card>
              ))}
          </div>
        ) : (
             <div className="text-center py-16 bg-card/50 border border-dashed rounded-xl">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-2xl font-headline">An empty party...</h3>
                <p className="mt-2 text-muted-foreground">
                    Add your first character to begin your adventure.
                </p>
            </div>
        )}
    </div>
  );
}
