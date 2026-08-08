'use client';
import {
  Auth, // Import Auth type for type hinting
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

type ErrorCallback = (error: any) => void;

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string, onError: ErrorCallback): void {
  createUserWithEmailAndPassword(authInstance, email, password)
    .catch(onError);
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string, onError: ErrorCallback): void {
  signInWithEmailAndPassword(authInstance, email, password)
    .catch(onError);
}

/**
 * Sends a password-reset email.
 *
 * Resolves even when the address isn't registered — Firebase deliberately
 * doesn't distinguish, so the UI must not either (it would leak which emails
 * have accounts). Only genuine failures reach `onError`.
 */
export function initiatePasswordReset(authInstance: Auth, email: string, onError: ErrorCallback): Promise<void> {
  return sendPasswordResetEmail(authInstance, email).catch(onError);
}

/** Signs out the current user. */
export function signOutUser(authInstance: Auth): void {
  signOut(authInstance);
}
