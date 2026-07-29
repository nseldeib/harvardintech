// The media library manifest, as the *site* reads it.
//
// `src/data/media.json` is the CMS's library singleton: the package writes it
// from /admin (see `@codeyam/cms/src/lib/mediaLibrary.ts`, `MEDIA_MANIFEST_PATH`)
// and it records what is KNOWN about each image under `public/images` — above
// all its alt text. Without this module that knowledge stops at the CMS: alt an
// editor writes in the media library never reaches a rendered page.
//
// Read through `fs` from `dataRoot()`, exactly as `site.ts` reads `settings` and
// `nav`, so a codeyam session's sandbox redirect reaches it and the seed adapter
// can seed a `media` key per scenario. Server-only (imported from `.astro`
// frontmatter), and otherwise pure so `altFor` unit-tests directly.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { dataRoot } from './contentRoot';

/** One image in the library. Mirrors the package's `MediaAsset`. */
export interface MediaAsset {
  /** Path within `public/images` — the asset identity. May contain `/`. */
  filename: string;
  /** Site-relative URL the asset is referenced by, e.g. `/images/foo.jpg`. */
  url: string;
  /** Authored alt text. An explicit `''` means "decorative", not "unset". */
  alt?: string;
  sizeBytes?: number;
  originalSizeBytes?: number;
  width?: number;
  height?: number;
  uploadedAt?: string;
}

/** The library manifest singleton (`src/data/media.json`). */
export interface MediaManifest {
  assets: MediaAsset[];
}

/**
 * The committed manifest, or an empty library when there is none.
 *
 * Tolerating an absent or malformed file is deliberate: production before the
 * first upload, and any scenario that seeds no media, must render rather than
 * fail the build — the same tolerance `readCommittedManifest` has in the package.
 */
export function readMediaManifest(): MediaManifest {
  try {
    const raw = fs.readFileSync(path.resolve(dataRoot(), 'media.json'), 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    const assets = (parsed as MediaManifest)?.assets;
    return { assets: Array.isArray(assets) ? assets : [] };
  } catch {
    return { assets: [] };
  }
}

/**
 * The alt text to render for a site-relative image URL.
 *
 * `fallback` is the render site's CURRENT value, so adopting this helper can
 * never make an image's alt worse than it is today: an image with no record, or
 * a record nobody has written alt for yet, keeps exactly what the component
 * already emitted.
 *
 * An explicit `''` in the manifest is a real answer — "this image is
 * decorative" — and wins over the fallback rather than being treated as
 * missing. That distinction is the whole point of recording decorative images
 * instead of leaving them out, so it must not collapse into a truthiness check.
 */
export function altFor(
  url: string,
  fallback: string,
  manifest: MediaManifest = readMediaManifest(),
): string {
  const record = manifest.assets.find((asset) => asset.url === url);
  return record?.alt ?? fallback;
}
