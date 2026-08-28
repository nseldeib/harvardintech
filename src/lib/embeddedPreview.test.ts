// What these tests protect: the site's third-party tags must fire for readers
// and must NOT fire inside the CMS entry editor's live preview pane.
//
// Both halves matter and they fail in opposite, equally silent ways. Miss the
// embed and the team's own editing is counted as traffic — data that is wrong
// forever, because there is no way to tell those page_views apart afterwards.
// Over-match and analytics quietly stops recording real visitors, which looks
// exactly like a quiet week. Neither breaks a page, so nothing would surface
// either one except a test.
//
// The pane arrived with @codeyam/cms 0.14.0, which embeds an entry's real page
// beside the editing form — so the page loads once per entry an editor opens
// rather than once per reader.
import { describe, expect, it, beforeEach } from 'vitest';
import { EMBED_FLAG, isEmbeddedPreview, loadScriptUnlessEmbedded } from './embeddedPreview';

const GTAG = 'https://www.googletagmanager.com/gtag/js?id=G-TESTID';

describe('isEmbeddedPreview', () => {
  // The overwhelmingly common case — a reader who typed the address or followed
  // a plain link. If this ever returned true the site would stop counting
  // essentially all of its traffic, and it would look like a quiet week.
  it('is false for a reader arriving with no query string at all', () => {
    expect(isEmbeddedPreview('')).toBe(false);
  });

  // The email campaign's `?name=` link is the real traffic most at risk of a
  // sloppy match — it is the one query string ordinary visitors actually carry,
  // and it is exactly the audience a fundraising campaign most needs counted.
  it('is false for a reader carrying unrelated query parameters', () => {
    expect(isEmbeddedPreview('?name=Nicole')).toBe(false);
    expect(isEmbeddedPreview('?utm_source=newsletter&utm_medium=email')).toBe(false);
  });

  // The literal string @codeyam/cms 0.14.0 puts on the iframe it embeds beside
  // the editing form. This is the case the whole module exists for; if only one
  // test here survived, it should be this one.
  it('is true for the flag the CMS actually writes', () => {
    expect(isEmbeddedPreview('?cms-preview=1&cms-embed=1')).toBe(true);
  });

  // `location.search` carries the leading `?` and a hand-built string usually
  // does not. Accepting both means a caller cannot silently disable the
  // suppression by trimming a character.
  it('accepts the flag with or without a leading question mark', () => {
    expect(isEmbeddedPreview('?cms-embed=1')).toBe(true);
    expect(isEmbeddedPreview('cms-embed=1')).toBe(true);
  });

  // The CMS writes `=1` today, but the flag's meaning is its presence. A future
  // `cms-embed` or `cms-embed=true` must suppress just the same, because the
  // costs are asymmetric: a missed embed corrupts analytics permanently, a false
  // positive loses a single visit from someone who hand-typed the parameter.
  it('keys on the flag being PRESENT, not on its value', () => {
    expect(isEmbeddedPreview('?cms-embed')).toBe(true);
    expect(isEmbeddedPreview('?cms-embed=true')).toBe(true);
    expect(isEmbeddedPreview('?cms-embed=0')).toBe(true);
  });

  // Guards the difference between parsing the query string and searching it as
  // text. The naive `search.includes('cms-embed')` passes every other test in
  // this file and fails only here — so this is the test that keeps the
  // implementation honest about being a parser.
  it('does not match a parameter that merely contains the flag name', () => {
    expect(isEmbeddedPreview('?not-cms-embed=1')).toBe(false);
    expect(isEmbeddedPreview('?ref=cms-embedded-docs')).toBe(false);
  });

  // Pins the contract with @codeyam/cms's own PREVIEW_EMBED_FLAG. The flag is
  // duplicated as a literal here rather than imported (the site's public pages
  // must not import from the admin package), so if an upgrade renames it this
  // assertion is the thing that says so instead of analytics quietly refilling
  // with editor traffic.
  it('names the flag the CMS uses', () => {
    expect(EMBED_FLAG).toBe('cms-embed');
  });
});

describe('loadScriptUnlessEmbedded', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  // The path every real visitor takes. `async` is asserted because it is what
  // keeps a third-party tag off the render path — it was an attribute on the
  // hand-written `<script is:inline async>` before this logic moved into a
  // function, and dropping it in the move would slow every page with nothing
  // failing.
  it('appends an async script for a reader, and reports that it did', () => {
    expect(loadScriptUnlessEmbedded(document, '', GTAG)).toBe(true);

    const tags = document.head.querySelectorAll('script');
    expect(tags).toHaveLength(1);
    expect(tags[0].src).toBe(GTAG);
    expect(tags[0].async).toBe(true);
  });

  // The reason this module exists: an editor opening an entry must not be
  // recorded as a visit. Asserting the empty head as well as the return value,
  // because a tag appended and then ignored still fires its request.
  it('appends nothing inside the editor preview pane, and reports that it did not', () => {
    expect(loadScriptUnlessEmbedded(document, '?cms-embed=1', GTAG)).toBe(false);
    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });

  // The shipping default for a site that has chosen no analytics and no giving
  // platform: zero third-party requests, not an empty tag pointing at a CDN.
  // Mirrors givebutterScriptSrc returning undefined for a blank account id.
  it('appends nothing when no source is configured', () => {
    expect(loadScriptUnlessEmbedded(document, '', undefined)).toBe(false);
    expect(loadScriptUnlessEmbedded(document, '', '')).toBe(false);
    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });

  // Analytics.astro gates Google's dataLayer/gtag bootstrap on this return
  // value, so the boolean is load-bearing rather than informational: a
  // suppressed load must not leave a half-initialised global queueing events
  // against a script that is never coming.
  it('leaves the caller free to skip its own follow-on work', () => {
    const ranBootstrap = loadScriptUnlessEmbedded(document, '?cms-embed=1', GTAG);
    expect(ranBootstrap).toBe(false);
  });
});
