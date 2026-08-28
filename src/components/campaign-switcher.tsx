'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CampaignManager } from '@/components/campaign-manager';
import { Check, ChevronDown, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Campaign } from '@/lib/types';

/**
 * Campaign selection has no home in a three-mode shell — the design shows the
 * campaign name in the status bar but no way to change it, and the old
 * `campaigns` tab was also where you created and deleted them. This dropdown is
 * that missing surface: recent campaigns inline, and the full manager (create,
 * delete, descriptions, session counts) one click away in a dialog.
 */
export function CampaignSwitcher({
  campaigns, activeCampaignId, onSelect,
}: {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [managerOpen, setManagerOpen] = React.useState(false);
  const active = campaigns.find(c => c.id === activeCampaignId) ?? null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="gap-2 font-headline text-sm tracking-wide max-w-[16rem]"
          >
            <span className="truncate">
              {active ? active.name : 'Choose a campaign'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="label-forge">Campaigns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {campaigns.length === 0 ? (
            <DropdownMenuItem disabled>No campaigns yet</DropdownMenuItem>
          ) : (
            campaigns.slice(0, 8).map(c => (
              <DropdownMenuItem
                key={c.id}
                onSelect={() => onSelect(c.id)}
                className="gap-2"
              >
                <Check
                  className={cn(
                    'h-3.5 w-3.5 flex-shrink-0',
                    c.id === activeCampaignId ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="truncate">{c.name}</span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setManagerOpen(true)} className="gap-2">
            <LayoutGrid className="h-3.5 w-3.5" />
            All campaigns…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl">Campaign Chronicles</DialogTitle>
            <DialogDescription>
              Open, create, or delete a campaign.
            </DialogDescription>
          </DialogHeader>
          <CampaignManager
            activeCampaignId={activeCampaignId}
            setActiveCampaignId={id => {
              onSelect(id);
              if (id) setManagerOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
