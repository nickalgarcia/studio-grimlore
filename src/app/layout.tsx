import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { cn } from '@/lib/utils';
import { PREFS_SCRIPT } from '@/lib/prefs';
import { Big_Shoulders, JetBrains_Mono, Newsreader } from 'next/font/google';

export const metadata: Metadata = {
  title: 'Previously',
  description: 'A campaign repository and table console for one Dungeon Master.',
};

/**
 * Display: headlines, names, buttons, nav. Google folded "Big Shoulders
 * Display" into "Big Shoulders" with an optical-size axis; globals.css pins
 * it to the display end (opsz 72).
 */
const fontDisplay = Big_Shoulders({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['opsz'],
});

/** Reading: prose, ledes, list titles, inputs. Optical sizing follows font-size. */
const fontReading = Newsreader({
  subsets: ['latin'],
  variable: '--font-reading',
  style: ['normal', 'italic'],
  axes: ['opsz'],
});

/** Labels and data: section labels, meta, counts, chips, kbd. */
const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['500', '700'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The defaults are rendered here and replaced by PREFS_SCRIPT before
    // paint, so the server markup and the DOM can differ on these two
    // attributes; that's expected, hence suppressHydrationWarning.
    <html lang="en" data-palette="hyperspace" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Static string from lib/prefs, no user or model input. It must run
            before <body> paints, which is why it's inline and not a module. */}
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body
        className={cn('antialiased', fontDisplay.variable, fontReading.variable, fontMono.variable)}
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
