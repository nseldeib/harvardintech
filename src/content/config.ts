import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
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

// Blog posts. `coverImage`/`summary` are optional so a minimal post renders.
// `metaTitle`/`metaDescription`/`ogImage` are per-page SEO overrides (fall back
// to the post's own fields, then site defaults); `embedUrl`/`embedHtml` drop a
// third-party embed after the post body. All optional — a post without them
// renders unchanged.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${root}/blog` }),
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
  }),
});

// Free-form site pages (About, chapter pages, etc.). `order` sorts them in a
// nav or index; the markdown body is the page content.
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${root}/pages` }),
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
  }),
});

// Team / board members. `photo` and `bio` are optional so a name-and-role-only
// entry still renders; `order` controls display order. `active` toggles whether
// a member appears on the public Board of Directors — an absent `active` means
// shown, so existing entries (and members who never toggled it) stay visible.
const team = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${root}/team` }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    photo: z.string().optional(),
    bio: z.string().optional(),
    order: z.number().optional(),
    active: z.boolean().optional(),
  }),
});

// Upcoming / past events. `link` points at an external registration page;
// `location` and `description` are optional for a bare save-the-date. `chapter`
// is the slug/id of the regional chapter this event belongs to — optional so a
// non-chapter event (e.g. the Cambridge panel) still validates and simply
// appears on no chapter page.
const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${root}/events` }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    location: z.string().optional(),
    description: z.string().optional(),
    link: z.string().optional(),
    chapter: z.string().optional(),
  }),
});

// Regional chapters (NYC, SF, L.A., Japan). One markdown file per city under
// `<contentRoot>/chapters/`, rendered at `/chapters/<slug>` and linked from the
// nav Chapters dropdown. `leads` (named organizers) and `links` (city-specific
// signup / social URLs) are optional so a chapter with no leads still renders;
// the markdown body is the longer "about this chapter" copy.
const chapters = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${root}/chapters` }),
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
  }),
});

export const collections = { blog, pages, team, events, chapters };
