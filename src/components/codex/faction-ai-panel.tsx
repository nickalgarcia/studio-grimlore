'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getLiveSessionResponse } from '@/app/actions';
import { Brain, Loader2 } from 'lucide-react';
import type { Faction } from '@/lib/types';

/**
 * "What would they do?" — moved out of the deleted faction-manager, unchanged
 * in behaviour. It lives in the Codex detail pane now, which is where you are
 * standing when the question occurs to you.
 */
export function FactionAiPanel({
  faction, campaignName, campaignDescription, sessionContext,
}: {
  faction: Faction;
  campaignName: string;
  campaignDescription?: string;
  sessionContext?: string;
}) {
  const [situation, setSituation] = React.useState('');
  const [response, setResponse] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();

  const handleAsk = async () => {
    if (!situation.trim()) return;
    setIsLoading(true);
    setResponse('');

    const systemContext = [
      `Campaign: ${campaignName}`,
      campaignDescription ? `Premise: ${campaignDescription}` : '',
      `You are roleplaying as the leadership council of the faction: ${faction.name}`,
      `Faction description: ${faction.description}`,
      faction.leader ? `Leader: ${faction.leader}` : '',
      faction.homeBase ? `Base of operations: ${faction.homeBase}` : '',
      `Current disposition toward the party: ${faction.disposition}`,
      faction.currentAgenda ? `Current agenda: ${faction.currentAgenda}` : '',
      faction.whatTheyKnow ? `What they know about the party: ${faction.whatTheyKnow}` : '',
      sessionContext ? `Recent campaign events: ${sessionContext}` : '',
    ].filter(Boolean).join('\n');

    const { data, error } = await getLiveSessionResponse({
      messages: [{
        role: 'user',
        content: `${systemContext}\n\nGiven everything you know about ${faction.name} and their current situation, how would they respond to this:\n\n${situation}\n\nAnswer as the faction's leadership — what do they decide, what orders do they give, and what might the party see or hear as a result? Be specific and grounded in the faction's goals and current disposition.`,
      }],
      campaignContext: { campaignName, campaignDescription },
    });

    setIsLoading(false);
    if (error || !data) {
      toast({ variant: 'destructive', title: 'Could not get response', description: error ?? 'Try again.' });
      return;
    }
    setResponse(data.response);
  };

  return (
    <div className="space-y-3 pt-3 border-t border-border/50">
      <p className="label-forge flex items-center gap-2">
        <Brain className="h-3.5 w-3.5" /> What Would They Do?
      </p>
      <Textarea
        value={situation}
        onChange={e => setSituation(e.target.value)}
        placeholder={`Describe a situation and ask how ${faction.name} would respond...`}
        className="min-h-[80px] text-sm font-body"
        disabled={isLoading}
      />
      <Button
        onClick={handleAsk}
        disabled={!situation.trim() || isLoading}
        size="sm"
        variant="outline"
        className="border-primary/30 text-primary hover:bg-primary/10"
      >
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Brain className="h-3.5 w-3.5 mr-2" />}
        Ask Claude
      </Button>
      {response && (
        <div className="bg-primary/5 border border-primary/15 rounded-lg p-4 text-sm font-body leading-relaxed whitespace-pre-wrap text-foreground/90">
          {response}
        </div>
      )}
    </div>
  );
}
