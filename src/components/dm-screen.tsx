'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { getRuleInfo } from '@/app/actions';
import type { LookupRuleOutput } from '@/ai/flows/lookup-rule-flow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, HelpCircle } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { Input } from './ui/input';

export function DMScreen() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [result, setResult] = React.useState<LookupRuleOutput | null>(null);
  const [resultTitle, setResultTitle] = React.useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setResult(null);
    setResultTitle('');

    startTransition(async () => {
      const submittedTerm = searchTerm;
      const { data, error } = await getRuleInfo(submittedTerm);
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error,
        });
      } else if (data) {
        setResult(data);
        setResultTitle(submittedTerm);
      }
    });
  };

  const formattedExplanation = React.useMemo(() => {
    if (!result?.explanation) return '';
    
    let html = result.explanation
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
      
    html = html.split(/\n\s*\n/).map(paragraph => {
      if (paragraph.match(/^\s*[-*]/)) {
        const items = paragraph.split('\n').map(item => 
          `<li>${item.replace(/^\s*[-*]\s*/, '').trim()}</li>`
        ).join('');
        return `<ul class="list-disc pl-5 space-y-1 mt-2">${items}</ul>`;
      }
      
      paragraph = paragraph.replace(/Level\s*(\d+):/g, '<br/><strong>Level $1:</strong>');
      return `<p>${paragraph}</p>`;
    }).join('');

    return html.replace(/<p><br\/>/g, '<p>');
  }, [result]);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-4xl font-headline font-bold">Digital DM Screen</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Quickly look up any D&amp;D 5e rule, condition, or term.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-4">
        <Input
          placeholder="e.g., Grappled, Exhaustion, Cover..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-12 text-lg text-center"
          disabled={isPending}
        />
        <Button type="submit" className="w-full h-12 text-lg" disabled={isPending || !searchTerm}>
          {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <HelpCircle className="mr-2 h-5 w-5" />}
          Look Up Rule
        </Button>
      </form>

      {(isPending || result) && (
        <div className="max-w-3xl mx-auto">
          {isPending ? (
            <Card>
              <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
            </Card>
          ) : result && (
            <Card className="animate-in fade-in-50">
              <CardHeader>
                <CardTitle className="font-headline text-2xl text-accent-foreground capitalize">{resultTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-invert max-w-none prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-accent-foreground whitespace-normal font-body text-base" dangerouslySetInnerHTML={{ __html: formattedExplanation }} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
