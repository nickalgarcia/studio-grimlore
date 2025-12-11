'use client';

import { GrimloreForge } from '@/components/grimlore-forge';
import { Logo } from '@/components/logo';
import { useUser, signOutUser, useAuth } from '@/firebase';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthGate } from '@/components/auth-gate';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-20 items-center justify-between">
          <div className="flex gap-4 items-center">
            <Logo />
            <h1 className="text-3xl md:text-4xl font-headline font-bold text-foreground tracking-wider">
              GRIMLORE FORGE
            </h1>
          </div>
          {user && (
            <Button variant="ghost" onClick={() => signOutUser(auth)}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          )}
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        {isUserLoading ? (
          <div className="flex items-center justify-center flex-1 py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">
              Summoning the spirits...
            </p>
          </div>
        ) : user ? (
          <GrimloreForge />
        ) : (
          <AuthGate />
        )}
      </main>
      <footer className="py-6 md:px-8 md:py-0">
        <div className="container flex flex-col items-center justify-center gap-4 md:h-24">
          <p className="text-center text-sm leading-loose text-muted-foreground">
            A premium dark-fantasy experience that feels heroic, polished, and accessible.
          </p>
        </div>
      </footer>
    </div>
  );
}
