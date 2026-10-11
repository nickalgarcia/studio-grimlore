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
  } catch {
    return '';
  }
}
