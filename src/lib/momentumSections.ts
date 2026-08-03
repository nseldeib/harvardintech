// Pure, framework-free rules for the reorderable middle of the Momentum Fund
// page (/donate). No `fs`, no Astro imports, so they unit-test directly — the
// same shape as `./sponsors.ts` and `./events.ts`. The route supplies the
// entries; this module only validates and reshapes them.

import { sortByOrder } from './order';

/**
 * The section kinds `MomentumFundPage` knows how to render. `narrative` uses the
 * entry's own title/body/image; the rest are slots whose card data still comes
 * from `donatePage.json` (and, for `testimonials` and `donors`, from their own
 * collections), so their entry carries only `kind` + `order`.
 */
export const SECTION_KINDS = [
  'narrative',
  'accomplishments',
  'pillars',
  'testimonials',
  'donors',
  'stats',
] as const;

export type SectionKind = (typeof SECTION_KINDS)[number];

/**
 * What each band is called when a "coming soon" placeholder has to name it.
 *
 * The slot bands carry only `kind` — their headings live in `donatePage.json` —
 * so without this a held-back band would have nothing to announce. `narrative` is
 * absent on purpose: those sections always carry their own `title`.
 *
 * The `HOME_SECTION_LABELS` counterpart for this page. Both live beside their
 * kinds rather than in the component that renders them, so the placeholder rule
 * is one testable fact per page instead of markup.
 */
export const SECTION_LABELS: Partial<Record<SectionKind, string>> = {
  accomplishments: 'What we have accomplished so far',
  pillars: 'What your gift powers',
  testimonials: 'From our community',
  donors: 'The people behind the fund',
  stats: 'By the numbers',
};

/** The layouts a `narrative` section can use. `text-only` is the fallback. */
export const SECTION_LAYOUTS = ['image-left', 'image-right', 'text-only'] as const;

export type SectionLayout = (typeof SECTION_LAYOUTS)[number];

/** The minimum shape needed to place a section on the page. */
export interface SectionLike {
  kind: string;
  title?: string;
  layout?: string;
  image?: string;
  order?: number;
  /** Renders the "coming soon" placeholder in place of this band. Classified by
   *  `resolveVisibility` in `./homeSections.ts`, shared with the homepage so both
   *  pages phase a section by the same rule. `draft` remains the hide switch. */
  comingSoon?: boolean;
  draft?: boolean;
}

/**
 * The sections to render, in the order an editor arranged them.
 *
 * Sorted by the optional `order` pin via the site-wide `sortByOrder`, so an
 * unnumbered section sorts last rather than jumping to the top. A section whose
 * `kind` matches no renderer is DROPPED rather than rendered blank — there is
 * nothing sensible to draw for a kind no component implements, and a silent gap
 * beats a crash. `unknownSectionKinds` exists so the route can still surface
 * what was skipped.
 *
 * Callers pass entries already draft-filtered by `publishedEntries`.
 */
export function orderedSections<T extends SectionLike>(sections: readonly T[]): T[] {
  const known = new Set<string>(SECTION_KINDS);
  return sortByOrder(sections.filter((section) => known.has(section.kind)));
}

/**
 * The unrecognized `kind` values in the input, de-duplicated and in first-seen
 * order, for an advisory `console.warn` at build time.
 *
 * Advisory, never build-failing — the same treatment `chapters/[slug].astro`
 * gives an orphan event tag. `kind` is free text because the CMS has no select
 * control, so a typo is a normal editing mistake; it must cost that editor a
 * missing section and a build log line, not the whole deploy.
 */
export function unknownSectionKinds(sections: readonly SectionLike[]): string[] {
  const known = new Set<string>(SECTION_KINDS);
  const seen = new Set<string>();
  for (const section of sections) {
    if (!known.has(section.kind)) seen.add(section.kind);
  }
  return [...seen];
}

/**
 * Which sections render on the tinted band, one flag per input section.
 *
 * Narrative sections alternate tinted / untinted so two consecutive prose
 * sections stay visually separated however an editor orders them. The counter
 * advances only on narratives, so a bespoke band sitting between two of them
 * does not flip the rhythm — otherwise adding the stats band would invert the
 * tint on every section below it.
 *
 * Pure, so the rule is testable and order-independent. It replaced a counter
 * mutated inside the page's `.map()`, which produced the right answer only
 * because the map happened to run front-to-back exactly once.
 */
export function tintedFlags(sections: readonly SectionLike[]): boolean[] {
  let narrativeIndex = -1;
  return sections.map((section) => {
    if (section.kind !== 'narrative') return false;
    narrativeIndex += 1;
    return narrativeIndex % 2 === 0;
  });
}

/**
 * Normalize a `layout` value to one the narrative component implements.
 *
 * Anything unrecognized — a typo, a blank field, an absent key — becomes
 * `text-only`, which renders the prose full-width and is the one layout that
 * looks correct with or without a photo. So a mistyped layout degrades to a
 * readable section instead of an empty column.
 */
export function resolveLayout(value?: string): SectionLayout {
  const layouts = SECTION_LAYOUTS as readonly string[];
  const normalized = value?.trim().toLowerCase() ?? '';
  return layouts.includes(normalized) ? (normalized as SectionLayout) : 'text-only';
}
