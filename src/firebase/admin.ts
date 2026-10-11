import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]!;
  // Token verification only needs the project id (it checks the token's
  // audience against it). Passing it explicitly means that works on Vercel,
  // where none of Google's ambient project env vars exist.
  return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
