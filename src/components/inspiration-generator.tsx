'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { getInspiration } from '@/app/actions';
import type { InspirationPromptOutput } from '@/ai/flows/generate-inspiration-prompts';
import type { SavedConcept } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, BookMarked, Copy, Loader2, Dices } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

type InspirationGeneratorProps = {
  onSave: (concept: Omit<SavedConcept, 'id' | 'createdAt' | 'userId'>) => void;
};

export function InspirationGenerator({ onSave }: InspirationGeneratorProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [inspiration, setInspiration] = React.useState<InspirationPromptOutput | null>(null);

  const handleClick = () => {
    setInspiration(null);
    startTransition(async () => {
      const { data, error } = await getInspiration();
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error,
        });
      } else if (data) {
        setInspiration(data);
      }
    });
  };
  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard!' });
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-4xl font-headline font-bold">Inspiration Generator</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Stuck in a creative rut? Let fate decide. Roll the dice for a spark of divine (or diabolical) inspiration.
        </p>
      </div>
      <div className="flex justify-center">
        <Button onClick={handleClick} className="w-full max-w-xs h-12 text-lg" disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Dices className="mr-2 h-5 w-5" />}
          Get Inspired
        </Button>
      </div>

      {(isPending || inspiration) && (
        <div className="max-w-3xl mx-auto">
          {isPending ? (
            <Card>
              <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
              <CardContent><Skeleton className="h-4 w-5/6" /></CardContent>
            </Card>
          ) : inspiration && (
            <Card className="animate-in fade-in-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 font-headline"><Sparkles className="h-6 w-6 text-accent" />Inspiration Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg">{inspiration.prompt}</p>
              </CardContent>
              <CardFooter className="gap-2">
                <Button variant="secondary" size="sm" onClick={() => onSave({ type: 'Inspiration', content: inspiration.prompt })}><BookMarked className="mr-2 h-4 w-4"/>Save</Button>
                <Button variant="ghost" size="sm" onClick={() => handleCopy(inspiration.prompt)}><Copy className="mr-2 h-4 w-4"/>Copy</Button>
              </CardFooter>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
