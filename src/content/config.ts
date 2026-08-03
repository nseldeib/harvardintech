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
    // "HARVARD IN TECH <CITY>" title. `showGallery` toggles the shared event
    // photo gallery; absent → shown (the live site shows it on every chapter),
    // set `false` to opt out. All optional → a chapter without them falls back
    // to the centered header.
    heroImage: z.string().optional(),
    tagline: z.string().optional(),
    showGallery: z.boolean().optional(),
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
};
