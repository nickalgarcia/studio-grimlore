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
import { MigrateDialog } from '@/components/migrate-dialog';
import { needsMigration } from '@/lib/migrate';
import { signOutUser, useAuth, useUser } from '@/firebase';
import { ArrowUpCircle, BookOpen, Check, ChevronDown, LayoutGrid, LogOut, Palette, Upload, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Campaign } from '@/lib/types';

/**
 * The campaign menu beside the wordmark: a stand-in until the wordmark menu
 * design arrives.
 *
 * It holds the jobs the Director's Cut header has no place for yet: naming
 * and switching campaigns, the campaign overview, Obsidian and roster import, the data
 * upgrade, and sign-out.
 */
export function CampaignSwitcher({
  campaigns, activeCampaignId, onSelect, onImportObsidian, onImportRoster, onOverview, onArtDirection,
}: {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  onSelect: (id: string | null) => void;
  /** The Codex screen that held the import is gone; it waits here for the wordmark menu design. */
  onImportObsidian?: () => void;
  /** Bulk NPCs / places / factions from spreadsheet rows. */
  onImportRoster?: () => void;
  /** Story so far, session log and export: the v3 Forge Overview, waiting for the menu design. */
  onOverview?: () => void;
  /** House style for generated art. */
  onArtDirection?: () => void;
}) {
  const auth = useAuth();
  const { user } = useUser();
  const [managerOpen, setManagerOpen] = React.useState(false);
  const [migrateOpen, setMigrateOpen] = React.useState(false);
  const active = campaigns.find(c => c.id === activeCampaignId) ?? null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="h-full flex items-center gap-2.5 px-3.5 border-[1.5px] border-line2 hover:bg-panel max-w-[16rem]"
          >
            <span className="font-headline text-[16px] font-extrabold tracking-[0.1em] uppercase text-ink truncate">
              {active ? active.name : 'Choose a campaign'}
            </span>
            <ChevronDown className="h-3 w-3 flex-shrink-0 text-mute" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="font-mono font-bold text-[11px] tracking-[0.16em] uppercase text-mute">Campaigns</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/[0.09]" />
          {campaigns.length === 0 ? (
            <DropdownMenuItem disabled>No campaigns yet</DropdownMenuItem>
          ) : (
            campaigns.slice(0, 8).map(c => (
              <DropdownMenuItem key={c.id} onSelect={() => onSelect(c.id)} className="gap-2">
                <Check
                  className={cn(
                    'h-3.5 w-3.5 flex-shrink-0',
                    c.id === activeCampaignId ? 'opacity-100 text-spot' : 'opacity-0',
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
          {active && onOverview && (
            <DropdownMenuItem onSelect={onOverview} className="gap-2">
              <BookOpen className="h-3.5 w-3.5" />
              Campaign overview…
            </DropdownMenuItem>
          )}
          {active && onArtDirection && (
            <DropdownMenuItem onSelect={onArtDirection} className="gap-2">
              <Palette className="h-3.5 w-3.5" />
              Art direction…
            </DropdownMenuItem>
          )}
          {active && onImportObsidian && (
            <DropdownMenuItem onSelect={onImportObsidian} className="gap-2">
              <Upload className="h-3.5 w-3.5" />
              Import Obsidian session…
            </DropdownMenuItem>
          )}
          {active && onImportRoster && (
            <DropdownMenuItem onSelect={onImportRoster} className="gap-2">
              <Users className="h-3.5 w-3.5" />
              Import NPCs, places &amp; factions…
            </DropdownMenuItem>
          )}
          {active && needsMigration(active) && (
            <DropdownMenuItem onSelect={() => setMigrateOpen(true)} className="gap-2">
              <ArrowUpCircle className="h-3.5 w-3.5" />
              Upgrade campaign data…
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-border/[0.09]" />
          <DropdownMenuItem disabled className="font-mono text-[11px] tracking-wider opacity-60">
            {user?.email ?? ''}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => signOutUser(auth)} className="gap-2 text-spot">
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto border-t-4 border-t-spot">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl uppercase tracking-wide">
              Campaign Chronicles
            </DialogTitle>
            <DialogDescription className="text-mute">
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

      {active && (
        <MigrateDialog campaign={active} open={migrateOpen} onOpenChange={setMigrateOpen} />
      )}
    </>
  );
}
