import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { altFor, type MediaManifest } from './media';

// Two guards in one file.
//
// `altFor` is the seam that carries alt text from the media library to the
// rendered page — before it, alt an editor wrote in /admin stopped at the CMS.
// Its contract has one subtlety worth pinning: an explicit `''` in the manifest
// is a real answer ("this image is decorative"), NOT a missing value, so it must
// win over the caller's fallback rather than collapsing under a truthiness check.
//
// The manifest is then checked against the tree in both directions, following
// `team.photos.test.ts`: a record whose file is gone is a broken reference, and
// a file with no record is an image nobody has written alt for.

const IMAGES_DIR = join(process.cwd(), 'public/images');
const MANIFEST_PATH = join(process.cwd(), 'src/data/media.json');

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as MediaManifest;

/** Every file under public/images, as posix paths relative to it. */
function walk(dir: string, rel: string[] = []): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const next = [...rel, entry.name];
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), next));
    else if (entry.isFile()) out.push(next.join('/'));
  }
  return out;
}

const filesOnDisk = walk(IMAGES_DIR);

describe('altFor', () => {
  const fixture: MediaManifest = {
    assets: [
      {
        filename: 'gallery/event-07.jpg',
        url: '/images/gallery/event-07.jpg',
        alt: 'Panelists on stage',
      },
      { filename: 'bg/hero-bg.jpg', url: '/images/bg/hero-bg.jpg', alt: '' },
      { filename: 'team/new.png', url: '/images/team/new.png' },
    ],
  };

  // The core of the feature: alt authored in the media library must reach the
  // render site, replacing the positional string the gallery invents.
  it('returns the authored alt for a known image', () => {
    expect(altFor('/images/gallery/event-07.jpg', 'Harvard Alumni in Tech event photo 7', fixture)).toBe(
      'Panelists on stage',
    );
  });

  // The distinction the whole feature rests on: an explicit empty alt is a
  // decision ("decorative"), not a gap, so it must beat the fallback. Written
  // with `??` for exactly this reason — `||` would silently discard it and let
  // a backdrop photo be announced by a screen reader.
  it('honors an explicit empty alt as a deliberate decorative marking', () => {
    expect(altFor('/images/bg/hero-bg.jpg', 'Harvard campus building', fixture)).toBe('');
  });

  // A freshly uploaded image nobody has described yet must degrade to the
  // render site's current behavior, never emit `alt="undefined"`.
  it('falls back for a record that has no alt key yet', () => {
    expect(altFor('/images/team/new.png', 'Jane Doe', fixture)).toBe('Jane Doe');
  });

  // An image the manifest has never heard of keeps whatever the component
  // already emitted, so adopting altFor can never make alt worse than today.
  it('falls back when there is no record at all', () => {
    expect(altFor('/images/gallery/event-99.jpg', 'Harvard Alumni in Tech event photo 99', fixture)).toBe(
      'Harvard Alumni in Tech event photo 99',
    );
  });

  // Production before the first upload, and any scenario that seeds no media,
  // hit the empty manifest — it must resolve to the fallback, not throw.
  it('falls back on an empty manifest', () => {
    expect(altFor('/images/gallery/event-07.jpg', 'fallback', { assets: [] })).toBe('fallback');
  });
});

describe('the committed media manifest', () => {
  // Sanity guard: a manifest that failed to parse would make the two
  // per-asset loops below iterate over nothing and pass vacuously.
  it('describes a non-empty library', () => {
    expect(manifest.assets.length).toBeGreaterThan(0);
  });

  // The matching sanity guard for the other direction — an empty or
  // unreadable images tree must not let the disk-side loop pass vacuously.
  it('finds the committed images on disk', () => {
    expect(filesOnDisk.length).toBeGreaterThan(0);
  });

  // The broken-reference direction: a record whose image was deleted or renamed
  // would render as a broken thumbnail the editor cannot fix. Looped inside one
  // test rather than `it.each` so the registry carries one described entry
  // instead of one undescribed entry per image — the assertion message still
  // names the offending file, so a failure is just as diagnosable.
  it('points every record at a file that exists', () => {
    for (const asset of manifest.assets) {
      expect(
        existsSync(join(IMAGES_DIR, asset.filename)),
        `media.json records ${asset.filename} but public/images/${asset.filename} does not exist`,
      ).toBe(true);
    }
  });

  // The nobody-wrote-alt direction, and the check that keeps the manifest
  // current as images are added: committing an image without describing it
  // fails CI rather than silently shipping an undescribed photo.
  it('has a record for every image on disk', () => {
    for (const filename of filesOnDisk) {
      expect(
        manifest.assets.some((a) => a.filename === filename),
        `public/images/${filename} has no record in media.json — nobody has written alt for it`,
      ).toBe(true);
    }
  });

  // `url` is derived from the identity, and the package looks assets up BY url
  // (findAssetByUrl), so a hand-edited mismatch would silently orphan a record.
  it('derives each url from its filename', () => {
    for (const asset of manifest.assets) {
      expect(asset.url, `${asset.filename} has a url that does not match its identity`).toBe(
        `/images/${asset.filename}`,
      );
    }
  });

  // Absent alt means "nobody decided yet"; an empty string means "decided:
  // decorative". Every committed asset must have been decided one way or the
  // other, which is what makes the empty strings above meaningful rather than
  // indistinguishable from an oversight.
  it('records an alt value for every asset, empty or otherwise', () => {
    for (const asset of manifest.assets) {
      expect(typeof asset.alt, `${asset.filename} has no alt recorded`).toBe('string');
    }
  });
});
