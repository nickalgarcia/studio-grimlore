'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { CampaignSwitcher } from '@/components/campaign-switcher';
import { ObsidianImportDialog } from '@/components/obsidian-import-dialog';
import { CampaignOverview } from '@/components/forge/campaign-overview';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CommandBar } from '@/components/shell/command-bar';
import { PaletteSwitcher, ThemeToggle } from '@/components/shell/appearance';
import { GLYPH } from '@/lib/pages';
import { cn } from '@/lib/utils';

type Section = 'story' | 'table' | 'rules';

/** STORY covers the whole repository side: Story, Issue, Page and Prep. */
function sectionOf(pathname: string): Section {
  if (pathname.startsWith('/table')) return 'table';
  if (pathname.startsWith('/rules')) return 'rules';
  return 'story';
}

/**
 * Global chrome: wordmark, STORY / TABLE, RULES and the command bar.
 *
 * The tabs are links, so they're a <nav> with `aria-current` rather than the
 * spec's `role=tablist`: tab semantics promise arrow-key switching inside the
 * page, and these change the URL.
 */
export function Header() {
  const pathname = usePathname();
  const section = sectionOf(pathname);
  const { campaigns, activeCampaign, setActiveCampaignId, nextIssueNumber, codex } = useCampaign();
  const [importOpen, setImportOpen] = React.useState(false);
  const [overviewOpen, setOverviewOpen] = React.useState(false);

  const tab = (href: string, active: boolean, activeClass: string, children: React.ReactNode) => (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 font-headline font-extrabold text-[16px] tracking-[0.1em] uppercase',
        active ? activeClass : 'hover:bg-panel',
      )}
    >
      {children}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 h-16 flex-none bg-bg border-b border-line">
      <div className="h-full flex items-center gap-3.5 px-5">
        <Link href="/" className="flex-none font-headline font-black text-[26px] tracking-[0.07em] uppercase">
          Grimlore
        </Link>

        {/* Stand-in for the wordmark menu until its design arrives. */}
        <div className="flex-none h-10 flex items-stretch">
          <CampaignSwitcher
            campaigns={campaigns ?? []}
            activeCampaignId={activeCampaign?.id ?? null}
            onSelect={setActiveCampaignId}
            onImportObsidian={() => setImportOpen(true)}
            onOverview={() => setOverviewOpen(true)}
          />
        </div>

        <nav aria-label="Mode" className="flex-none flex border-[1.5px] border-ink">
          {tab('/', section === 'story', 'bg-ink text-bg', 'Story')}
          {tab('/table', section === 'table', 'bg-spot text-spot-on', <>
            <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full bg-current" />
            Table
          </>)}
        </nav>

        <Link
          href="/rules"
          aria-current={section === 'rules' ? 'page' : undefined}
          className={cn(
            'flex-none h-[38px] inline-flex items-center px-3.5 border-[1.5px] border-line2',
            'font-headline font-extrabold text-[16px] tracking-[0.1em] uppercase',
            section === 'rules' ? 'bg-ink text-bg' : 'hover:bg-panel',
          )}
        >
          {GLYPH.rule} Rules
        </Link>

        <CommandBar />
        <PaletteSwitcher />
        <ThemeToggle />
      </div>

      {activeCampaign && (
        <ObsidianImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          campaignId={activeCampaign.id}
          campaignName={activeCampaign.name}
          nextSessionNumber={nextIssueNumber}
          onImported={() => setImportOpen(false)}
        />
      )}
      {activeCampaign && (
        <Dialog open={overviewOpen} onOpenChange={setOverviewOpen}>
          <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>The story so far</DialogTitle>
              <DialogDescription>Campaign summary, quick session log and export.</DialogDescription>
            </DialogHeader>
            <CampaignOverview campaign={activeCampaign} codex={codex} />
          </DialogContent>
        </Dialog>
      )}
    </header>
  );
}
