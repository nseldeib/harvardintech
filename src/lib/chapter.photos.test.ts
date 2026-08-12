import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Regression guard for a curated chapter gallery, modelled on
// `team.photos.test.ts` and guarding the same class of bug one layer over: a
// chapter's `photos` list names files by path, and a path that does not resolve
// renders a BROKEN TILE rather than falling back to anything. The gallery has no
// per-photo fallback — `toGalleryPhotos` drops a row whose `image` is blank, but
// a non-blank path pointing at nothing sails through and reaches the browser as
// a dead <img>. So the only place this can be caught is on disk, here.
//
// These read the chapter markdown straight off disk rather than through
// astro:content, which is awkward to load under vitest — the same tradeoff
// team.photos.test.ts makes, and the reason both use a line-based frontmatter
// read instead of adding a YAML dependency.
//
// Deliberately NOT asserted: that any chapter declares photos at all. A chapter
// with no `photos` is a supported state — it falls back to the shared 40-photo
// event wall, which is what five of the six chapters do today — and Nicole can
// clear a chapter's photos from /admin as an ordinary editorial act. Pinning a
// count here would turn that into a CI failure.
const CHAPTERS_DIR = join(process.cwd(), 'src/content/chapters');
const PUBLIC_DIR = join(process.cwd(), 'public');

/**
 * Pull the `image:` values out of a chapter's `photos:` frontmatter block.
 *
 * `photos` is the only nested structure in these files, so the read is scoped
 * to it: start at the `photos:` key, take the indented `- image:` rows, and
 * stop at the first line that returns to column zero (the next frontmatter key
 * or the closing `---`).
 */
function readPhotoPaths(markdown: string): string[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => /^photos:\s*$/.test(line));
  if (start === -1) return [];

  const paths: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const match = line.match(/^\s+-\s+image:\s*(.*?)\s*$/);
    if (match) paths.push(match[1]);
  }
  return paths;
}

const chapterFiles = readdirSync(CHAPTERS_DIR).filter((f) => f.endsWith('.md'));

describe('curated chapter galleries', () => {
  // sanity: the chapter content exists, so an empty glob cannot make every
  // per-file assertion below pass vacuously
  it('finds the chapter content files', () => {
    expect(chapterFiles.length).toBeGreaterThan(0);
  });

  describe.each(chapterFiles)('%s', (file) => {
    const photos = readPhotoPaths(readFileSync(join(CHAPTERS_DIR, file), 'utf8'));

    // a row whose image is blank is dropped by `toGalleryPhotos`, so it renders
    // nothing rather than a broken tile — but it is still an editor's
    // half-finished row committed to the repo, which is worth failing on
    it('declares no blank photo rows', () => {
      const blanks = photos.filter((p) => p.length === 0);
      expect(blanks, `${file} has ${blanks.length} \`- image:\` row(s) with no path`).toEqual([]);
    });

    // every path must be root-absolute: `withBase` prefixes the deploy's base
    // path onto it, and a relative path silently resolves against the current
    // route instead — /chapters/nyc/images/... rather than /images/...
    it('declares only root-absolute photo paths', () => {
      const relative = photos.filter((p) => p.length > 0 && !p.startsWith('/'));
      expect(relative, `${file} declares non-absolute photo path(s)`).toEqual([]);
    });

    // the referenced image must actually exist under public/, catching a typo'd
    // or deleted photo before it renders as a dead tile in production
    it('points only at images that exist under public/', () => {
      const missing = photos
        .filter((p) => p.length > 0)
        .filter((p) => !existsSync(join(PUBLIC_DIR, p.replace(/^\//, ''))));
      expect(missing, `${file} references image(s) with no file under public/`).toEqual([]);
    });
  });
});
