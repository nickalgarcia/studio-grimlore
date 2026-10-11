import type { User } from 'firebase/auth';

/**
 * The ID token every AI server action takes as its first argument.
 *
 * Never rejects: a signed-out user or a failed refresh yields '', which the
 * server turns into the ordinary `{ error }` result. Callers set a loading flag
 * before awaiting, so a throw here would leave their spinner stuck.
 */
export async function idTokenFor(user: User | null | undefined): Promise<string> {
  try {
    return (await user?.getIdToken()) ?? '';
  } catch (e) {
    // The server only ever sees '' and reports "sign in again", so this log is
    // the one place the real cause (offline, disabled account) survives.
    console.error('[idTokenFor] could not get an ID token:', (e as { code?: string })?.code ?? e);
    return '';
  }
}
