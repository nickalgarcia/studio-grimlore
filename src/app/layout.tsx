import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { cn } from '@/lib/utils';
import { Inter, Cinzel } from 'next/font/google';

export const metadata: Metadata = {
  title: 'Grimlore Forge',
  description: 'A reactive D&D campaign assistant for Dungeon Masters',
};

const fontInter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const fontCinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={cn(
          'min-h-screen font-body antialiased',
          fontInter.variable,
          fontCinzel.variable
        )}
        suppressHydrationWarning
      >
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
