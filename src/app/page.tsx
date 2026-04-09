'use client';

import { GrimloreForge } from '@/components/grimlore-forge';
import { useUser, signOutUser, useAuth } from '@/firebase';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthGate } from '@/components/auth-gate';

// Forge sigil — the star mark from the mockup
function ForgeSigil({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <polygon
        points="16,2 20,12 30,12 22,19 25,30 16,23 7,30 10,19 2,12 12,12"
        fill="none"
        stroke="hsl(174 50% 48%)"
        strokeWidth="1.2"
        opacity="0.85"
      />
      <circle
        cx="16"
        cy="16"
        r="3.2"
        fill="hsl(174 50% 48% / 0.15)"
        stroke="hsl(174 50% 48%)"
        strokeWidth="0.8"
      />
    </svg>
  );
}

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-16 items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <ForgeSigil className="w-8 h-8" />
            <div>
              <div className="font-headline text-lg font-bold text-accent tracking-wide leading-none">
                Grimlore Forge
              </div>
              <div className="label-forge mt-0.5">
                DM Command Center
              </div>
            </div>
          </div>

          {/* Right side */}
          {user && (
            <div className="flex items-center gap-4">
              {/* User avatar circle */}
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center font-headline text-[9px] text-primary">
                {user.email?.slice(0, 2).toUpperCase() ?? 'DM'}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOutUser(auth)}
                className="text-muted-foreground hover:text-foreground font-headline text-xs tracking-widest"
              >
                <LogOut className="mr-2 h-3.5 w-3.5" />
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col">
        {isUserLoading ? (
          <div className="flex items-center justify-center flex-1 py-24 gap-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-muted-foreground font-headline text-sm tracking-widest">
              Summoning the spirits...
            </p>
          </div>
        ) : user ? (
          <GrimloreForge />
        ) : (
          <AuthGate />
        )}
      </main>

    </div>
  );
}
