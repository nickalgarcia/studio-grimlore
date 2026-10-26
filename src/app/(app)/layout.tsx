'use client';

import { Loader2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { AuthGate } from '@/components/auth-gate';
import { CampaignProvider, useCampaign } from '@/components/campaign/campaign-provider';
import { Header } from '@/components/shell/header';
import { LogoMark } from '@/components/shell/logo-mark';

/**
 * Every screen lives under this layout. The App Router keeps it mounted across
 * navigation, which is what lets the Firestore listeners, the live session and
 * an in-flight co-pilot reply survive moving between routes.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-3 bg-bg">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="font-mono text-[12px] tracking-[0.16em] uppercase">Opening the longbox…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-line">
          <LogoMark className="w-[30px] h-[30px]" />
          <span className="font-headline font-black text-[26px] tracking-[0.07em] uppercase">Previously</span>
        </div>
        <AuthGate />
      </div>
    );
  }

  return (
    <CampaignProvider>
      <div className="min-h-screen flex flex-col bg-bg text-ink">
        <Header />
        <main className="flex-1 min-h-0 flex flex-col">
          <CampaignGate>{children}</CampaignGate>
        </main>
      </div>
    </CampaignProvider>
  );
}

/** Screens all assume an active campaign; the header stays usable to create one. */
function CampaignGate({ children }: { children: React.ReactNode }) {
  const { activeCampaign, campaignsLoading } = useCampaign();
  if (activeCampaign) return <>{children}</>;
  return (
    <div className="flex-1 flex items-center justify-center italic text-mute p-8 text-center">
      {campaignsLoading ? 'Loading your campaigns…' : 'Create a campaign to begin: use the campaign menu above.'}
    </div>
  );
}
