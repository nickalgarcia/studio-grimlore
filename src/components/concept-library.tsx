
'use client';

import * as React from 'react';
import type { SavedConcept } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Scroll, Skull, User, Sparkles, Trash2, Library, Quote } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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
import { Skeleton } from './ui/skeleton';
import { getSafeDate } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { doc, collection, query, orderBy } from 'firebase/firestore';


export function ConceptLibrary() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const conceptsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/concepts`), orderBy('createdAt', 'desc'));
  }, [user, firestore]);
  
  const { data: concepts, isLoading, error } = useCollection<SavedConcept>(conceptsQuery);
  
  React.useEffect(() => {
    if (error) {
      toast({ variant: 'destructive', title: 'Error loading library', description: error.message });
    }
  }, [error, toast]);


  const handleDelete = (id: string) => {
    if (!user) return;
    const docRef = doc(firestore, 'users', user.uid, 'concepts', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: 'Concept removed from library.' });
  };


  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="text-center">
            <h2 className="text-4xl font-headline font-bold">Concept Library</h2>
            <p className="text-muted-foreground mt-2">Loading your treasured ideas...</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
                <Card key={i}><CardHeader><Skeleton className="h-5 w-1/3" /></CardHeader><CardContent><div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div></CardContent><CardFooter><Skeleton className="h-10 w-24" /></CardFooter></Card>
            ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-4xl font-headline font-bold">Concept Library</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Your personal grimoire of forged plots, perilous encounters, and peculiar personas.
        </p>
      </div>

      {!concepts || concepts.length === 0 ? (
        <div className="text-center py-16 bg-card/50 border border-dashed rounded-lg max-w-lg mx-auto">
          <Library className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">{user ? 'Your library is empty' : 'Sign in to see your library'}</h3>
          <p className="mt-1 text-muted-foreground">
            {user ? 'Generate some ideas or inspiration to save them here.' : 'Your saved concepts will appear here once you sign in.'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {concepts.map((concept) => {
            const safeDate = getSafeDate(concept.createdAt);
            return (
            <Card key={concept.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 font-headline">
                  {iconMap[concept.type]}
                  <span>{concept.type}</span>
                </CardTitle>
                {concept.context && (
                    <CardDescription className="pt-2 italic">
                        Context: "{concept.context.length > 50 ? `${concept.context.substring(0, 50)}...` : concept.context}"
                    </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-grow">
                <p>{concept.content}</p>
              </CardContent>
              <CardFooter className="flex justify-between items-center text-sm text-muted-foreground">
                <time dateTime={safeDate ? safeDate.toISOString() : ''}>
                  {safeDate ? formatDistanceToNow(safeDate, { addSuffix: true }) : ''}
                </time>
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
                        This action cannot be undone. This will permanently delete this concept
                        from your library.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(concept.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          )})}
        </div>
      )}
    </div>
  );
}

const iconMap: { [key: string]: React.ReactElement } = {
  'Plot Hook': <Scroll className="h-5 w-5 text-accent" />,
  'Encounter Idea': <Skull className="h-5 w-5 text-accent" />,
  'NPC Concept': <User className="h-5 w-5 text-accent" />,
  'Inspiration': <Sparkles className="h-5 w-5 text-accent" />,
  'Dialog': <Quote className="h-5 w-5 text-accent" />,
};
