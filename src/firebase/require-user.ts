import 'server-only';
import { getAdminAuth } from '@/firebase/admin';

/**
 * - `unauthenticated` — the token is missing, malformed or expired. Signing in again fixes it.
 * - `forbidden` — a real account, but not one on the allowlist.
 * - `unavailable` — the server could not check the token at all (wrong project
 *   id, no network to Google's certs). Nothing the user does in the UI fixes it.
 */
export type AuthFailure = 'unauthenticated' | 'forbidden' | 'unavailable';

export class AuthError extends Error {
  constructor(public readonly reason: AuthFailure) {
    super(reason);
    this.name = 'AuthError';
  }
}

/**
 * Comma-separated Firebase uids allowed to use the AI. Read per call so a
 * changed env var never hides behind a module-level cache.
 *
 * Fails closed: unset or empty means nobody. A valid token only proves someone
 * has *an* account in this Firebase project, and this app has one owner.
 */
function allowedUids(): Set<string> {
  return new Set(
    (process.env.ALLOWED_UIDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  );
}

// Admin SDK codes that mean the *token* is the problem. Anything else is the
// server failing to verify, and telling the DM to sign in again mid-session
// would send them round in circles.
const TOKEN_FAULTS = new Set([
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/user-disabled',
  'auth/argument-error',
]);

function classifyVerifyError(e: unknown): AuthFailure {
  const { code, message } = (e ?? {}) as { code?: string; message?: string };
  if (!code || !TOKEN_FAULTS.has(code)) return 'unavailable';
  // A token minted for a different project is reported as a plain
  // `auth/argument-error` too, and only the message tells them apart. For the
  // owner that means the server's project id is wrong, not their sign-in. If
  // the SDK ever rewords this, the result degrades to 'unauthenticated'.
  if (code === 'auth/argument-error' && /incorrect "(aud|iss)"/.test(message ?? '')) return 'unavailable';
  return 'unauthenticated';
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

  let uid: string;
  try {
    ({ uid } = await getAdminAuth().verifyIdToken(idToken));
  } catch (e) {
    const reason = classifyVerifyError(e);
    const { code, message } = (e ?? {}) as { code?: string; message?: string };
    if (reason === 'unavailable') {
      // A server fault, so the full message is worth having. It can quote
      // claims from the caller's token, hence JSON.stringify: no raw newlines
      // forging extra log lines.
      console.error('[requireUser] could not verify token:', code ?? 'unknown', JSON.stringify(message ?? String(e)));
    } else {
      console.error('[requireUser] token rejected:', code);
    }
    throw new AuthError(reason);
  }

  if (!allowedUids().has(uid)) {
    // The uid is not a secret, and logging it is how the owner finds the value
    // to put in ALLOWED_UIDS the first time this trips.
    console.warn('[requireUser] uid not in ALLOWED_UIDS:', uid);
    throw new AuthError('forbidden');
  }
  return uid;
}

function failureOf(e: unknown): AuthFailure {
  return e instanceof AuthError ? e.reason : 'unavailable';
}

const MESSAGE: Record<AuthFailure, string> = {
  unauthenticated: 'Your sign-in has expired. Sign in again to use the AI features.',
  forbidden: 'This account is not authorised to use the AI features.',
  unavailable: 'The server could not verify your sign-in. This is a server configuration or network problem, not your password.',
};

const STATUS: Record<AuthFailure, number> = {
  unauthenticated: 401,
  forbidden: 403,
  unavailable: 503,
};

/** User-facing copy for an auth failure. Safe to return to the browser. */
export function authErrorMessage(e: unknown): string {
  return MESSAGE[failureOf(e)];
}

/** HTTP status for an auth failure, for route handlers. */
export function authErrorStatus(e: unknown): number {
  return STATUS[failureOf(e)];
}
