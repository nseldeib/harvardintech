import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pagesBasePathFor, pushTargetRepo } from './deployTracks';

const REPO_ROOT = path.resolve(__dirname, '../..');
const WORKFLOW = fs.readFileSync(
  path.join(REPO_ROOT, '.github/workflows/deploy.yml'),
  'utf-8',
);

/**
 * The `run:` / `env:` body of one job in `deploy.yml`, sliced by the job's
 * top-level key. Deliberately string slicing rather than a YAML parse: the
 * contract being pinned is about literal values a human edits, and pulling the
 * raw text keeps the assertions readable against the file as it is written.
 */
function jobBody(name: string): string {
  const start = WORKFLOW.indexOf(`\n  ${name}:\n`);
  expect(start, `job "${name}" not found in deploy.yml`).toBeGreaterThan(-1);
  const rest = WORKFLOW.slice(start + 1);
  const next = rest.search(/\n {2}\w[\w-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next);
}

/** The value of an `env:` key inside a job body, or undefined when unset. */
function envValue(body: string, key: string): string | undefined {
  const m = body.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));
  return m?.[1].trim().replace(/^['"]|['"]$/g, '');
}

describe('pagesBasePathFor', () => {
  // The rule itself: a project site at <user>.github.io/<repo>/ builds with base /<repo>.
  it('returns the repo name as a rooted path', () => {
    expect(pagesBasePathFor('harvardintech-staging')).toBe('/harvardintech-staging');
  });

  // The other track's repo, so both real values in the workflow are covered.
  it('handles the reviewed track repo too', () => {
    expect(pagesBasePathFor('harvardintech')).toBe('/harvardintech');
  });

  // Someone writing the repo the way it appears in a URL should not get '//repo'.
  it('tolerates surrounding slashes rather than doubling them', () => {
    expect(pagesBasePathFor('/harvardintech-staging/')).toBe('/harvardintech-staging');
  });

  // A config value copied with whitespace still resolves to the same base.
  it('trims surrounding whitespace', () => {
    expect(pagesBasePathFor('  harvardintech  ')).toBe('/harvardintech');
  });

  // The dangerous case: '/' is the base of a USER site or a custom domain, so
  // returning it for an empty repo would build every asset URL wrong while
  // looking entirely plausible. Fail loudly instead.
  it('throws on an empty repo name rather than returning a bare slash', () => {
    expect(() => pagesBasePathFor('')).toThrow(/repo name is required/);
    expect(() => pagesBasePathFor('   ')).toThrow(/repo name is required/);
  });
});

describe('pushTargetRepo', () => {
  // The exact form the staging job uses.
  it('reads the repo out of an SSH push command', () => {
    expect(pushTargetRepo('git push -q -f git@github.com:nseldeib/harvardintech-staging.git gh-pages')).toBe(
      'harvardintech-staging',
    );
  });

  // The same URL without the .git suffix must resolve identically.
  it('reads the repo when the .git suffix is absent', () => {
    expect(pushTargetRepo('git push git@github.com:nseldeib/harvardintech-staging gh-pages')).toBe(
      'harvardintech-staging',
    );
  });

  // HTTPS remotes are the other form someone might switch to.
  it('reads the repo out of an HTTPS remote', () => {
    expect(pushTargetRepo('git push https://github.com/nseldeib/harvardintech.git main')).toBe(
      'harvardintech',
    );
  });

  // A hyphenated owner must not be mistaken for the repo.
  it('returns the repo, not the owner', () => {
    expect(pushTargetRepo('git@github.com:some-org/some-repo.git')).toBe('some-repo');
  });

  // "This step pushes nowhere" is a real state — the reviewed track publishes
  // via an artifact upload and has no remote — so it is reported, not thrown on.
  it('returns undefined when the command contains no remote', () => {
    expect(pushTargetRepo('touch dist/.nojekyll')).toBeUndefined();
    expect(pushTargetRepo('')).toBeUndefined();
  });
});

describe('deploy.yml track coherence', () => {
  // The headline contract, and the bug class this file exists for: the staging
  // job's base path must name the same repo it publishes to. They sit far apart
  // in the workflow with nothing connecting them, and a mismatch deploys a site
  // that returns 200 while every asset and link 404s.
  it('builds the staging track with a base matching the repo it publishes to', () => {
    const body = jobBody('review');
    const target = pushTargetRepo(body);

    expect(target).toBeDefined();
    expect(envValue(body, 'DEPLOY_BASE_PATH')).toBe(pagesBasePathFor(target!));
  });

  // The reviewed track is served from a subpath of this repo's own Pages site,
  // so the same rule applies even though it publishes by artifact upload.
  it('builds the reviewed track with a base matching this repo', () => {
    expect(envValue(jobBody('build'), 'DEPLOY_BASE_PATH')).toBe(
      pagesBasePathFor('harvardintech'),
    );
  });

  // The staging site has no custom domain. A CNAME file would bind a domain
  // whose DNS does not point at it, and Pages then serves a
  // misconfigured-domain error instead of the site. Restoring this write is a
  // deliberate step of the future migration, not something to leave lying around.
  it('writes no CNAME on the staging track', () => {
    expect(jobBody('review')).not.toMatch(/>\s*dist\/CNAME/);
  });

  // Dropping PREVIEW_GATE is precisely what takes a site public, and
  // harvardintech.com is still Strikingly's — so until the cutover BOTH tracks
  // must set it. This is the one assertion here guarding exposure rather than
  // correctness, which is why it covers both jobs rather than just the new one.
  it('gates both tracks while neither is meant to be public', () => {
    expect(envValue(jobBody('build'), 'PREVIEW_GATE')).toBe('1');
    expect(envValue(jobBody('review'), 'PREVIEW_GATE')).toBe('1');
  });
});
