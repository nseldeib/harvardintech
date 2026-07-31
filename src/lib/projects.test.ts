import { describe, it, expect } from 'vitest';
import { openProjects, projectPath, projectCta } from './projects';

describe('openProjects', () => {
  // Absent `active` means open (see filterActiveBoardMembers) — a project whose
  // editor never touched the toggle must stay visible, not silently vanish.
  it('keeps a project whose active flag is absent', () => {
    expect(openProjects([{ title: 'Newsletter editor' }]).map((p) => p.title)).toEqual([
      'Newsletter editor',
    ]);
  });

  // An explicit active: true is kept, same as the absent case.
  it('keeps a project explicitly marked active', () => {
    expect(openProjects([{ title: 'Speaker outreach', active: true }])).toHaveLength(1);
  });

  // active: false is the one value that retires a project from the page.
  it('removes a project explicitly marked inactive', () => {
    expect(openProjects([{ title: 'Retired project', active: false }])).toEqual([]);
  });

  // Open projects come back in the editor-chosen order.
  it('orders open projects by their order field', () => {
    const result = openProjects([
      { title: 'third', order: 3 },
      { title: 'first', order: 1 },
      { title: 'second', order: 2 },
    ]);
    expect(result.map((p) => p.title)).toEqual(['first', 'second', 'third']);
  });

  // An un-numbered project sorts after the numbered ones, never ahead of #1.
  it('places unordered projects after ordered ones', () => {
    const result = openProjects([
      { title: 'unordered' },
      { title: 'ordered', order: 1 },
    ]);
    expect(result.map((p) => p.title)).toEqual(['ordered', 'unordered']);
  });

  // The closed-filter and the ordering compose in one pass.
  it('filters and orders together', () => {
    const result = openProjects([
      { title: 'closed', order: 1, active: false },
      { title: 'open-b', order: 3 },
      { title: 'open-a', order: 2 },
    ]);
    expect(result.map((p) => p.title)).toEqual(['open-a', 'open-b']);
  });

  // All-closed yields [] — the production default that drives /volunteer's
  // empty state, which must be an empty array rather than a crash.
  it('returns an empty array when every project is closed', () => {
    expect(
      openProjects([
        { title: 'a', active: false },
        { title: 'b', active: false },
      ]),
    ).toEqual([]);
  });

  // No projects at all also yields [], the day-one production state.
  it('returns an empty array for no projects', () => {
    expect(openProjects([])).toEqual([]);
  });

  // Selection is non-mutating, so the caller's collection is untouched.
  it('does not mutate the input array', () => {
    const source = [
      { title: 'b', order: 2 },
      { title: 'a', order: 1 },
    ];
    openProjects(source);
    expect(source.map((p) => p.title)).toEqual(['b', 'a']);
  });
});

describe('projectPath', () => {
  // The route file is `src/pages/volunteer/projects/[slug].astro`, so this shape
  // is the contract between it and every card that links to it. If they drift,
  // the card points at a 404 — the failure this helper exists to prevent.
  it('builds the detail path for a slug', () => {
    expect(projectPath('social-media-marketing-specialist-events')).toBe(
      '/volunteer/projects/social-media-marketing-specialist-events',
    );
  });

  // Site-root-relative, NOT base-prefixed: callers wrap it in `withBase`, which
  // would double the prefix if this helper applied it too.
  it('returns a site-root-relative path for the caller to base-prefix', () => {
    expect(projectPath('newsletter-editor').startsWith('/volunteer/projects/')).toBe(true);
  });
});

describe('projectCta', () => {
  // A project with its own sign-up link uses it, and says so plainly.
  it('uses the project own apply link when it has one', () => {
    expect(projectCta('https://apply.example/toronto', 'Volunteer with us', 'https://hi.switchy.io/wEYK')).toEqual({
      href: 'https://apply.example/toronto',
      label: 'Get involved',
    });
  });

  // The fallback that matters: Nicole's project has no applyUrl, so without this
  // her page would end after the description with no way to sign up.
  it('falls back to the page-level volunteer CTA when the project has no apply link', () => {
    expect(projectCta(undefined, 'Volunteer with us', 'https://hi.switchy.io/wEYK')).toEqual({
      href: 'https://hi.switchy.io/wEYK',
      label: 'Volunteer with us',
    });
  });

  // No link anywhere means NO button — a dead CTA is worse than none.
  it('returns null when neither the project nor the page has a link', () => {
    expect(projectCta(undefined, 'Volunteer with us', undefined)).toBeNull();
  });

  // The project link wins even when the page-level CTA is absent.
  it('uses the project apply link even with no page-level fallback configured', () => {
    expect(projectCta('https://apply.example/toronto')).toEqual({
      href: 'https://apply.example/toronto',
      label: 'Get involved',
    });
  });

  // An unset label on the fallback still renders a sensible button rather than
  // an empty one — `volunteerPage.ctaLabel` is editable copy and can be blank.
  it('names the fallback button when the page-level label is missing', () => {
    expect(projectCta(undefined, undefined, 'https://hi.switchy.io/wEYK')).toEqual({
      href: 'https://hi.switchy.io/wEYK',
      label: 'Volunteer with us',
    });
  });

  // Empty strings are absent, not links: an editor who cleared the field must
  // not produce href="" pointing at the current page.
  it('treats an empty apply link as absent', () => {
    expect(projectCta('', 'Volunteer with us', 'https://hi.switchy.io/wEYK')).toEqual({
      href: 'https://hi.switchy.io/wEYK',
      label: 'Volunteer with us',
    });
  });

  // Both cleared → nothing, same as both absent.
  it('returns null when both links are empty strings', () => {
    expect(projectCta('', 'Volunteer with us', '')).toBeNull();
  });
});
