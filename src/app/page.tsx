'use client';

import { GrimloreForge } from '@/components/grimlore-forge';
import { useUser } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
import { ForgeSigil } from '@/components/forge-sigil';

/**
 * Fixed cockpit: the page itself never scrolls, only the regions inside it.
 * That is what keeps the party dock on screen for a whole session.
 *
 * The old sticky app header is gone — the 42px status bar inside GrimloreForge
 * replaces it, and sign-out moved into the campaign menu there.
 */
export default function Home() {
  const { user, isUserLoading } = useUser();

  if (isUserLoading) {
    return (
      <div className="h-screen overflow-hidden flex items-center justify-center gap-4 bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-oxblood-bright" />
        <p className="label-forge">Summoning the spirits…</p>
      </div>
    );
  }

  if (!user) {
    // The gate is the one screen allowed to scroll on its own. It carries the
    // mark itself now that the app header is gone — otherwise the sign-in
    // screen would be unbranded.
    return (
      <div className="h-screen overflow-y-auto bg-background">
        <div className="flex items-center gap-3 px-[26px] h-[42px] border-b border-oxblood/40">
          <ForgeSigil className="w-5 h-5" />
          <span className="font-headline text-[13px] font-extrabold tracking-[0.11em] uppercase text-bone">
            Grimlore Forge
          </span>
          <span className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-bone-faint">
            DM Command Center
          </span>
        </div>
        <AuthGate />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background text-foreground">
      <GrimloreForge />
    </div>
  );
}
