// Pure, framework-free rules for the reorderable middle of the Momentum Fund
// page (/donate). No `fs`, no Astro imports, so they unit-test directly — the
// same shape as `./sponsors.ts` and `./events.ts`. The route supplies the
// entries; this module only validates and reshapes them.

import { sortByOrder } from './order';

/**
 * The section kinds `MomentumFundPage` knows how to render. `narrative` uses the
 * entry's own title/body/image and `goal-meter` its own title + `widgetId`; the
 * rest are slots whose card data still comes from `donatePage.json` (and, for
 * `testimonials` and `donors`, from their own collections), so their entry
 * carries only `kind` + `order`.
 */
export const SECTION_KINDS = [
  'narrative',
  'mission',
  'goal-meter',
  'accomplishments',
  'pillars',
  'testimonials',
  'donors',
  'stats',
] as const;

export type SectionKind = (typeof SECTION_KINDS)[number];

/**
 * The kinds whose markdown body is rendered onto the page.
 *
 * A fact about the kinds, so it lives beside them rather than as a `===`
 * comparison inside the astro:content loader where it cannot be unit-tested.
 * `narrative` was the only member for as long as the slot bands drew every word
 * from `donatePage.json`; the campaign design gives `mission` a paragraph of its
 * own and `testimonials` a lede above the quotes, so both now carry prose an
 * editor writes in the entry itself.
 */
export const KINDS_WITH_BODY = new Set<string>(['narrative', 'mission', 'testimonials']);

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
  mission: 'Our mission',
  'goal-meter': 'Our progress',
  accomplishments: 'What we have accomplished so far',
  pillars: 'What your gift powers',
  testimonials: 'From our community',
  donors: 'The people behind the fund',
  stats: 'By the numbers',
};

/** The layouts a `narrative` section can use. `text-only` is the fallback.
 *  `columns` sets the prose in two columns with no figure at all, which is what
 *  the campaign design asks of the "why support us" band — a layout value rather
 *  than a fourth renderer, so it degrades through `resolveLayout` like any
 *  other and the CMS dropdown picks it up with no second list to keep in step. */
export const SECTION_LAYOUTS = ['image-left', 'image-right', 'text-only', 'columns'] as const;

export type SectionLayout = (typeof SECTION_LAYOUTS)[number];

/** The layouts a `pillars` section can use. `list` stacks the cards as
 *  full-width rows with the ordinal in its own column; absent keeps the
 *  three-across bordered grid the band has always drawn. */
export const PILLAR_LAYOUTS = ['list'] as const;

/**
 * Every value the CMS's Layout dropdown offers, across every kind that reads
 * the field.
 *
 * Kept SEPARATE from `SECTION_LAYOUTS` rather than folded into it, because the
 * two answer different questions. `SECTION_LAYOUTS` is what `resolveLayout`
 * will accept for a NARRATIVE — widening it would make `list` a legal narrative
 * layout, and a narrative carrying an image plus `list` would then resolve to a
 * photo layout by accident. This list is only what an editor may PICK, and the
 * kind that reads it decides what it means.
 *
 * `src/lib/selectOptions.test.ts` holds the registry to this list, so adding a
 * layout here without adding it to `collections.json` fails rather than
 * silently leaving the dropdown short — which is exactly how `list` shipped
 * unselectable in the first place.
 */
export const SECTION_LAYOUT_OPTIONS = [...SECTION_LAYOUTS, ...PILLAR_LAYOUTS] as const;

/** The minimum shape needed to place a section on the page. */
export interface SectionLike {
  kind: string;
  title?: string;
  /** The uppercase eyebrow drawn above the heading. Unlike `layout`, `image` and
   *  `widgetId` — each of which belongs to one kind — this applies to EVERY
   *  kind: the campaign design puts a kicker over every band on the page. Blank
   *  draws nothing, which is every band before this field existed. */
  kicker?: string;
  layout?: string;
  image?: string;
  /** The Givebutter widget id. `goal-meter` sections only — the same
   *  kind-specific treatment `layout` and `image` get for narratives. Blank
   *  renders no band at all. */
  widgetId?: string;
  /** The goal-meter band's optional "View the campaign →" link. Both blank is
   *  the band as it renders today; a label with no url draws nothing, since a
   *  link that goes nowhere is worse than no link. */
  linkLabel?: string;
  linkUrl?: string;
  /** The goal-meter's hand-entered figures, drawn only when no `widgetId` is
   *  set. See `GoalMeter.astro` for why they are free text and what they cost. */
  raised?: string;
  goal?: string;
  percent?: number;
  /** Renders a giving button under a `pillars` band. Blank renders none. */
  ctaLabel?: string;
  /** Which set of cards a SLOT band shows. Blank matches the ungrouped cards,
   *  which is the page as it renders today. The matching rule lives in
   *  `./sectionGroups.ts` because both card loaders need the identical one. */
  group?: string;
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
 * gives an orphan event tag. The CMS renders `kind` as a select now, but the
 * schema stays free text so a hand-edited file or a scenario seed cannot fail
 * the build; a stray value must cost that editor a missing section and a log
 * line, not the whole deploy.
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
 * The slugs of `goal-meter` sections carrying no widget id, for the same kind of
 * advisory `console.warn` at build time.
 *
 * The goal meter's half-finished state needs naming precisely because it is
 * SILENT: a meter section with no id renders nothing at all, which is the
 * designed behaviour and also exactly what a section an editor forgot looks
 * like. `unknownSectionKinds` covers the mistyped-kind case; this covers the
 * right-kind-wrong-field one, and the slug is what makes it diagnosable.
 *
 * Blank and whitespace-only count as missing, matching the component: both
 * render nothing, so both deserve the line.
 */
export function goalMetersMissingWidgetId(
  sections: readonly (SectionLike & { slug?: string })[],
): string[] {
  return sections
    .filter(
      (section) =>
        section.kind === 'goal-meter' &&
        !section.widgetId?.trim() &&
        // A band carrying hand-entered figures draws a real bar without a
        // widget, so it is NOT the silent-blank case this advisory exists to
        // catch. Warning about it would train the reader to ignore the line,
        // which costs more than the line is worth.
        !section.raised?.trim() &&
        !section.goal?.trim(),
    )
    .map((section) => section.slug ?? '(unnamed section)');
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
 * What a band is called: the section's own `title` when it has one, otherwise the
 * shared heading the page has always used for that kind.
 *
 * The slot bands took their heading from `donatePage.json` and ignored the
 * `title` they could already carry, which is why two `pillars` sections were
 * indistinguishable — both on the page and in the CMS list, where the row label
 * falls back to the slug. Letting a section USE its title is what names a
 * duplicated band, and it is deliberately ONE field rather than two: a separate
 * CMS label and page heading could disagree, and an editor renaming a band means
 * both.
 *
 * Whitespace-only counts as blank, matching every other free-text field on this
 * page. With no title and no fallback the result is `undefined` rather than the
 * string "undefined" — the components already treat a missing heading as "draw no
 * heading", which is the correct floor.
 */
export function sectionHeading(
  section: Pick<SectionLike, 'title'>,
  fallback?: string,
): string | undefined {
  return section.title?.trim() || fallback;
}

/**
 * The eyebrow drawn above a band's heading, or `undefined` when there is none.
 *
 * Deliberately a SEPARATE function from `sectionHeading` rather than a second
 * call into it, for two reasons. The two fall back to different things — a band
 * with no heading borrows the shared label for its kind, while a band with no
 * kicker simply has no kicker, because there is no per-kind eyebrow to borrow.
 * And a heading with no kicker is a perfectly ordinary band, not a half-filled
 * one, so this returning `undefined` must stay unremarkable at every call site.
 *
 * Whitespace-only counts as blank and `undefined` means draw-no-kicker, matching
 * `sectionHeading` exactly — an editor who clears the box gets the band back the
 * way it looked before the field existed.
 */
export function sectionKicker(
  section: Pick<SectionLike, 'kicker'>,
  fallback?: string,
): string | undefined {
  return section.kicker?.trim() || fallback;
}

/** The goal-meter band's optional link out to the campaign. */
export interface CampaignLink {
  label: string;
  url: string;
}

/**
 * The "View the campaign →" link beside the progress band's heading, or
 * `undefined` when it should not be drawn.
 *
 * BOTH halves are required, which is the whole rule. A label with no
 * destination would render a link that goes nowhere — worse than no link, since
 * a reader who clicks it learns the page is broken — and a url with no label has
 * nothing to click. Either box alone therefore draws nothing at all, and
 * `goal-meter.md` documents exactly that to the editor.
 *
 * Whitespace-only counts as blank, matching every other free-text field on this
 * page. The trimmed values are returned rather than the raw ones, so a url with
 * a stray trailing newline from a paste does not end up in the `href`.
 */
export function campaignLink(
  section: Pick<SectionLike, 'linkLabel' | 'linkUrl'>,
): CampaignLink | undefined {
  const label = section.linkLabel?.trim();
  const url = section.linkUrl?.trim();
  return label && url ? { label, url } : undefined;
}

/**
 * The ordinal a gift card shows, from its zero-based position in its band.
 *
 * A named rule rather than an expression in a `.map()` because of what the
 * position is measured against: the cards of THIS band, after `cardsInGroup`
 * has narrowed them — not the whole pillars collection. That is what makes a
 * duplicated, grouped gift band start again at `01` instead of continuing at
 * `04`, and it is the one thing about the numbering anyone could get wrong.
 *
 * Zero-padded to two digits, matching the campaign design. A band with more than
 * ninety-nine cards simply grows to three digits rather than truncating — the
 * page would be absurd long before that, but silently dropping a leading digit
 * would be worse than an unpadded one.
 */
export function giftOrdinal(index: number): string {
  return String(index + 1).padStart(2, '0');
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
