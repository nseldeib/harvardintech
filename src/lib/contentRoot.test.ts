import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { contentRoot, dataRoot, readSingleton } from './contentRoot';

// contentRoot()/dataRoot() are the redirection seam the codeyam sandbox relies
// on: normally they resolve to the committed `src/content`/`src/data`, but when
// the editor sets CODEYAM_CONTENT_ROOT/CODEYAM_DATA_ROOT (a session sandbox)
// they point there instead — so seeding never touches production. These tests
// pin that env-override precedence, the whole reason the module exists.

describe('contentRoot', () => {
  const prev = process.env.CODEYAM_CONTENT_ROOT;
  afterEach(() => {
    if (prev === undefined) delete process.env.CODEYAM_CONTENT_ROOT;
    else process.env.CODEYAM_CONTENT_ROOT = prev;
  });

  // when the editor points the app at a sandbox, the override wins
  it('returns CODEYAM_CONTENT_ROOT when it is set', () => {
    process.env.CODEYAM_CONTENT_ROOT = '/tmp/sandbox/content';
    expect(contentRoot()).toBe('/tmp/sandbox/content');
  });

  // a production build (no override) reads the committed source dir
  it('defaults to src/content when the override is unset', () => {
    delete process.env.CODEYAM_CONTENT_ROOT;
    expect(contentRoot()).toBe('src/content');
  });
});

describe('dataRoot', () => {
  const prev = process.env.CODEYAM_DATA_ROOT;
  afterEach(() => {
    if (prev === undefined) delete process.env.CODEYAM_DATA_ROOT;
    else process.env.CODEYAM_DATA_ROOT = prev;
  });

  // the singleton data dir follows the same sandbox redirect as content
  it('returns CODEYAM_DATA_ROOT when it is set', () => {
    process.env.CODEYAM_DATA_ROOT = '/tmp/sandbox/data';
    expect(dataRoot()).toBe('/tmp/sandbox/data');
  });

  // a production build (no override) reads the committed data dir
  it('defaults to src/data when the override is unset', () => {
    delete process.env.CODEYAM_DATA_ROOT;
    expect(dataRoot()).toBe('src/data');
  });
});

describe('readSingleton', () => {
  const prev = process.env.CODEYAM_DATA_ROOT;
  const dirs: string[] = [];

  afterEach(() => {
    if (prev === undefined) delete process.env.CODEYAM_DATA_ROOT;
    else process.env.CODEYAM_DATA_ROOT = prev;
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });

  /** A throwaway data dir the sandbox override points at. */
  function sandbox(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'singleton-'));
    dirs.push(dir);
    for (const [name, body] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), body);
    }
    process.env.CODEYAM_DATA_ROOT = dir;
    return dir;
  }

  // The ordinary case: a singleton parses into the shape its caller expects.
  it('parses a singleton from the resolved data root', () => {
    sandbox({ 'thing.json': '{"siteTitle":"Harvard in Tech","socials":[]}' });
    expect(readSingleton<{ siteTitle: string }>('thing.json').siteTitle).toBe('Harvard in Tech');
  });

  // The reason this function exists at all, and the reason it must not be a
  // bare readFileSync('src/data/…'): every read has to follow the sandbox
  // redirect, or a seeded scenario silently renders committed production
  // content instead of its own.
  it('follows the sandbox redirect rather than reading src/data', () => {
    sandbox({ 'nav.json': '{"items":[{"label":"Seeded"}]}' });
    const nav = readSingleton<{ items: { label: string }[] }>('nav.json');
    expect(nav.items[0].label).toBe('Seeded');
  });

  // Two callers de-duplicated onto this function; both read more than one
  // singleton, so resolving the name per call rather than caching a path is
  // part of the contract.
  it('resolves each name independently within one data root', () => {
    sandbox({ 'a.json': '{"which":"a"}', 'b.json': '{"which":"b"}' });
    expect(readSingleton<{ which: string }>('a.json').which).toBe('a');
    expect(readSingleton<{ which: string }>('b.json').which).toBe('b');
  });

  // A missing singleton throws rather than yielding an empty object. Silently
  // returning a blank would render the site's settings, nav, or the cutover
  // checklist as empty and look like real content.
  it('throws when the singleton is absent', () => {
    sandbox({});
    expect(() => readSingleton('missing.json')).toThrow();
  });

  // Malformed JSON throws for the same reason — a half-written data file
  // should fail the build, not render as nothing.
  it('throws when the singleton is not valid JSON', () => {
    sandbox({ 'broken.json': '{ not json' });
    expect(() => readSingleton('broken.json')).toThrow();
  });
});
