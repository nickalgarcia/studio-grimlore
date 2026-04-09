import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { cn } from '@/lib/utils';
import { Cinzel, Crimson_Pro } from 'next/font/google';

export const metadata: Metadata = {
  title: 'Grimlore Forge',
  description: 'A campaign assistant for Dungeon Masters — built for the table.',
};

const fontCinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['400', '600', '700'],
});

const fontCrimsonPro = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-crimson',
  weight: ['300', '400'],
  style: ['normal', 'italic'],
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
          'min-h-screen antialiased',
          fontCinzel.variable,
          fontCrimsonPro.variable,
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
