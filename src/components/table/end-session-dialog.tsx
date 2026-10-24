'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCampaign } from '@/components/campaign/campaign-provider';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ToastAction } from '@/components/ui/toast';
import { usePrepWriter, useRuleWriter, useThreadWriter } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { issueHref } from '@/lib/pages';

/**
 * END SESSION, with the confirmation review item U1 asked for: nothing is
 * cleared until the DM says so, and then it is archived rather than lost.
 *
 * After the live session is saved as the issue (see endSession), the played
 * issue's prep is archived, tonight's rule flags and thread pulls are cleared
 * for the next issue, and the DM lands on Story with an offer to draft the
 * recap.
 */
export function EndSessionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const { activeCampaign, live, nextIssueNumber, prep, rules, threads } = useCampaign();
  const { archive } = usePrepWriter(activeCampaign?.id);
  const { setFlags } = useRuleWriter();
  const { updateThread } = useThreadWriter(activeCampaign?.id);

  const n = nextIssueNumber;
  const captures = live.captures.length;
  const spotlit = live.spotlit.length;

  const end = async () => {
    const ok = await live.endSession({
      sessionNumber: n,
      ...(prep?.prep?.sessionTitle ? { title: prep.prep.sessionTitle } : {}),
      ...(prep?.coverUrl ? { coverUrl: prep.coverUrl } : {}),
    });
    if (!ok) return;

    await Promise.all([
      archive(prep, n),
      ...rules.filter(r => r.tonight).map(r => setFlags(r, { tonight: false })),
      ...(threads ?? []).filter(t => t.pullNext).map(t => updateThread(t.id, { pullNext: false })),
    ]).catch(() => { /* the issue is saved; a stale flag is cosmetic */ });

    onOpenChange(false);
    router.push(`/?issue=${n}`);
    toast({
      title: `ISSUE #${n} SAVED`,
      action: (
        <ToastAction altText="Draft the recap now" onClick={() => router.push(`${issueHref(n)}?draft=recap`)}>
          Draft recap now?
        </ToastAction>
      ),
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={o => !live.isEnding && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End issue #{n}?</AlertDialogTitle>
          <AlertDialogDescription>
            Tonight is saved as Issue #{n}: {captures} {captures === 1 ? 'capture' : 'captures'}
            {live.hasNotes ? ', your notes' : ''}{spotlit ? `, ${spotlit} spotlit` : ''} and the co-pilot log.
            The table is then cleared for the next issue. You draft the recap afterwards.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={live.isEnding}>Keep playing</AlertDialogCancel>
          <AlertDialogAction
            onClick={e => { e.preventDefault(); void end(); }}
            disabled={live.isEnding}
          >
            {live.isEnding ? 'Saving…' : 'End session'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
