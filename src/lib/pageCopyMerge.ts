// Pure, framework-free rules for merging an editor's content entry over the
// committed JSON copy. No `fs`, no Astro imports, so they unit-test directly —
// the same split `./momentumSections.ts` and `./homeSections.ts` use against
// their `*Content.ts` edges. The loaders fetch; this module decides.
//
// WHY A MERGE EXISTS AT ALL. The volunteer, sponsorship, and Momentum Fund page
// copy moved out of `src/data/*.json` into content collections so the CMS could
// render editors for them. The JSON did not go away: it is now the fallback,
// because the CMS has no notion of a required singleton. An editor can delete
// the only "Volunteer page" entry, or clear one field of it, and neither is an
// error it warns them about. Falling back means those two ordinary mistakes cost
// a stale line of copy instead of a blank hero or a broken deploy.

import { byOrder } from './order';
import type { DonatePageCopy, SiteSettings, SponsorPageCopy, VolunteerPageCopy } from './site';

/**
 * The editor's value if it holds anything, otherwise the committed one.
 *
 * Whitespace-only counts as empty: a field an editor cleared usually still holds
 * the newline the textarea left behind, and treating that as real copy would put
 * a blank heading on the page — the exact failure the fallback exists to stop.
 *
 * The consequence is deliberate and worth naming: a field cannot be blanked from
 * the CMS while the JSON still carries a value. Emptying a heading is a two-step
 * edit. That is the right trade for copy, where the failure mode of the opposite
 * choice is a live page with a missing headline.
 */
export function preferText(value?: string, fallback?: string): string | undefined {
  return value?.trim() || fallback;
}

/** What a `volunteerPage` entry carries. Structural, not an Astro type, so this
 *  module stays independent of the content layer. */
export interface VolunteerCopyEntry {
  kicker?: string;
  heroImage?: string;
  headline?: string;
  intro?: string;
  benefitsTitle?: string;
  benefits?: { title: string; body: string }[];
  projectsTitle?: string;
  projectsIntro?: string;
  projectsEmptyMessage?: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

/**
 * The /volunteer copy an editor's entry produces over the committed JSON.
 *
 * `benefits` is ALL-OR-NOTHING rather than field-by-field: an editor who has
 * started rewriting the blocks means the list they are building, so a
 * half-finished list must not be silently topped up with leftovers from the
 * JSON. An EMPTY list is a real edit too — it removes the band — which is why
 * the test is on the key being present rather than on its length.
 */
export function mergeVolunteerCopy(
  fallback: VolunteerPageCopy,
  entry?: VolunteerCopyEntry,
): VolunteerPageCopy {
  if (!entry) return fallback;

  return {
    ...fallback,
    kicker: preferText(entry.kicker, fallback.kicker),
    heroImage: preferText(entry.heroImage, fallback.heroImage),
    headline: preferText(entry.headline, fallback.headline) ?? fallback.headline,
    intro: preferText(entry.intro, fallback.intro) ?? fallback.intro,
    benefitsTitle: preferText(entry.benefitsTitle, fallback.benefitsTitle),
    benefits: entry.benefits ?? fallback.benefits,
    projectsTitle: preferText(entry.projectsTitle, fallback.projectsTitle),
    projectsIntro: preferText(entry.projectsIntro, fallback.projectsIntro),
    projectsEmptyMessage: preferText(entry.projectsEmptyMessage, fallback.projectsEmptyMessage),
    ctaLabel: preferText(entry.ctaLabel, fallback.ctaLabel),
    ctaUrl: preferText(entry.ctaUrl, fallback.ctaUrl),
  };
}

/** The frontmatter of a `sponsorLevels` entry. Deliberately carries NO `id`:
 *  see {@link SponsorLevelRecord}. */
export interface SponsorLevelEntry {
  name: string;
  summary?: string;
  benefits?: { text: string }[];
  order?: number;
}

/**
 * One `sponsorLevels` collection entry — its own id (the filename stem) plus its
 * frontmatter.
 *
 * The ENTRY ID is the level's stable key, the thing a sponsor's `tier` matches
 * on. It is deliberately not a frontmatter field, for two reasons that point the
 * same way. First, an editable `id` text box is a footgun: retyping it silently
 * re-homes every sponsor filed under that level, and there is no reason to hand
 * an editor that particular loaded gun when the key never needs to change.
 * Second, the codeyam seed adapter treats `id` (like `slug`) as the FILENAME
 * key and strips it from the frontmatter it writes, so a required `id` field
 * makes the collection literally unseedable — every scenario's entries fail
 * schema validation and silently fall back to the committed JSON.
 *
 * Keying off the filename is also what `chapters` and `communities` already do,
 * so this is the site's existing convention rather than a new one.
 */
export interface SponsorLevelRecord {
  id: string;
  data: SponsorLevelEntry;
}

type SponsorLevel = NonNullable<SponsorPageCopy['levels']>[number];

/**
 * Partnership levels in the shape every component below already consumes.
 *
 * `benefits` is stored as `{ text }` ROWS because the editor's repeatable list
 * is a list of field rows — there is no "list of plain strings" control. This is
 * where that storage shape meets the `string[]` the page renders.
 *
 * Callers pass entries already draft-filtered and ordered.
 */
export function toSponsorLevels(entries: readonly SponsorLevelRecord[]): SponsorLevel[] {
  return entries.map(({ id, data }) => ({
    id,
    name: data.name,
    summary: data.summary,
    benefits: data.benefits?.map((benefit) => benefit.text),
  }));
}

/**
 * The partnership levels a set of collection entries produces: ordered by the
 * editor's `order` pin, reshaped for the page — or `null` when there are none.
 *
 * `null` rather than `[]` is the whole point of this function existing
 * separately from {@link toSponsorLevels}. It is the signal
 * {@link mergeSponsorCopy} needs to tell "an editor deleted every level" apart
 * from "nothing has been migrated into this collection yet": the second must
 * fall back to the committed JSON, and the first must NOT, or removing a level
 * would silently undo itself on the next build.
 *
 * Takes the entries rather than their `data`, so the loader above it stays a
 * bare fetch with no reshaping of its own.
 */
export function sponsorLevelsFrom(
  entries: readonly SponsorLevelRecord[],
): SponsorLevel[] | null {
  if (entries.length === 0) return null;
  return toSponsorLevels([...entries].sort((a, b) => byOrder(a.data, b.data)));
}

/** What a `sponsorPage` entry carries. */
export interface SponsorCopyEntry {
  kicker?: string;
  headline?: string;
  intro?: string;
  heroImage?: string;
  levelsTitle?: string;
  levelsIntro?: string;
  wallTitle?: string;
  wallEmptyMessage?: string;
  inquiryTitle?: string;
  inquiryBody?: string;
  inquiryFormUrl?: string;
  disclaimer?: string;
}

/**
 * The /sponsor copy, with the levels re-attached so `groupSponsorsByLevel` and
 * every child component keep the exact input they always took.
 *
 * `levels` is `null` — not `[]` — when nothing has been migrated, so "an editor
 * deleted every level" stays distinguishable from "this collection is empty".
 * Falling back on the first would resurrect levels someone deliberately removed.
 */
export function mergeSponsorCopy(
  fallback: SponsorPageCopy,
  entry?: SponsorCopyEntry,
  levels?: SponsorLevel[] | null,
): SponsorPageCopy {
  const withLevels = { ...fallback, levels: levels ?? fallback.levels };
  if (!entry) return withLevels;

  return {
    ...withLevels,
    kicker: preferText(entry.kicker, fallback.kicker),
    headline: preferText(entry.headline, fallback.headline) ?? fallback.headline,
    intro: preferText(entry.intro, fallback.intro),
    heroImage: preferText(entry.heroImage, fallback.heroImage),
    levelsTitle: preferText(entry.levelsTitle, fallback.levelsTitle),
    levelsIntro: preferText(entry.levelsIntro, fallback.levelsIntro),
    wallTitle: preferText(entry.wallTitle, fallback.wallTitle),
    wallEmptyMessage: preferText(entry.wallEmptyMessage, fallback.wallEmptyMessage),
    inquiryTitle: preferText(entry.inquiryTitle, fallback.inquiryTitle),
    inquiryBody: preferText(entry.inquiryBody, fallback.inquiryBody),
    // NOT `preferText`: a blank inquiry form URL is the production state AND a
    // meaningful one — it renders EmbedForm's unconfigured placeholder. Falling
    // back on blank would make taking a form back down impossible once one was
    // set, which is the one field where clearing the box has to mean something.
    inquiryFormUrl: entry.inquiryFormUrl ?? fallback.inquiryFormUrl,
    disclaimer: preferText(entry.disclaimer, fallback.disclaimer),
  };
}

/** The Momentum Fund frame fields a `pageCopy` entry carries. */
export interface DonateFrameEntry {
  heroHeadlineNamed?: string;
  heroHeadlineGeneric?: string;
  heroSubhead?: string;
  heroImage?: string;
  ctaTitle?: string;
  ctaBody?: string;
  ctaLabel?: string;
}

/**
 * The campaign page's FRAME — the hero above the reorderable sections and the
 * closing ask below them.
 *
 * Returns only the frame keys, so the route can spread it over the copy object
 * without disturbing the fields other loaders own. The frame stays editable
 * copy and still NOT a section: a page whose hero could be dragged to the bottom
 * is a page an editor can break, and changing the wording does not change that.
 *
 * The two headlines matter most. `heroHeadlineNamed` carries the `{name}`
 * placeholder the browser fills from the campaign link, so a blank one would
 * quietly strip the personalization the whole email campaign is built around.
 */
export function mergeDonateFrame(
  fallback: DonatePageCopy,
  entry?: DonateFrameEntry,
): Partial<DonatePageCopy> {
  if (!entry) return {};

  return {
    heroHeadlineNamed:
      preferText(entry.heroHeadlineNamed, fallback.heroHeadlineNamed) ?? fallback.heroHeadlineNamed,
    heroHeadlineGeneric:
      preferText(entry.heroHeadlineGeneric, fallback.heroHeadlineGeneric) ??
      fallback.heroHeadlineGeneric,
    heroSubhead: preferText(entry.heroSubhead, fallback.heroSubhead),
    heroImage: preferText(entry.heroImage, fallback.heroImage),
    ctaTitle: preferText(entry.ctaTitle, fallback.ctaTitle),
    ctaBody: preferText(entry.ctaBody, fallback.ctaBody),
    ctaLabel: preferText(entry.ctaLabel, fallback.ctaLabel),
  };
}

/** Just the integration keys — deliberately narrower than `SiteSettings`, so a
 *  caller cannot reach the rest of the settings singleton through this door. */
export interface SiteIntegrations {
  googleAnalyticsId?: string;
  customHeadHtml?: string;
  customBodyHtml?: string;
}

/**
 * The site-wide integration keys over `settings.json`.
 *
 * The fallback matters more here than anywhere else in this migration. Every
 * other field degrades to slightly stale copy; these degrade to a site with no
 * analytics and no verification tags, on every page, with nothing visible to
 * notice. So a deleted entry or a cleared field falls back to the committed
 * settings rather than to "off" — and turning analytics off is consequently a
 * two-step edit, which is the right trade against one mistake silently
 * unhooking measurement from the whole site.
 */
export function mergeIntegrations(
  fallback: Pick<SiteSettings, 'googleAnalyticsId' | 'customHeadHtml' | 'customBodyHtml'>,
  entry?: SiteIntegrations,
): SiteIntegrations {
  return {
    googleAnalyticsId: preferText(entry?.googleAnalyticsId, fallback.googleAnalyticsId),
    customHeadHtml: preferText(entry?.customHeadHtml, fallback.customHeadHtml),
    customBodyHtml: preferText(entry?.customBodyHtml, fallback.customBodyHtml),
  };
}
