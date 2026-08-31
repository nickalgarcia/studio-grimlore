import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { cn } from '@/lib/utils';
import { Archivo, Cinzel, JetBrains_Mono } from 'next/font/google';

export const metadata: Metadata = {
  title: 'Grimlore Forge',
  description: 'A campaign assistant for Dungeon Masters — built for the table.',
};

/** Display: scene titles, entity names, mode words. Uppercase at large sizes. */
const fontCinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['500', '600', '700', '800', '900'],
});

/** UI: all chrome and body copy. Replaces Crimson Pro. */
const fontArchivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  weight: ['400', '500', '600', '700', '800'],
});

/** Data: every number, ref, label and timestamp. */
const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '700', '800'],
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
          'antialiased',
          fontCinzel.variable,
          fontArchivo.variable,
          fontMono.variable,
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
