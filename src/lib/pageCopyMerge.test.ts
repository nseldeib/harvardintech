import { describe, expect, it } from 'vitest';
import {
  mergeDonateFrame,
  mergeIntegrations,
  mergeSponsorCopy,
  mergeVolunteerCopy,
  preferText,
  sponsorLevelsFrom,
  toSponsorLevels,
} from './pageCopyMerge';
import type { DonatePageCopy, SponsorPageCopy, VolunteerPageCopy } from './site';

// The committed JSON these merges fall back to. Trimmed to the fields each test
// touches — the merges spread the fallback, so an untouched key passing through
// is itself asserted below rather than needing a full fixture.
const VOLUNTEER: VolunteerPageCopy = {
  kicker: 'Get involved',
  heroImage: '/images/bg/get-involved-bg.jpg',
  headline: 'Join the Harvard Alumni in Tech Volunteer Team',
  intro: 'Harvard in Tech is 100% volunteer-run.',
  benefitsTitle: 'Why Volunteer with Harvard Alumni in Tech?',
  benefits: [{ title: 'Gain Valuable Experience', body: 'Work on impactful projects.' }],
  projectsEmptyMessage: "We're lining up the next round of volunteer projects.",
  ctaLabel: 'Volunteer with us',
  ctaUrl: 'https://hi.switchy.io/wEYK',
};

const SPONSOR: SponsorPageCopy = {
  headline: 'Reach the Harvard alumni building in tech.',
  intro: 'A volunteer-led community of founders, operators, and technologists.',
  levels: [{ id: 'event', name: 'Event Partner' }],
  inquiryFormUrl: '',
  disclaimer: 'Contributions are not gifts to Harvard University.',
};

const DONATE = {
  campaignName: 'The Momentum Fund',
  heroHeadlineNamed: "{name}, let's go further together",
  heroHeadlineGeneric: "Let's go further together",
  heroSubhead: 'Help sustain the community.',
  ctaTitle: 'Help power what comes next.',
  ctaLabel: 'Make a Gift',
} as DonatePageCopy;

describe('preferText', () => {
  // The base case: an editor who typed something sees what they typed.
  it('takes the editor value when it holds something', () => {
    expect(preferText('edited', 'committed')).toBe('edited');
  });

  // The entry omits the key entirely — the shape a scenario seed writes, and the
  // shape an older entry has before a new field is added to the schema.
  it('falls back when the editor value is absent', () => {
    expect(preferText(undefined, 'committed')).toBe('committed');
  });

  // An editor cleared the box cleanly. Blank copy must never reach the page.
  it('falls back on an empty string', () => {
    expect(preferText('', 'committed')).toBe('committed');
  });

  // The realistic way a field ends up "cleared": the editor selects the text and
  // deletes it, and the textarea keeps the trailing newline. Treated as real
  // copy this puts a blank heading on the live page.
  it('falls back on whitespace only', () => {
    expect(preferText('   \n  ', 'committed')).toBe('committed');
  });

  // Nothing anywhere is a legitimate outcome for an optional field — the caller
  // renders nothing rather than being handed an empty string to print.
  it('is undefined when neither side has a value', () => {
    expect(preferText(undefined, undefined)).toBeUndefined();
  });

  // Stray leading/trailing whitespace is an artefact of typing into a textarea,
  // never something an editor meant to put on the page, so the value comes back
  // trimmed rather than as typed.
  it('trims the value it returns', () => {
    expect(preferText('  spaced  ', 'committed')).toBe('spaced');
  });
});

describe('mergeVolunteerCopy', () => {
  // The deleted-entry case. The CMS lets an editor remove the only entry of a
  // collection, so this is an ordinary mistake, not a corrupt state.
  it('returns the committed copy untouched when there is no entry', () => {
    expect(mergeVolunteerCopy(VOLUNTEER)).toEqual(VOLUNTEER);
  });

  // The point of the whole migration: what an editor types is what the page shows.
  it('takes each field the editor filled in', () => {
    const merged = mergeVolunteerCopy(VOLUNTEER, {
      headline: 'Help us run Harvard in Tech',
      ctaLabel: 'Join the team',
    });

    expect(merged.headline).toBe('Help us run Harvard in Tech');
    expect(merged.ctaLabel).toBe('Join the team');
  });

  // Editing one field must not blank the rest — the merge is per field, not a
  // wholesale replacement of the copy object.
  it('keeps the committed value for every field the editor left blank', () => {
    const merged = mergeVolunteerCopy(VOLUNTEER, { headline: 'Rewritten' });

    expect(merged.intro).toBe(VOLUNTEER.intro);
    expect(merged.ctaUrl).toBe(VOLUNTEER.ctaUrl);
    expect(merged.projectsEmptyMessage).toBe(VOLUNTEER.projectsEmptyMessage);
  });

  // The headline is the field where a blank is most visible, so it gets its own
  // case rather than relying on the preferText unit tests alone.
  it('keeps the committed headline when the editor cleared it', () => {
    expect(mergeVolunteerCopy(VOLUNTEER, { headline: '  ' }).headline).toBe(VOLUNTEER.headline);
  });

  // All-or-nothing: an editor part-way through rewriting the blocks means the
  // list they are building, and topping it up from the JSON would put copy back
  // on the page that they had removed.
  it('replaces the whole benefits list rather than merging it', () => {
    const merged = mergeVolunteerCopy(VOLUNTEER, {
      benefits: [{ title: 'Expand Your Network', body: 'Meet alumni across six chapters.' }],
    });

    expect(merged.benefits).toEqual([
      { title: 'Expand Your Network', body: 'Meet alumni across six chapters.' },
    ]);
  });

  // An empty list is a real edit — it takes the band off the page — so it must
  // not be mistaken for "the editor has not touched this".
  it('honours an emptied benefits list instead of restoring the committed one', () => {
    expect(mergeVolunteerCopy(VOLUNTEER, { benefits: [] }).benefits).toEqual([]);
  });

  // The counterpart to the two cases above: absent is NOT the same as emptied, so
  // an entry that never mentions benefits still renders the committed blocks.
  it('restores the committed benefits when the entry omits them entirely', () => {
    expect(mergeVolunteerCopy(VOLUNTEER, { headline: 'Rewritten' }).benefits).toEqual(
      VOLUNTEER.benefits,
    );
  });
});

describe('toSponsorLevels', () => {
  // The editor's repeatable list writes rows of fields; there is no plain-string
  // list control. This is the seam between that storage shape and the `string[]`
  // the page renders.
  it('flattens the benefit rows into plain strings', () => {
    expect(
      toSponsorLevels([
        {
          id: 'event',
          data: {
            name: 'Event Partner',
            summary: 'Sponsor a single event.',
            benefits: [{ text: 'Recognition in the listing' }, { text: 'A short welcome' }],
          },
        },
      ]),
    ).toEqual([
      {
        id: 'event',
        name: 'Event Partner',
        summary: 'Sponsor a single event.',
        benefits: ['Recognition in the listing', 'A short welcome'],
      },
    ]);
  });

  // The key a sponsor's `tier` matches on comes from the ENTRY, not from
  // frontmatter — so renaming the display name cannot re-home anyone. This is
  // the assertion that would fail if `id` ever crept back into the schema.
  it('takes the level key from the entry id, never from the name', () => {
    const [level] = toSponsorLevels([
      { id: 'presenting', data: { name: 'Year Partner' } },
    ]);

    expect(level.id).toBe('presenting');
    expect(level.name).toBe('Year Partner');
  });

  // A level can legitimately have no benefit rows yet; the page renders the level
  // without a list rather than an empty bullet list.
  it('leaves benefits undefined for a level that lists none', () => {
    const [level] = toSponsorLevels([{ id: 'community', data: { name: 'Community Partner' } }]);
    expect(level.benefits).toBeUndefined();
  });

  // Reshaping nothing yields nothing. The null-vs-empty decision belongs to
  // sponsorLevelsFrom, not here — this function only maps.
  it('returns an empty list for no entries', () => {
    expect(toSponsorLevels([])).toEqual([]);
  });
});

describe('sponsorLevelsFrom', () => {
  const entry = (id: string, name: string, order?: number) => ({
    id,
    data: { name, ...(order === undefined ? {} : { order }) },
  });

  // The distinction this function exists for. `null` means "nothing has been
  // migrated into this collection yet", which is the only case that should fall
  // back to the committed JSON.
  it('returns null for no entries rather than an empty list', () => {
    expect(sponsorLevelsFrom([])).toBeNull();
  });

  // The wall reads top-down from the biggest commitment, and Order is how an
  // editor arranges that without touching code.
  it('orders levels by the editor order pin', () => {
    const levels = sponsorLevelsFrom([
      entry('event', 'Event Partner', 3),
      entry('presenting', 'Presenting Partner', 1),
      entry('chapter', 'Chapter Partner', 2),
    ]);

    expect(levels?.map((l) => l.id)).toEqual(['presenting', 'chapter', 'event']);
  });

  // The wall reads top-down from the biggest commitment, so an unpinned level
  // sorting last is what keeps a newly added one from jumping to the top.
  it('sorts a level with no order pin after the pinned ones', () => {
    const levels = sponsorLevelsFrom([
      entry('community', 'Community Partner'),
      entry('presenting', 'Presenting Partner', 1),
    ]);

    expect(levels?.map((l) => l.id)).toEqual(['presenting', 'community']);
  });

  // Ordering and reshaping happen in one pass, so this pins that the benefit rows
  // survive the sort rather than being dropped by it.
  it('reshapes the benefit rows while ordering', () => {
    const levels = sponsorLevelsFrom([
      { id: 'event', data: { name: 'Event Partner', benefits: [{ text: 'Recognition' }], order: 1 } },
    ]);

    expect(levels).toEqual([
      { id: 'event', name: 'Event Partner', summary: undefined, benefits: ['Recognition'] },
    ]);
  });

  // The degenerate case: one level sorts to itself rather than tripping the
  // comparator.
  it('returns a single level unchanged in order', () => {
    expect(sponsorLevelsFrom([entry('event', 'Event Partner')])?.map((l) => l.id)).toEqual(['event']);
  });
});

describe('mergeSponsorCopy', () => {
  // Nothing migrated at all — the page must render exactly as it shipped.
  it('returns the committed copy when there is neither an entry nor levels', () => {
    expect(mergeSponsorCopy(SPONSOR)).toEqual(SPONSOR);
  });

  // The migration working: levels come from the collection an editor controls.
  it('takes the levels from content when they exist', () => {
    const levels = [{ id: 'presenting', name: 'Presenting Partner' }];
    expect(mergeSponsorCopy(SPONSOR, undefined, levels).levels).toEqual(levels);
  });

  // `null` means "nothing migrated yet", which is the only case that should
  // resurrect the JSON's levels.
  it('falls back to the committed levels when the collection is empty', () => {
    expect(mergeSponsorCopy(SPONSOR, undefined, null).levels).toEqual(SPONSOR.levels);
  });

  // The distinction that makes `null` worth carrying: an editor who deleted
  // every level meant to, and restoring them would undo that silently.
  it('honours an editor deleting every level', () => {
    expect(mergeSponsorCopy(SPONSOR, undefined, []).levels).toEqual([]);
  });

  // Same per-field guarantee the volunteer copy gets, on the sponsorship page.
  it('keeps the committed copy for fields the editor left blank', () => {
    const merged = mergeSponsorCopy(SPONSOR, { headline: 'Partner with us' });

    expect(merged.headline).toBe('Partner with us');
    expect(merged.intro).toBe(SPONSOR.intro);
    expect(merged.disclaimer).toBe(SPONSOR.disclaimer);
  });

  // The one field where clearing the box has to mean something: blank renders
  // the unconfigured placeholder, so falling back would make taking a form back
  // down impossible once one had been set.
  it('lets the editor clear the inquiry form URL', () => {
    const withForm: SponsorPageCopy = { ...SPONSOR, inquiryFormUrl: 'https://forms.gle/abc' };
    expect(mergeSponsorCopy(withForm, { inquiryFormUrl: '' }).inquiryFormUrl).toBe('');
  });

  // Pasting a form URL turns the placeholder into a real embedded form.
  it('takes a newly set inquiry form URL', () => {
    expect(
      mergeSponsorCopy(SPONSOR, { inquiryFormUrl: 'https://forms.gle/abc' }).inquiryFormUrl,
    ).toBe('https://forms.gle/abc');
  });

  // Omitting the key is distinct from clearing it: only the latter takes a form
  // back down, so an entry that never mentions the field keeps the committed URL.
  it('falls back for an inquiry form URL the entry omits', () => {
    const withForm: SponsorPageCopy = { ...SPONSOR, inquiryFormUrl: 'https://forms.gle/abc' };
    expect(mergeSponsorCopy(withForm, { headline: 'Partner with us' }).inquiryFormUrl).toBe(
      'https://forms.gle/abc',
    );
  });
});

describe('mergeDonateFrame', () => {
  // An empty object, not undefined — the route spreads this result, so it has to
  // be spreadable even when there is nothing to contribute.
  it('returns nothing to spread when there is no entry', () => {
    expect(mergeDonateFrame(DONATE)).toEqual({});
  });

  // The migration working for the frame: the hero and closing ask are now copy an
  // editor owns rather than values in a file only a developer opens.
  it('takes the frame fields the editor filled in', () => {
    const merged = mergeDonateFrame(DONATE, {
      ctaTitle: 'Give what you can, monthly.',
      ctaLabel: 'Give now',
    });

    expect(merged.ctaTitle).toBe('Give what you can, monthly.');
    expect(merged.ctaLabel).toBe('Give now');
  });

  // The personalized headline is what the whole email campaign is built around,
  // so a cleared one has to fall back rather than ship a hero with no headline.
  it('keeps both committed headlines when the editor cleared them', () => {
    const merged = mergeDonateFrame(DONATE, { heroHeadlineNamed: '', heroHeadlineGeneric: '  ' });

    expect(merged.heroHeadlineNamed).toBe(DONATE.heroHeadlineNamed);
    expect(merged.heroHeadlineGeneric).toBe(DONATE.heroHeadlineGeneric);
  });

  // The `{name}` placeholder is data an editor types, so it has to survive the
  // merge verbatim — the browser is what replaces it.
  it('passes the {name} placeholder through untouched', () => {
    expect(
      mergeDonateFrame(DONATE, { heroHeadlineNamed: '{name}, thank you' }).heroHeadlineNamed,
    ).toBe('{name}, thank you');
  });

  // Only the frame. The route spreads this over a copy object whose other keys
  // belong to loadAccomplishments / loadPillars / loadDonateUrl, so leaking a
  // key here would silently clobber one of theirs.
  it('returns only frame keys, never the rest of the campaign copy', () => {
    expect(Object.keys(mergeDonateFrame(DONATE, { ctaTitle: 'Give' })).sort()).toEqual([
      'ctaBody',
      'ctaLabel',
      'ctaTitle',
      'heroHeadlineGeneric',
      'heroHeadlineNamed',
      'heroImage',
      'heroSubhead',
      'heroVideo',
    ]);
  });

  // The hero's optional moving backdrop, joining the frame rather than getting a
  // path of its own — which is what makes it arrive at the component for free,
  // since `loadDonateFrame` spreads whatever this returns.
  it('takes the hero video path the editor pasted', () => {
    expect(mergeDonateFrame(DONATE, { heroVideo: '/videos/momentum.mp4' }).heroVideo).toBe(
      '/videos/momentum.mp4',
    );
  });

  // THE point of leaving `heroVideo` out of `donatePage.json`. Every other frame
  // field falls back to the committed JSON when the box is blank, which is right
  // for copy that must never be empty — but applied here it would make the video
  // impossible to REMOVE from /admin, because clearing the box would resurrect
  // the JSON value. An editor has to be able to take the video off unaided.
  it('clears the video when the editor empties the box', () => {
    expect(mergeDonateFrame(DONATE, { heroVideo: '' }).heroVideo).toBeUndefined();
    expect(mergeDonateFrame(DONATE, { heroVideo: '   ' }).heroVideo).toBeUndefined();
  });

  // The production state: no video has ever been set. The key is present and
  // undefined rather than absent, so spreading the frame cannot resurrect a
  // stale value, and the hero renders exactly as it does today.
  it('leaves the video undefined when the entry carries no heroVideo', () => {
    const merged = mergeDonateFrame(DONATE, { ctaTitle: 'Give' });

    expect(merged.heroVideo).toBeUndefined();
    expect(merged.heroImage).toBe(DONATE.heroImage);
  });

  // Adding the field must not have disturbed its neighbour: the photo is the
  // video's poster and its fallback, so a change that broke `heroImage` would
  // take the fallback with it.
  it('still carries the hero image alongside a video', () => {
    const merged = mergeDonateFrame(DONATE, {
      heroImage: '/images/bg/campaign.jpg',
      heroVideo: '/videos/momentum.mp4',
    });

    expect(merged.heroImage).toBe('/images/bg/campaign.jpg');
    expect(merged.heroVideo).toBe('/videos/momentum.mp4');
  });
});

describe('mergeIntegrations', () => {
  const SETTINGS = {
    googleAnalyticsId: 'G-GCBX577FFD',
    customHeadHtml: '',
    customBodyHtml: '',
  };

  // The failure this guards is invisible: a site that quietly stopped measuring
  // anything, on every page, with nothing on screen to notice.
  it('keeps the committed analytics id when there is no entry', () => {
    expect(mergeIntegrations(SETTINGS).googleAnalyticsId).toBe('G-GCBX577FFD');
  });

  // The invisible failure this guards: a site that silently stopped measuring.
  it('keeps the committed analytics id when the editor cleared the box', () => {
    expect(mergeIntegrations(SETTINGS, { googleAnalyticsId: '' }).googleAnalyticsId).toBe(
      'G-GCBX577FFD',
    );
  });

  // Moving the site to a different GA4 property is a one-box edit.
  it('takes a re-pointed analytics id', () => {
    expect(mergeIntegrations(SETTINGS, { googleAnalyticsId: 'G-NEW12345' }).googleAnalyticsId).toBe(
      'G-NEW12345',
    );
  });

  // The escape hatch working — a verification tag and an end-of-page snippet both
  // reach the page they are meant to.
  it('takes custom head and body HTML the editor added', () => {
    const merged = mergeIntegrations(SETTINGS, {
      customHeadHtml: '<meta name="verify" content="x" />',
      customBodyHtml: '<script src="/w.js"></script>',
    });

    expect(merged.customHeadHtml).toBe('<meta name="verify" content="x" />');
    expect(merged.customBodyHtml).toBe('<script src="/w.js"></script>');
  });

  // Blank on both sides is the production state: `settings.json` ships these as
  // empty strings, so that empty string is what comes back. What matters to the
  // callers is that it stays FALSY — each one renders the fragment only when
  // there is markup, so blank must never become an empty `<Fragment set:html>`.
  it('leaves custom HTML falsy when neither side sets it', () => {
    const merged = mergeIntegrations(SETTINGS);

    expect(merged.customHeadHtml).toBeFalsy();
    expect(merged.customBodyHtml).toBeFalsy();
  });

  // The same guarantee when the singleton omits the keys altogether, which is
  // the shape a scenario seed writes.
  it('leaves custom HTML falsy when the settings omit the keys', () => {
    const merged = mergeIntegrations({ googleAnalyticsId: 'G-GCBX577FFD' });

    expect(merged.customHeadHtml).toBeFalsy();
    expect(merged.customBodyHtml).toBeFalsy();
  });
});
