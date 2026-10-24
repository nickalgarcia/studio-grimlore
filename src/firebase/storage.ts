'use client';

import * as React from 'react';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { useFirebaseApp, useUser } from '@/firebase/provider';

/** Longest edge after downscaling. Covers show at ≤280px, portraits at ≤400px; 1600 leaves room for retina. */
const MAX_EDGE = 1600;
const QUALITY = 0.86;
const ACCEPTED = /^image\/(png|jpeg|webp|gif)$/;

export class UploadError extends Error {}

/**
 * Re-encode to WebP at a sane size before upload. A phone photo is 4–8 MB and
 * 4000px wide; the slots it fills are a few hundred pixels. GIFs keep their
 * original bytes so an animated one isn't flattened to its first frame.
 */
async function prepareImage(file: File): Promise<Blob> {
  if (!ACCEPTED.test(file.type)) {
    throw new UploadError('Use a PNG, JPEG, WebP or GIF image.');
  }
  if (file.type === 'image/gif') return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new UploadError('This browser cannot process images.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', QUALITY));
  // Safari before 16 can't encode WebP and hands back PNG or null; send the
  // original rather than failing.
  return blob && blob.type === 'image/webp' ? blob : file;
}

/** Firebase's codes, in words the DM can act on. */
function explain(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (e instanceof UploadError) return e.message;
  if (code === 'storage/unauthorized') return 'Storage refused the upload. The storage rules may need deploying.';
  if (code === 'storage/bucket-not-found' || code === 'storage/project-not-found' || code === 'storage/no-default-bucket') {
    return 'No Storage bucket found. Open Storage in the Firebase console and press Get started.';
  }
  if (code === 'storage/quota-exceeded') return 'Storage quota exceeded.';
  if (code === 'storage/retry-limit-exceeded') return 'The upload timed out. Check your connection.';
  return 'The upload failed. Try again.';
}

/**
 * Upload an image under `users/{uid}/campaigns/{campaignId}/{folder}/` and
 * return its download URL. Download URLs carry their own token, so <img> can
 * show them without the rules having to allow public reads.
 */
export function useImageUpload(campaignId: string | null | undefined) {
  const app = useFirebaseApp();
  const { user } = useUser();
  const storage = React.useMemo(() => getStorage(app), [app]);

  const upload = React.useCallback(
    async (file: File, folder: string, name: string): Promise<string> => {
      if (!user || !campaignId) throw new UploadError('Sign in and choose a campaign first.');
      try {
        const blob = await prepareImage(file);
        const ext = blob.type === 'image/webp' ? 'webp' : (blob.type.split('/')[1] ?? 'img');
        // Timestamped, so replacing an image gets a new URL and no cache serves the old one.
        const path = `users/${user.uid}/campaigns/${campaignId}/${folder}/${name}-${Date.now()}.${ext}`;
        const snap = await uploadBytes(ref(storage, path), blob, { contentType: blob.type });
        return await getDownloadURL(snap.ref);
      } catch (e) {
        throw new UploadError(explain(e));
      }
    },
    [user, campaignId, storage],
  );

  /**
   * Best-effort removal of a replaced image. A failure only leaves an orphan
   * file behind, so it is logged, never surfaced.
   */
  const remove = React.useCallback(
    async (url: string | undefined) => {
      if (!url || !url.includes('firebasestorage')) return;
      try {
        await deleteObject(ref(storage, url));
      } catch (e) {
        console.warn('[storage] could not delete replaced image', (e as { code?: string })?.code);
      }
    },
    [storage],
  );

  return { upload, remove };
}
