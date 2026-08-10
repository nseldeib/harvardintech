import * as fs from 'node:fs';
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import type { Loader } from 'astro/loaders';
import { contentRoot } from '../lib/contentRoot';

// A typed content collection is the data layer for a static Astro site:
// markdown files under `<contentRoot>/<collection>/` validated against this
// schema at build time. codeyam's `content-collection` seed adapter writes and
// clears these files per scenario, so the schemas below are also the contract
// the seed data must satisfy. Optional fields exist on purpose — the "missing
// optional frontmatter" scenarios prove an entry without them still renders.
//
// The collections load via the Astro Content Layer `glob` loader so their base
// directory is *redirectable*: normally `src/content`, but during a codeyam
// session `contentRoot()` resolves to a sandbox copy under `.codeyam/tmp/` so
// seeding never touches the committed production markdown. (Legacy
// `type: 'content'` collections were locked to `src/content` and could not be
// pointed elsewhere — that is the bug this migration fixes.)
const root = contentRoot();

/**
 * The loader every collection below uses: Astro's `glob`, wrapped to clear the
 * collection's stored entries when its directory has no markdown left.
 *
 * The wrapper exists because Astro's glob loader returns EARLY on an empty
 * directory — before the line that deletes the entries it did not just re-read:
 *
 *     if (exists && files.length === 0) { logger.warn('No files found…'); return }
 *     …
 *     untouchedEntries.forEach((id) => store.delete(id))
 *       — node_modules/astro/dist/content/loaders/glob.js
 *
 * Harmless for a collection that is always populated. Not harmless here: every
 * scenario re-initialises the sandbox from production before writing its own
 * seed, so a collection one scenario filled (`donors`) is EMPTY for the next
 * one — and the stale entries would survive into it, leaking one scenario's
 * data into another's page. Clearing first makes "no files" mean "no entries",
 * which is what an empty directory has always meant everywhere else.
 *
 * `store.clear()` is scoped to the one collection being loaded, so this can
 * never touch another's data.
 */
function collectionGlob(collection: string): Loader {
  const dir = `${root}/${collection}`;
  const inner = glob({ pattern: '**/*.md', base: dir });

  return {
    ...inner,
    load: async (context) => {
      const hasMarkdown =
        fs.existsSync(dir) && fs.readdirSync(dir).some((file) => /\.mdx?$/.test(file));
      if (!hasMarkdown) context.store.clear();
      return inner.load(context);
    },
  };
}

// Every collection carries an optional `draft` flag, because the CMS renders a
// Draft toggle on all of them. Absent means published, so no existing entry
// needs migrating and the toggle's "off" state is simply the missing key (the
// CMS only ever writes `draft: true`). Declaring it here is what makes the flag
// survive validation at all — a zod object silently strips keys it does not
// know about, which is why ticking Draft used to do nothing. Routes, not this
// schema, decide visibility: see `publishedEntries` in `src/lib/drafts.ts`.

// Blog posts. `coverImage`/`summary` are optional so a minimal post renders.
// `metaTitle`/`metaDescription`/`ogImage` are per-page SEO overrides (fall back
// to the post's own fields, then site defaults); `embedUrl`/`embedHtml` drop a
// third-party embed after the post body. All optional — a post without them
// renders unchanged.
const blog = defineCollection({
  loader: collectionGlob('blog'),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string().optional(),
    coverImage: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    ogImage: z.string().optional(),
    embedUrl: z.string().optional(),
    embedHtml: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});

// Free-form site pages (About, chapter pages, etc.). `order` sorts them in a
// nav or index; the markdown body is the page content.
const pages = defineCollection({
  loader: collectionGlob('pages'),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    order: z.number().optional(),
    // Per-page SEO overrides + optional embed, matching the blog collection so
    // the same CMS fields apply once a `pages` route renders these entries.
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    ogImage: z.string().optional(),
    embedUrl: z.string().optional(),
    embedHtml: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});

// Team / board members. `photo` and `bio` are optional so a name-and-role-only
// entry still renders; `order` controls display order. `active` toggles whether
// a member appears on the public Board of Directors — an absent `active` means
// shown, so existing entries (and members who never toggled it) stay visible.
const team = defineCollection({
  loader: collectionGlob('team'),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    photo: z.string().optional(),
    bio: z.string().optional(),
    order: z.number().optional(),
    active: z.boolean().optional(),
    draft: z.boolean().optional(),
  }),
});

// Upcoming / past events. `link` points at an external registration page;
// `location` and `description` are optional for a bare save-the-date. `chapter`
// is the slug/id of the regional chapter this event belongs to — optional so a
// non-chapter event (e.g. the Cambridge panel) still validates and simply
// appears on no chapter page.
const events = defineCollection({
  loader: collectionGlob('events'),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    location: z.string().optional(),
    description: z.string().optional(),
    link: z.string().optional(),
    chapter: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});

// Regional chapters (NYC, SF, L.A., Japan). One markdown file per city under
// `<contentRoot>/chapters/`, rendered at `/chapters/<slug>` and linked from the
// nav Chapters dropdown. `leads` (named organizers) and `links` (city-specific
// signup / social URLs) are optional so a chapter with no leads still renders;
// the markdown body is the longer "about this chapter" copy.
const chapters = defineCollection({
  loader: collectionGlob('chapters'),
  schema: z.object({
    city: z.string(),
    region: z.string().optional(),
    blurb: z.string().optional(),
    // Full-bleed city header (mirrors the live harvardintech.com chapter pages):
    // `heroImage` is the background photo, `tagline` the subtitle beneath the
    // "HARVARD IN TECH <CITY>" title. `showGallery` toggles the event photo
    // gallery; absent → shown (the live site shows it on every chapter), set
    // `false` to opt out. All optional → a chapter without them falls back
    // to the centered header.
    heroImage: z.string().optional(),
    tagline: z.string().optional(),
    showGallery: z.boolean().optional(),
    // This chapter's OWN event photos, curated in /admin. Absent or empty →
    // the page falls back to the shared 40-photo landing-page gallery, which
    // is what every chapter showed before this field existed — so adding the
    // field changed nothing until someone curates a chapter.
    //
    // `caption` is editorial ("Spring mixer at Cornell Tech") and is what makes
    // the lightbox worth opening. Alt text deliberately does NOT live here:
    // `altFor` resolves it from `media.json`, which is the site's single source
    // for alt, and a second field would be a competing one that drifts.
    photos: z
      .array(z.object({ image: z.string(), caption: z.string().optional() }))
      .optional(),
    // Per-chapter "Connect With Us" email; absent → fall back to the global
    // settings contact email.
    contactEmail: z.string().optional(),
    leads: z
      .array(z.object({ name: z.string(), role: z.string().optional() }))
      .optional(),
    links: z
      .array(z.object({ label: z.string(), url: z.string() }))
      .optional(),
    order: z.number().optional(),
    draft: z.boolean().optional(),
  }),
});

// Interest-based communities (Founders, AI) — the non-geographic counterpart to
// a chapter. One markdown file per community under `<contentRoot>/communities/`,
// rendered at `/communities/<slug>` and derived into the nav Communities group
// beside the hand-authored WhatsApp link.
//
// Deliberately the chapter schema with `name` in place of `city`: a community
// has no location, but everything else about the page — hero, tagline, leads,
// links, gallery toggle, per-community contact email — is the same, so both
// render through the same components and an editor who has filled in one form
// already knows the other. Events join a community through the same `chapter`
// tag they use for chapters, so there is no second field to learn.
const communities = defineCollection({
  loader: collectionGlob('communities'),
  schema: z.object({
    name: z.string(),
    blurb: z.string().optional(),
    heroImage: z.string().optional(),
    tagline: z.string().optional(),
    showGallery: z.boolean().optional(),
    contactEmail: z.string().optional(),
    leads: z
      .array(z.object({ name: z.string(), role: z.string().optional() }))
      .optional(),
    links: z
      .array(z.object({ label: z.string(), url: z.string() }))
      .optional(),
    order: z.number().optional(),
    draft: z.boolean().optional(),
  }),
});

// Open volunteer projects, rendered as the grid on /volunteer. Everything but
// the title is optional so an organizer can post a project the moment it opens
// and fill in the thumbnail/commitment later. `active: false` retires a project
// without deleting its record (absent → shown, matching the `team` convention).
const projects = defineCollection({
  loader: collectionGlob('projects'),
  schema: z.object({
    title: z.string(),
    blurb: z.string().optional(),
    image: z.string().optional(),
    applyUrl: z.string().optional(),
    commitment: z.string().optional(),
    // DISPLAY ONLY. These format into a range on the card and the detail page
    // header; they never decide whether a project appears. Do not add date
    // filtering here on the assumption it was forgotten: this is a static
    // build, so a date-expired project would linger until the next deploy and
    // then vanish without anyone touching the CMS. `active` is the one toggle
    // that retires a project, and it takes effect on publish.
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    order: z.number().optional(),
    active: z.boolean().optional(),
    draft: z.boolean().optional(),
  }),
});

// Organizations supporting Harvard Alumni in Tech, shown on the /sponsor wall.
//
// `tier` groups the wall by partnership level and holds the `id` of a level in
// `sponsorPage.json` — free text here rather than an enum, because the levels
// are editable copy and a schema enum would make renaming a level a code change.
//
// `placeholder: true` marks an ILLUSTRATIVE entry. The wall then renders an
// explicit "example, not actual sponsors" notice, so a page carrying sample
// entries can never be mistaken for a live sponsor list — which is the whole
// reason sample entries are allowed to ship at all. A real sponsor omits it.
const sponsors = defineCollection({
  loader: collectionGlob('sponsors'),
  schema: z.object({
    name: z.string(),
    tier: z.string().optional(),
    logo: z.string().optional(),
    url: z.string().optional(),
    placeholder: z.boolean().optional(),
    order: z.number().optional(),
    draft: z.boolean().optional(),
  }),
});

// Member quotes for the Momentum Fund campaign page (/donate). Production
// starts with none — the testimonials band renders nothing at all when the
// collection is empty, so the page reads as finished before any quotes exist.
const testimonials = defineCollection({
  loader: collectionGlob('testimonials'),
  schema: z.object({
    quote: z.string(),
    name: z.string(),
    role: z.string().optional(),
    photo: z.string().optional(),
    order: z.number().optional(),
    draft: z.boolean().optional(),
  }),
});

// People who gave to the Momentum Fund, listed on the /donate recognition wall.
// Production starts with none — the wall renders its invitation state until the
// first gift is recorded, the same way the sponsor wall and the volunteer grid do.
//
// `tier` holds the `id` of a giving level in `donatePage.json` — free text here
// rather than an enum for the same reason the sponsor `tier` is: the levels are
// editable copy, and an enum would make renaming one a code change. An unmatched
// or blank tier collects under a trailing group rather than dropping the donor.
//
// `founding` is a BADGE, not a tier. Founding donors are recognized separately
// from how much they gave, so the flag renders the mark on whichever giving level
// the donor sits in instead of forcing them into a level that misstates the gift.
//
// `anonymous` is the one field here that cannot be got wrong twice: it renders
// "Anonymous donor" on the site while the entry keeps the real name for the
// team's records, and it suppresses `url` so the donor is not identifiable
// through their own link. Publishing a name someone asked to withhold is not
// fixable by a later edit, so it is schema, not convention.
const donors = defineCollection({
  loader: collectionGlob('donors'),
  schema: z.object({
    name: z.string(),
    tier: z.string().optional(),
    founding: z.boolean().optional(),
    anonymous: z.boolean().optional(),
    note: z.string().optional(),
    url: z.string().optional(),
    photo: z.string().optional(),
    order: z.number().optional(),
    draft: z.boolean().optional(),
  }),
});

// The reorderable middle of the Momentum Fund campaign page (/donate). Each
// entry is one section; `order` is how an editor moves a section up or down and
// `draft` is how they hide one without deleting it. The hero and the closing CTA
// are deliberately NOT sections — a page whose hero could be dragged to the
// bottom is a page an editor can break, and the campaign's ask-at-the-end shape
// is a design decision rather than an editorial one.
//
// `kind` selects the renderer. `narrative` sections carry their own title, body,
// and photo; `accomplishments`, `pillars`, `testimonials`, and `stats` are SLOTS
// whose card data still lives in `donatePage.json` — modelling those as markdown
// would trade a tailored design for editability nobody asked for.
//
// `kind` and `layout` are free text, not enums, because the CMS field types stop
// at `text | number | textarea | date | image | boolean | list` — there is no
// select control to back an enum, and a schema enum would turn a typo into a
// build failure. `src/lib/momentumSections.ts` validates instead: an unknown
// `kind` is dropped with a warning, an unknown `layout` falls back to text-only.
const momentumSections = defineCollection({
  loader: collectionGlob('momentumSections'),
  schema: z.object({
    kind: z.string(),
    title: z.string().optional(),
    layout: z.string().optional(),
    image: z.string().optional(),
    order: z.number().optional(),
    comingSoon: z.boolean().optional(),
    draft: z.boolean().optional(),
  }),
});

// The homepage's reorderable bands — `momentumSections` applied to the landing
// page. One entry per band, `kind` selecting the component, `order` moving it up
// or down. See `src/lib/homeSections.ts` for the kinds and the visibility rule.
//
// `comingSoon` is the third state between shown and hidden, and it is a second
// BOOLEAN rather than a three-valued field on purpose: the CMS's field types stop
// at text/number/textarea/date/image/boolean/list, so a tri-state would have to be
// free text an editor types exactly right. Two toggles give the same three
// outcomes through controls the editor actually renders, and `draft` keeps meaning
// what it means on every other collection. Absent means shown, so a band nobody
// has touched needs no migration.
const homeSections = defineCollection({
  loader: collectionGlob('homeSections'),
  schema: z.object({
    kind: z.string(),
    // Overrides the heading the coming-soon placeholder announces. Blank falls
    // back to a label derived from `kind`, so a band held back before anyone
    // named it still reads as deliberate rather than blank.
    title: z.string().optional(),
    order: z.number().optional(),
    comingSoon: z.boolean().optional(),
    draft: z.boolean().optional(),
  }),
});

// Slides of the homepage hero carousel. Migrated out of `HeroCarousel.astro`'s
// prop defaults, which were the live content because `index.astro` rendered the
// carousel with no props — so the most prominent copy on the site was the one
// thing no editor could reach. An empty collection falls back to those same
// defaults, so the hero is never blank.
const heroSlides = defineCollection({
  loader: collectionGlob('heroSlides'),
  schema: z.object({
    title: z.string(),
    kicker: z.string().optional(),
    lede: z.string().optional(),
    image: z.string().optional(),
    // Up to two buttons. `variant: 'out'` is the outlined style; anything else
    // renders solid, so a blank or mistyped variant degrades to a button that
    // still works.
    ctas: z
      .array(z.object({ label: z.string(), url: z.string(), variant: z.string().optional() }))
      .optional(),
    order: z.number().optional(),
    draft: z.boolean().optional(),
  }),
});

// Figures in the homepage stat strip under the hero. Migrated off `homeStats` in
// `settings.json`, which held the real numbers but had no input in the CMS: the
// package renders five scalar settings fields and round-trips every other key
// untouched, so the figures were editable data nobody could edit.
const stats = defineCollection({
  loader: collectionGlob('stats'),
  schema: z.object({
    value: z.string(),
    label: z.string(),
    order: z.number().optional(),
    draft: z.boolean().optional(),
  }),
});

// Cards in the Momentum Fund's "What we've accomplished so far" band. Migrated
// out of `donatePage.json`, which the CMS does not model at all. The
// `momentumSections` entry of kind `accomplishments` still positions the band;
// these entries are now its content.
// The card copy is `description` rather than `body` because `body` is a RESERVED
// field id in the CMS registry (`RESERVED_FIELD_IDS` in the package's
// `collectionRegistry`) — it belongs to the markdown-body machinery, and a custom
// field claiming it is dropped from the editor without comment. The same applies
// to `pillars` below.
const accomplishments = defineCollection({
  loader: collectionGlob('accomplishments'),
  schema: z.object({
    value: z.string(),
    label: z.string(),
    description: z.string().optional(),
    order: z.number().optional(),
    draft: z.boolean().optional(),
  }),
});

// Cards in the Momentum Fund's "What Your Gift Powers" band, also migrated out of
// `donatePage.json`. `icon` names one of the three inline SVG glyphs as free text
// validated in `src/lib/pillars.ts` — the same treatment `kind` and `layout` get —
// so an unrecognized value falls back to a drawn icon instead of failing the
// build. A card with no `linkLabel`/`linkUrl` renders as plain copy.
const pillars = defineCollection({
  loader: collectionGlob('pillars'),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    icon: z.string().optional(),
    linkLabel: z.string().optional(),
    linkUrl: z.string().optional(),
    order: z.number().optional(),
    draft: z.boolean().optional(),
  }),
});

// Per-page settings that are neither prose nor a repeating card: the handful of
// scalars an editor has to be able to change on a specific page. One entry per
// page, `id` naming the page (`donate`).
//
// This exists because the CMS models exactly two JSON singletons — `settings.json`
// and `nav.json` — and renders five scalar settings fields. `donatePage.json` is
// invisible to it, which left `donateUrl` reachable only by editing JSON in the
// repo. That is the one field that must be changeable the DAY a giving platform
// is chosen, and `resolveGiveHref` was already written to switch every giving
// button on it, so the only thing missing was somewhere an editor could type it.
const pageCopy = defineCollection({
  loader: collectionGlob('pageCopy'),
  schema: z.object({
    title: z.string(),
    // Real donation-platform URL for the /donate page. Blank keeps every giving
    // button on the mailto fallback — see `resolveGiveHref` in `src/lib/giving.ts`.
    donateUrl: z.string().optional(),
    // The campaign page's FIXED FRAME: the hero above the reorderable sections
    // and the closing ask below them. Editable copy, still not a section — a
    // page whose hero could be dragged to the bottom is a page an editor can
    // break, so these stay out of `momentumSections` by design.
    //
    // `heroHeadlineNamed` carries a `{name}` placeholder the browser fills from
    // `?name=` on the campaign link; `heroHeadlineGeneric` is what everyone else
    // (and every no-JS visitor) sees. Both are here so an editor rewriting the
    // campaign's headline changes BOTH forms in one place — editing only the
    // named one would leave the public audience on the old wording.
    heroHeadlineNamed: z.string().optional(),
    heroHeadlineGeneric: z.string().optional(),
    heroSubhead: z.string().optional(),
    heroImage: z.string().optional(),
    // The hero's optional MOVING backdrop: a path like `/videos/momentum.mp4`
    // for a file committed under `public/videos/`. Blank leaves the hero exactly
    // as `heroImage` renders it today.
    //
    // `heroImage` does not step aside when this is set — it becomes the video's
    // poster frame AND stays as the section's CSS background. That is what makes
    // every way the video can fail to play (a 404, a browser refusing autoplay,
    // a visitor on `prefers-reduced-motion`) degrade to the current page instead
    // of a black rectangle, with no JavaScript on any of those paths.
    heroVideo: z.string().optional(),
    // The closing ask at the bottom of the page.
    ctaTitle: z.string().optional(),
    ctaBody: z.string().optional(),
    // The giving button's label — ONE field, not one per band. The same text is
    // rendered on the hero button, the donor wall's button, and the closing
    // one, because they are the same ask in three places; splitting it per band
    // would let an editor change "Make a Gift" in one spot and leave the page
    // contradicting itself further down.
    ctaLabel: z.string().optional(),
  }),
});

// Editable copy for /volunteer, as a single entry. Was `volunteerPage.json`,
// which the CMS models no editor for, so rewriting the volunteer pitch was a
// developer's job. `benefits` is the one repeating field — a list of
// `{title, body}` rows, which is a top-level list of scalars and therefore
// expressible in the editor.
//
// Every field is optional except the entry's own `title`, and the route falls
// back to the committed JSON field by field. That is deliberate: the CMS has no
// notion of a required singleton, so an editor can delete this entry, and the
// page has to survive that as ordinary copy rather than a blank hero.
const volunteerPage = defineCollection({
  loader: collectionGlob('volunteerPage'),
  schema: z.object({
    title: z.string(),
    kicker: z.string().optional(),
    heroImage: z.string().optional(),
    headline: z.string().optional(),
    intro: z.string().optional(),
    benefitsTitle: z.string().optional(),
    benefits: z.array(z.object({ title: z.string(), body: z.string() })).optional(),
    projectsTitle: z.string().optional(),
    projectsIntro: z.string().optional(),
    // What the grid shows when no projects are open — the production default,
    // so it is the state most visitors actually see rather than an edge case.
    projectsEmptyMessage: z.string().optional(),
    ctaLabel: z.string().optional(),
    ctaUrl: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});

// Editable copy for /sponsor, as a single entry. Same migration and the same
// field-by-field fallback as `volunteerPage`.
//
// The partnership LEVELS are deliberately not here: they live in
// `sponsorLevels` below, because a level carries its own `benefits` list and the
// CMS supports a repeatable list of scalars at top level only. A list inside a
// list is not expressible, so the levels had to become entries of their own.
const sponsorPage = defineCollection({
  loader: collectionGlob('sponsorPage'),
  schema: z.object({
    title: z.string(),
    kicker: z.string().optional(),
    headline: z.string().optional(),
    intro: z.string().optional(),
    heroImage: z.string().optional(),
    levelsTitle: z.string().optional(),
    levelsIntro: z.string().optional(),
    wallTitle: z.string().optional(),
    wallEmptyMessage: z.string().optional(),
    inquiryTitle: z.string().optional(),
    inquiryBody: z.string().optional(),
    // Third-party form URL (Google Forms, Typeform). Empty renders EmbedForm's
    // unconfigured fallback, which reads as an obvious placeholder.
    inquiryFormUrl: z.string().optional(),
    // The Harvard Alumni Association requires a Shared Interest Group to state
    // that contributions go to the group and not to the University. Copy rather
    // than markup, so the team can revise the wording without a deploy.
    disclaimer: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});

// One partnership level on /sponsor. Migrated out of the `levels` array inside
// `sponsorPage.json` for the reason above — `benefits` needs to be a top-level
// list to be editable at all.
//
// The entry's FILENAME is the level's stable key — the thing a sponsor's `tier`
// matches on — so renaming the `name` below is always a safe copy edit. There is
// deliberately no `id` field: an editable id text box silently re-homes every
// sponsor filed under the level when retyped, and the codeyam seed adapter
// strips `id` (like `slug`) as a filename key, which would make this collection
// unseedable. `chapters` and `communities` key off the filename the same way.
//
// `groupSponsorsByLevel` collects a sponsor whose tier matches no level into a
// trailing group rather than dropping it, which is what makes a mistyped tag
// visible instead of silent.
const sponsorLevels = defineCollection({
  loader: collectionGlob('sponsorLevels'),
  schema: z.object({
    name: z.string(),
    summary: z.string().optional(),
    benefits: z.array(z.object({ text: z.string() })).optional(),
    order: z.number().optional(),
    draft: z.boolean().optional(),
  }),
});

// The site-wide integration keys, as a single entry.
//
// These have always been real editable data on `settings.json`, but the CMS
// settings screen renders inputs for five scalar keys plus the socials list and
// round-trips everything else untouched — so they were data with nowhere to edit
// them. Their own collection rather than extra fields on `pageCopy`, because the
// editor renders every declared field for every entry: sharing would put a
// Google Analytics box on the Momentum Fund page's editing screen.
//
// `settings.json` stays the fallback. Deleting this entry must not be able to
// unhook analytics from every page on the site.
const siteIntegrations = defineCollection({
  loader: collectionGlob('siteIntegrations'),
  schema: z.object({
    title: z.string(),
    // GA4 Measurement ID (`G-XXXXXXXXXX`); blank turns analytics off entirely.
    googleAnalyticsId: z.string().optional(),
    // Raw HTML injected verbatim into every page. The snippet runs site-wide, so
    // only trusted markup belongs here — this is the power-user escape hatch the
    // narrow, template-owned analytics field deliberately is not.
    customHeadHtml: z.string().optional(),
    customBodyHtml: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});

export const collections = {
  blog,
  pages,
  team,
  events,
  chapters,
  communities,
  projects,
  sponsors,
  testimonials,
  donors,
  momentumSections,
  homeSections,
  heroSlides,
  stats,
  accomplishments,
  pillars,
  pageCopy,
  volunteerPage,
  sponsorPage,
  sponsorLevels,
  siteIntegrations,
};
