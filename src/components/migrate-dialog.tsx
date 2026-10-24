'use client';

import * as React from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { applyMigration, planMigration, type MigrationPlan } from '@/lib/migrate';
import { issueLabel } from '@/lib/issues';
import type { Campaign } from '@/lib/types';
import { Loader2 } from 'lucide-react';

type Step =
  | { kind: 'planning' }
  | { kind: 'ready'; plan: MigrationPlan }
  | { kind: 'applying'; plan: MigrationPlan }
  | { kind: 'error'; message: string };

/**
 * Dry run first, then write. Shows exactly which sessions change and how,
 * because this writes to every session in the campaign.
 *
 * Temporary: it lives in the v3 campaign menu until the wordmark menu replaces
 * it, and disappears once the campaign is on the current schema.
 */
export function MigrateDialog({
  campaign, open, onOpenChange,
}: {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [step, setStep] = React.useState<Step>({ kind: 'planning' });

  React.useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setStep({ kind: 'planning' });
    planMigration(firestore, user.uid, { id: campaign.id, schemaVersion: campaign.schemaVersion })
      .then(plan => { if (!cancelled) setStep({ kind: 'ready', plan }); })
      .catch(() => { if (!cancelled) setStep({ kind: 'error', message: 'Could not read the sessions. Check your connection and try again.' }); });
    return () => { cancelled = true; };
    // Keyed on id and version, not the object: the campaigns listener hands
    // back a new object on every snapshot, which would re-plan mid-review.
  }, [open, user, firestore, campaign.id, campaign.schemaVersion]);

  const apply = async () => {
    if (step.kind !== 'ready' || !user) return;
    const { plan } = step;
    setStep({ kind: 'applying', plan });
    try {
      await applyMigration(firestore, user.uid, plan);
      toast({ title: 'Campaign upgraded', description: `${plan.patches.length} of ${plan.sessionCount} sessions updated.` });
      onOpenChange(false);
    } catch {
      // Unstamped on failure, so the menu item stays and a re-run picks up
      // whatever didn't land.
      setStep({ kind: 'error', message: 'Some writes failed. Nothing was lost; run it again to finish.' });
    }
  };

  const plan = step.kind === 'ready' || step.kind === 'applying' ? step.plan : null;
  const recaps = plan?.patches.filter(p => p.set.recap !== undefined).length ?? 0;
  const loglines = plan?.patches.filter(p => p.set.logline !== undefined) ?? [];

  return (
    <Dialog open={open} onOpenChange={o => step.kind !== 'applying' && onOpenChange(o)}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl uppercase tracking-wide">
            Upgrade campaign data
          </DialogTitle>
          <DialogDescription>
            Prepares {campaign.name} for the new design. Nothing is deleted, and existing summaries are kept.
          </DialogDescription>
        </DialogHeader>

        {step.kind === 'planning' && (
          <div className="flex items-center gap-3 py-6 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking {campaign.name}&apos;s sessions…
          </div>
        )}

        {step.kind === 'error' && <p className="py-4 text-sm text-destructive">{step.message}</p>}

        {plan && (
          <div className="space-y-4 text-sm">
            <ul className="list-disc pl-5 space-y-1">
              <li>{recaps} of {plan.sessionCount} sessions get their summary copied into the new recap field.</li>
              <li>{loglines.length} get a one-line logline from the first sentence of the recap.</li>
              <li>Titles are left blank and show as &ldquo;Issue #N&rdquo; until you write or draft them.</li>
            </ul>
            {plan.patches.length === 0 && <p>Every session is already up to date. This just marks the campaign as upgraded.</p>}
            {loglines.length > 0 && (
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] mb-2">Loglines to be written</p>
                <ul className="space-y-2">
                  {loglines.map(p => (
                    <li key={p.id} className="grid grid-cols-[84px_1fr] gap-2">
                      <span className="font-mono text-[12px]">{issueLabel(p.sessionNumber)}</span>
                      <span className="italic">{p.set.logline}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={step.kind === 'applying'}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={step.kind !== 'ready'}>
            {step.kind === 'applying' && <Loader2 className="h-4 w-4 animate-spin" />}
            Upgrade {plan ? `${plan.patches.length} sessions` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
