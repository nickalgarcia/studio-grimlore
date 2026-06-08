import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]!;
  return initializeApp();
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
