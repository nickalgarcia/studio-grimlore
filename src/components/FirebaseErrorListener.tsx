'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

/** Plain words for the codes a DM can act on; anything else gets the code itself. */
function describe(error: FirestorePermissionError): string {
  const reading = error.operation === 'get' || error.operation === 'list';
  const what = reading ? 'load' : 'save';
  switch (error.code) {
    case 'permission-denied':
      return `Couldn't ${what} that: the database rules refused it. If this is new, the rules may need deploying.`;
    case 'unavailable':
      return `Couldn't ${what} that: you look offline. It will retry when you reconnect.`;
    case 'resource-exhausted':
      return `Couldn't ${what} that: the database quota is used up for now.`;
    case 'invalid-argument':
      return `Couldn't ${what} that: the data was rejected (it may be too large).`;
    default:
      return `Couldn't ${what} that${error.code ? ` (${error.code})` : ''}. Your other work is unaffected.`;
  }
}

/**
 * Listens for failed Firestore reads and writes (review item U2).
 *
 * In development it still throws, so the full request shows in the Next.js
 * overlay; that's the fastest way to debug a rules problem. In production a
 * throw here took the whole app down mid-session for any failed write, so it
 * shows a toast instead.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (e: FirestorePermissionError) => {
      if (process.env.NODE_ENV === 'production') {
        console.error('[firestore]', e.operation, e.code, e.request?.path);
        toast({ variant: 'destructive', title: 'Database error', description: describe(e) });
      } else {
        setError(e);
      }
    };
    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  if (error) throw error;
  return null;
}
