import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// site.ts loads the editable singletons — `settings`/`nav` plus the
// `volunteerPage`/`donatePage` copy blobs — from the resolved data root via
// `readSingleton` (fs read + JSON.parse) at module load, the logic the sandbox
// content-redirect work introduced (replacing the old static JSON imports).
// These tests point CODEYAM_DATA_ROOT at a temp dir with fixtures and import the
// module fresh, proving it reads + parses from the data root rather than a
// hardcoded path.

/** Minimal valid fixtures for every singleton site.ts reads at module load.
 *  Adding a singleton to site.ts means adding it here, or every test in this
 *  file fails at import with ENOENT. */
function writeAllSingletons(
  dir: string,
  overrides: { settings?: object; nav?: object } = {},
): void {
  const settings = overrides.settings ?? {
    siteTitle: 'Test Site',
    description: 'A fixture site',
    contactEmail: 'hello@example.com',
    footerText: 'Footer',
    socials: [{ label: 'Twitter', url: 'https://twitter.com/example', icon: 'twitter' }],
  };
  const nav = overrides.nav ?? {
    items: [
      { label: 'Home', url: '/' },
      { label: 'Events', url: '/events' },
    ],
  };
  writeFileSync(join(dir, 'settings.json'), JSON.stringify(settings));
  writeFileSync(join(dir, 'nav.json'), JSON.stringify(nav));
  writeFileSync(
    join(dir, 'volunteerPage.json'),
    JSON.stringify({
      headline: 'Join the volunteer team',
      intro: 'We are volunteer-run.',
      benefits: [{ title: 'Experience', body: 'Work on real projects.' }],
    }),
  );
  writeFileSync(
    join(dir, 'donatePage.json'),
    JSON.stringify({
      campaignName: 'The Momentum Fund',
      heroHeadlineNamed: "{name}, let's go further together",
      heroHeadlineGeneric: "Let's go further together",
      accomplishments: [{ value: '600+', label: 'WhatsApp community members' }],
    }),
  );
  writeFileSync(
    join(dir, 'sponsorPage.json'),
    JSON.stringify({
      headline: 'Reach the Harvard alumni building in tech.',
      levels: [{ id: 'event', name: 'Event Partner' }],
      disclaimer: 'Contributions support Harvard Alumni in Tech, not Harvard University.',
    }),
  );
}

describe('site singletons', () => {
  const prev = process.env.CODEYAM_DATA_ROOT;
  let tmp: string | null = null;

  afterEach(() => {
    vi.resetModules();
    if (prev === undefined) delete process.env.CODEYAM_DATA_ROOT;
    else process.env.CODEYAM_DATA_ROOT = prev;
    if (tmp) {
      rmSync(tmp, { recursive: true, force: true });
      tmp = null;
    }
  });

  // settings + nav are read from the data root and parsed from JSON, so a
  // sandbox data dir fully drives what the site renders
  it('loads settings and nav from the data root as parsed JSON', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'site-test-'));
    writeAllSingletons(tmp);

    process.env.CODEYAM_DATA_ROOT = tmp;
    vi.resetModules();
    const mod = await import('./site');

    expect(mod.settings.siteTitle).toBe('Test Site');
    expect(mod.settings.contactEmail).toBe('hello@example.com');
    expect(mod.settings.socials).toHaveLength(1);
    expect(mod.settings.socials[0].url).toBe('https://twitter.com/example');
    expect(mod.nav.items.map((i) => i.label)).toEqual(['Home', 'Events']);
  });

  // The page-copy singletons come from the same data root, so a scenario (or the
  // CMS) can drive the /volunteer and /donate prose without touching markup.
  it('loads the volunteer and donate page copy from the data root', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'site-test-'));
    writeAllSingletons(tmp);

    process.env.CODEYAM_DATA_ROOT = tmp;
    vi.resetModules();
    const mod = await import('./site');

    expect(mod.volunteerPage.headline).toBe('Join the volunteer team');
    expect(mod.volunteerPage.benefits).toHaveLength(1);
    expect(mod.donatePage.campaignName).toBe('The Momentum Fund');
    // The `{name}` slot must survive the round-trip — it is what the browser
    // fills from `?name=` (see personalize.ts).
    expect(mod.donatePage.heroHeadlineNamed).toContain('{name}');
    // The campaign's track record is copy, not markup, so it rides the same
    // singleton — the donate page renders whatever the data root supplies.
    expect(mod.donatePage.accomplishments).toHaveLength(1);
    expect(mod.donatePage.accomplishments?.[0].label).toBe('WhatsApp community members');
  });

  // /sponsor is driven the same way, and its partnership levels are the part
  // that matters: a sponsor's `tier` matches a level `id`, so the levels must
  // survive the round-trip intact or the wall cannot group anyone. The
  // disclaimer rides here too, because the Harvard Alumni Association requires
  // the page to state that contributions are not gifts to the University —
  // copy the team can revise without a deploy.
  it('loads the sponsor page copy, its levels, and the disclaimer', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'site-test-'));
    writeAllSingletons(tmp);

    process.env.CODEYAM_DATA_ROOT = tmp;
    vi.resetModules();
    const mod = await import('./site');

    expect(mod.sponsorPage.headline).toBe('Reach the Harvard alumni building in tech.');
    expect(mod.sponsorPage.levels?.map((l) => l.id)).toEqual(['event']);
    expect(mod.sponsorPage.disclaimer).toContain('not Harvard University');
  });

  // a different data root yields different values — the loader is not pinned to
  // a single committed file (the sandbox isolation guarantee at the read side)
  it('reflects a second data root on re-import', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'site-test-'));
    writeAllSingletons(tmp, {
      settings: { siteTitle: 'Second', description: '', contactEmail: 'x@y.z', footerText: '', socials: [] },
      nav: { items: [] },
    });

    process.env.CODEYAM_DATA_ROOT = tmp;
    vi.resetModules();
    const mod = await import('./site');

    expect(mod.settings.siteTitle).toBe('Second');
    expect(mod.nav.items).toHaveLength(0);
  });
});
