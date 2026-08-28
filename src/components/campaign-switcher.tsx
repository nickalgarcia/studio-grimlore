'use client';

import * as React from 'react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CampaignManager } from '@/components/campaign-manager';
import { signOutUser, useAuth, useUser } from '@/firebase';
import { Check, ChevronDown, LayoutGrid, LogOut } from 'lucide-react';
import { ForgeSigil } from '@/components/forge-sigil';
import { cn } from '@/lib/utils';
import type { Campaign } from '@/lib/types';

/**
 * The oxblood slab at the head of the status bar.
 *
 * It carries three jobs the redesign left homeless: naming the active
 * campaign, switching or creating one (the design shows the name but no way to
 * change it), and sign-out — which lost its home when the app header was
 * replaced by the status bar.
 */
export function CampaignSwitcher({
  campaigns, activeCampaignId, onSelect,
}: {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const auth = useAuth();
  const { user } = useUser();
  const [managerOpen, setManagerOpen] = React.useState(false);
  const active = campaigns.find(c => c.id === activeCampaignId) ?? null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="h-full flex items-center gap-2.5 px-[18px] bg-oxblood shadow-slab hover:bg-oxblood/90 transition-colors max-w-[22rem]"
          >
            <ForgeSigil className="w-4 h-4 [--oxblood-bright:40_40%_94%] [--oxblood:40_40%_94%]" />
            <span className="font-headline text-[13px] font-extrabold tracking-[0.11em] uppercase text-bone truncate">
              {active ? active.name : 'Choose a campaign'}
            </span>
            <ChevronDown className="h-3 w-3 flex-shrink-0 text-bone/70" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64 bg-popover border-border/[0.12]">
          <DropdownMenuLabel className="label-forge">Campaigns</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/[0.09]" />
          {campaigns.length === 0 ? (
            <DropdownMenuItem disabled>No campaigns yet</DropdownMenuItem>
          ) : (
            campaigns.slice(0, 8).map(c => (
              <DropdownMenuItem key={c.id} onSelect={() => onSelect(c.id)} className="gap-2">
                <Check
                  className={cn(
                    'h-3.5 w-3.5 flex-shrink-0',
                    c.id === activeCampaignId ? 'opacity-100 text-oxblood-bright' : 'opacity-0',
                  )}
                />
                <span className="truncate">{c.name}</span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator className="bg-border/[0.09]" />
          <DropdownMenuItem onSelect={() => setManagerOpen(true)} className="gap-2">
            <LayoutGrid className="h-3.5 w-3.5" />
            All campaigns…
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border/[0.09]" />
          <DropdownMenuItem disabled className="font-mono text-[10px] tracking-wider opacity-60">
            {user?.email ?? ''}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => signOutUser(auth)} className="gap-2 text-oxblood-bright">
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto shadow-modal border-t-4 border-t-oxblood">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl uppercase tracking-wide">
              Campaign Chronicles
            </DialogTitle>
            <DialogDescription className="text-bone-dim">
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
