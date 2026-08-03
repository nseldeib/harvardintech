// Pure, framework-free rules for the homepage's reorderable bands. No `fs`, no
// Astro imports, so they unit-test directly — the same shape as
// `./momentumSections.ts`, which this module deliberately mirrors. The route
// supplies the entries; this module only validates, orders, and classifies them.
//
// The homepage used to hardcode thirteen components in source order, so hiding a
// band or holding one back for launch was a code change. Modelling each band as
// a content entry makes both an edit an organizer can make from /admin.

import { sortByOrder } from './order';

/**
 * The bands `index.astro` knows how to render. Each entry's `kind` selects one;
 * the components own their own markup, so an entry carries only placement and
 * visibility.
 */
export const HOME_SECTION_KINDS = [
  'hero',
  'stats',
  'events',
  'chapters',
  'focus',
  'content-hub',
  'board',
  'get-involved',
  'giving',
  'whatsapp',
  'support',
  'gallery',
  'contact',
] as const;

export type HomeSectionKind = (typeof HOME_SECTION_KINDS)[number];

/**
 * What a band does on the published site.
 *
 * Three states, but deliberately NOT a three-valued field: the CMS's field types
 * stop at text/number/textarea/date/image/boolean/list, so a tri-state would
 * have to be free text an editor types exactly right. Two toggles instead —
 * `draft` (already on every collection) and `comingSoon` — give the same three
 * outcomes through controls the editor actually renders, and `draft` keeps
 * meaning what it means everywhere else on the site.
 */
export type SectionVisibility = 'shown' | 'coming-soon' | 'hidden';

/**
 * The two toggles, and nothing else. Deliberately narrower than
 * `HomeSectionLike` so the Momentum Fund page's sections — which carry a
 * different set of fields — get classified by the same rule rather than a second
 * copy of it that could drift.
 */
export interface VisibilityFlags {
  comingSoon?: boolean;
  draft?: boolean;
}

/** The minimum shape needed to place and classify a band. */
export interface HomeSectionLike extends VisibilityFlags {
  kind: string;
  title?: string;
  order?: number;
}

/**
 * A band's state from its two toggles.
 *
 * `draft` wins over `comingSoon`: an entry with both switched on is one an
 * editor has taken off the site, and a hidden band cannot also be advertising
 * itself. Reading them the other way round would put a "coming soon" placeholder
 * on the public site for something the editor had explicitly hidden — the one
 * outcome neither switch should ever produce.
 */
export function resolveVisibility<T extends VisibilityFlags>(section: T): SectionVisibility {
  if (section.draft === true) return 'hidden';
  if (section.comingSoon === true) return 'coming-soon';
  return 'shown';
}

/**
 * The bands to render, in the order an editor arranged them.
 *
 * Sorted by the optional `order` pin via the site-wide `sortByOrder`, so an
 * unnumbered band sorts last rather than jumping to the top. A band whose `kind`
 * matches no component is DROPPED rather than rendered blank, exactly as
 * `orderedSections` drops an unknown Momentum Fund section: there is nothing
 * sensible to draw, and a silent gap beats a crash.
 *
 * Draft entries arrive already filtered by `publishedEntries`, so on the public
 * build a hidden band never reaches here at all, while the review track still
 * shows it — which is what lets an editor look at a held-back band before
 * turning it on.
 */
export function orderedHomeSections<T extends HomeSectionLike>(sections: readonly T[]): T[] {
  const known = new Set<string>(HOME_SECTION_KINDS);
  return sortByOrder(sections.filter((section) => known.has(section.kind)));
}

/**
 * The unrecognized `kind` values in the input, de-duplicated and in first-seen
 * order, for an advisory `console.warn` at build time.
 *
 * Advisory, never build-failing — the same treatment `unknownSectionKinds` gives
 * the Momentum Fund page. `kind` is free text because the CMS has no select
 * control, so a typo is a normal editing mistake; it must cost that editor one
 * band and a build log line, not the whole deploy.
 */
export function unknownHomeSectionKinds(sections: readonly HomeSectionLike[]): string[] {
  const known = new Set<string>(HOME_SECTION_KINDS);
  const seen = new Set<string>();
  for (const section of sections) {
    if (!known.has(section.kind)) seen.add(section.kind);
  }
  return [...seen];
}

/**
 * The homepage anchor each band owns, for the bands the menu links to by
 * fragment. A band with no entry here is one nothing in `nav.json` points at.
 *
 * This table is what couples the two halves of "Hidden": the section leaves the
 * page AND its menu item leaves with it. `nav.ts` already derives the Chapters
 * and Communities groups from content precisely so a menu entry can never
 * outlive what it points at; a hand-authored `/#board` link pointing at a band
 * an editor hid is the same failure in a different place.
 */
export const HOME_SECTION_ANCHORS: Partial<Record<HomeSectionKind, string>> = {
  hero: '/#about',
  stats: '/#stats',
  events: '/#events',
  chapters: '/#chapters',
  board: '/#board',
  whatsapp: '/#community',
  gallery: '/#gallery',
  contact: '/#contact',
};

/**
 * What each band is called when a "coming soon" placeholder has to name it.
 *
 * An entry's own `title` wins; this is the fallback, so a band an editor held
 * back before naming it still reads as deliberate rather than blank. Kept here
 * rather than in the page because it is data about the kinds, and the kinds live
 * here.
 */
export const HOME_SECTION_LABELS: Record<HomeSectionKind, string> = {
  hero: 'Harvard Alumni in Tech',
  stats: 'By the numbers',
  events: 'Upcoming events',
  chapters: 'Our chapters',
  focus: 'What we focus on',
  'content-hub': 'Content hub',
  board: 'Board of Directors',
  'get-involved': 'Get involved',
  giving: 'Support the Momentum Fund',
  whatsapp: 'The WhatsApp community',
  support: 'Support us',
  gallery: 'Event gallery',
  contact: 'Contact us',
};

/**
 * The element id a band's placeholder must carry so a menu link still lands on
 * it — the fragment of that band's entry in {@link HOME_SECTION_ANCHORS}.
 *
 * DERIVED rather than a second table. The anchor (`/#board`) and the id (`board`)
 * are the same fact written two ways, and a hand-maintained copy of the second
 * would eventually disagree with the first — at which point a coming-soon band
 * would silently stop being reachable from the menu that still links to it.
 *
 * `undefined` for a band nothing links to, which is the correct value to hand an
 * `id` attribute that should not be rendered.
 */
export function sectionAnchorId(kind: string): string | undefined {
  const anchor = HOME_SECTION_ANCHORS[kind as HomeSectionKind];
  return anchor?.split('#')[1] || undefined;
}

/**
 * The homepage anchors that no longer have a band behind them — the ones a
 * `hidden` entry left pointing at nothing.
 *
 * A `coming-soon` band is NOT included: it is still on the page, so its menu
 * item still lands somewhere, and a visitor following the link sees the
 * placeholder rather than scrolling past it. That is the whole difference
 * between the two states.
 *
 * Bands absent from `sections` entirely are also treated as gone. An anchor with
 * no entry at all is the same broken link as one whose entry is hidden, and on
 * the public build a drafted band arrives here already filtered out.
 */
export function hiddenSectionAnchors(sections: readonly HomeSectionLike[]): string[] {
  const live = new Set<string>();
  for (const section of sections) {
    if (resolveVisibility(section) !== 'hidden') live.add(section.kind);
  }

  return Object.entries(HOME_SECTION_ANCHORS)
    .filter(([kind]) => !live.has(kind))
    .map(([, anchor]) => anchor);
}
