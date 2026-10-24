/**
 * Generated art: the kinds of image the app asks Gemini for, and the shape of
 * each. Shared by the client (dialog, previews) and the server (prompt), so
 * nothing here may import server code.
 */

export const ART_KINDS = ['cover', 'teaser', 'panel', 'scene', 'portrait', 'place', 'faction'] as const;
export type ArtKind = (typeof ART_KINDS)[number];

/** Matches the slot each kind fills. The slots crop to fill, so near enough is fine. */
export const ART_ASPECT: Record<ArtKind, '2:3' | '3:4' | '4:5' | '21:9'> = {
  cover: '2:3',
  teaser: '2:3',
  panel: '3:4',
  scene: '21:9',
  portrait: '4:5',
  place: '4:5',
  faction: '4:5',
};

/** Literal class names, so Tailwind's scanner sees every one. */
export const ART_ASPECT_CLASS: Record<ArtKind, string> = {
  cover: 'aspect-[2/3]',
  teaser: 'aspect-[2/3]',
  panel: 'aspect-[3/4]',
  scene: 'aspect-[21/9]',
  portrait: 'aspect-[4/5]',
  place: 'aspect-[4/5]',
  faction: 'aspect-[4/5]',
};

export const ART_LABEL: Record<ArtKind, string> = {
  cover: 'Issue cover',
  teaser: 'Next-issue cover',
  panel: 'Panel',
  scene: 'Scene art',
  portrait: 'Portrait',
  place: 'Place art',
  faction: 'Faction art',
};

/** Nano Banana keeps up to four characters consistent from reference images. */
export const MAX_CAST = 4;
/** Approved images the model copies the look of. Two is plenty and keeps requests small. */
export const MAX_STYLE_REFS = 2;

/** Used until the DM writes their own in Art direction. */
export const DEFAULT_ART_STYLE =
  'Modern fantasy comic art: bold ink linework, dramatic lighting, rich but limited colours, '
  + 'light halftone texture in the shadows. Painted-and-inked look, grounded and gritty rather than glossy.';

/**
 * The characters and NPCs among a set of mention refs, party first: the
 * people a generated image for that issue or page could show.
 */
export function castIdsOf(refs: readonly { kind: string; id: string }[] | undefined): string[] {
  const list = refs ?? [];
  return [
    ...list.filter(r => r.kind === 'party').map(r => r.id),
    ...list.filter(r => r.kind === 'npc').map(r => r.id),
  ];
}
