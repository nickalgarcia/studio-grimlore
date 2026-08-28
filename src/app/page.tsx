'use client';

import { GrimloreForge } from '@/components/grimlore-forge';
import { useUser } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
import { ForgeSigil } from '@/components/forge-sigil';
import { Backdrop } from '@/components/backdrop';
import { useParallax } from '@/hooks/use-parallax';

/**
 * Fixed cockpit: the page itself never scrolls, only the regions inside it.
 * That is what keeps the party dock on screen for a whole session.
 *
 * The old sticky app header is gone — the 42px status bar inside GrimloreForge
 * replaces it, and sign-out moved into the campaign menu there.
 */
/**
 * Motion flags. Exposed here so both layers can be turned off per-user without
 * touching the components that consume them.
 */
const MOTION = { backdrop: true, parallax: true, ambient: true };

export default function Home() {
  const { user, isUserLoading } = useUser();
  const rootRef = useParallax(MOTION.parallax);

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
      <div className="relative h-screen overflow-y-auto bg-background">
        {/* The gate stands in the same world as the app behind it. */}
        {MOTION.backdrop && <Backdrop ambient={MOTION.ambient} />}
        <div className="relative z-[1] flex items-center gap-3 px-[26px] h-[42px] border-b border-oxblood/40">
          <ForgeSigil className="w-5 h-5" />
          <span className="font-headline text-[13px] font-extrabold tracking-[0.11em] uppercase text-bone">
            Grimlore Forge
          </span>
          <span className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-bone-faint">
            DM Command Center
          </span>
        </div>
        <div className="relative z-[1]">
          <AuthGate />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef as React.RefObject<HTMLDivElement>}
      className="relative h-screen overflow-hidden bg-background text-foreground"
    >
      {MOTION.backdrop && <Backdrop ambient={MOTION.ambient} />}
      {/* Content sits at z-index 1 explicitly; the backdrop is pinned to 0. */}
      <div className="relative z-[1] h-full flex flex-col">
        <GrimloreForge />
      </div>
    </div>
  );
}
