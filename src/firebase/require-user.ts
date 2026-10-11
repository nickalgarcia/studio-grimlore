import 'server-only';
import { getAdminAuth } from '@/firebase/admin';

export type AuthFailure = 'unauthenticated';

export class AuthError extends Error {
  constructor(public readonly reason: AuthFailure) {
    super(reason);
    this.name = 'AuthError';
  }
}

/**
 * The gate in front of every AI entry point (server actions and the streaming
 * route). Resolves to the caller's uid, or throws `AuthError`.
 *
 * Server actions are public POST endpoints whose ids ship in the client bundle,
 * so the token is the only thing between a stranger and the Anthropic key.
 * Call this before validating input, reading a cache, or building a prompt.
 */
export async function requireUser(idToken: unknown): Promise<string> {
  // Arguments arrive straight off the wire; the TypeScript signature of the
  // calling action proves nothing about what was actually sent.
  if (typeof idToken !== 'string' || !idToken) throw new AuthError('unauthenticated');

  try {
    const { uid } = await getAdminAuth().verifyIdToken(idToken);
    return uid;
  } catch (e) {
    // Log the code only: enough to tell an expired token from a misconfigured
    // admin SDK in the server logs, without echoing anything the caller sent.
    console.error('[requireUser] token rejected:', (e as { code?: string })?.code ?? 'unknown');
    throw new AuthError('unauthenticated');
  }
}

/** User-facing copy for an auth failure. Safe to return to the browser. */
export function authErrorMessage(e: unknown): string {
  if (e instanceof AuthError) {
    return 'Your sign-in has expired. Sign in again to use the AI features.';
  }
  return 'Could not verify your sign-in. Please try again.';
}
