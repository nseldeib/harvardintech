# Content Management Setup

This site stores content as typed markdown in `src/content/` plus two JSON
singletons in `src/data/`. Editing happens in **[@codeyam/cms][pkg]**, an Astro
integration that owns the whole **`/admin`** area: a content dashboard, an entry
editor, a media library, site settings, an editors list, and a publish flow that
batches your edits into one GitHub commit.

The static-hosting model is unchanged: GitHub Pages still serves plain HTML, and
codeyam still seeds the same files per scenario through the `content-collection`
seed adapter.

[pkg]: https://www.npmjs.com/package/@codeyam/cms

## The admin app

There is no hand-written admin code in this repo. The package injects every
`/admin` route from `astro.config.mjs`:

```js
integrations: [codeyamCms(), react(), sitemap()],
```

Two committed JSON files configure it:

- **`src/data/cms.json`** — which repo commits land in (`nseldeib/harvardintech`,
  branch `main`) and which sign-in methods are offered (`auth.token: true`,
  `auth.worker: false` — token only, no service to deploy).
- **`src/data/collections.json`** — the editor's view of this site's content
  schema. See **How collections.json relates to src/content/config.ts** below.

## Choosing an editing path

| Path | Editors need | Extra service | Best for |
| --- | --- | --- | --- |
| **Token (hosted)** | a GitHub account with repo write + a fine-grained PAT | none | editors working on the live site |
| **Local** | the repo cloned locally | none | yourself / quick edits |

### 1. Hosted editing with a GitHub token

Editors paste a fine-grained GitHub Personal Access Token once; the browser holds
it and commits go straight to the repo under **that editor's own GitHub
identity**. Nothing to deploy, no shared secret.

**Pre-flight:** a GitHub account with write access to `nseldeib/harvardintech`.

1. On GitHub, go to **Settings → Developer settings → Fine-grained tokens →
   Generate new token**. Set **Repository access → Only select repositories →
   nseldeib/harvardintech** and **Repository permissions → Contents → Read and
   write** (the single permission the CMS needs). Choose an expiry, generate, and
   copy the token.
2. Open `/admin` on the live site and paste the token into the sign-in prompt.
3. Edit content. The token lives in that browser only — each editor uses their
   own, and you revoke or rotate it from GitHub's token settings.

Because every editor signs in as themselves, commit history attributes each
change to a person, and removing someone's access is a per-person revoke rather
than rotating a shared passcode everyone has to be re-told.

> **Want a one-click "Sign in with GitHub" button?** The package ships an
> optional `cms-auth-worker` for magic-link invites. It needs a Cloudflare Worker
> standing up, and it attributes commits to the worker rather than the person, so
> this site deliberately stays on token-only sign-in.

### 2. Local

Always available, no auth, no server.

**Pre-flight:** the repo cloned locally.

1. Run `npm run dev` and open `/admin`.
2. Edit content; writes go to the local working tree.
3. Commit and push yourself — the change goes live on the next GitHub Pages
   deploy.

## Staging, review, and commit

The CMS does not commit on every keystroke. Edits accumulate as **pending
changes** — an edited entry, a settings change, a new image — and the **Publish**
tab shows everything staged, lets you review each diff, and then lands the whole
batch as a **single GitHub commit**. That keeps history readable and makes a
multi-part edit (say, a new chapter plus its hero image plus a nav entry) land
atomically.

Pushing to `main` triggers the Pages deploy workflow, so a published batch is
live a minute or two later.

## How `collections.json` relates to `src/content/config.ts`

`src/content/config.ts` remains the **single source of truth** — it is the Zod
schema Astro validates every markdown file against at build time. It is not
generated and should be edited normally.

`src/data/collections.json` is the **editor's** view of that schema: it tells the
CMS which form controls to render. The package already knows the four built-in
collections (`pages`, `blog`, `events`, `team`), so this file only declares what
is site-specific:

- **`collections`** — the custom **`chapters`** and **`communities`**
  collections, whose fields mirror the matching schemas in `config.ts`, including
  the numeric `order` and the two repeatable lists (`leads`, `links`).
  `communities` is deliberately the chapter shape with `name` in place of `city`:
  a community (Founders, AI) is defined by an interest rather than a location, but
  everything else about the page is the same, so both render through the same
  components and an editor who has filled in one form already knows the other.
- **`builtins`** — extra fields appended to a built-in's editor: `embedUrl` /
  `embedHtml` on `pages` and `blog`, `chapter` on `events`, `active` on `team`.
- **`seo`** — this site's SEO frontmatter keys. The package defaults to
  `seoTitle` / `seoDescription` / `socialImage`; this site's content already uses
  `metaTitle` / `metaDescription` / `ogImage`, so declaring the group here points
  the editor at the existing keys and no content file or template has to change.

**When you add a content field, add it in both files** — the Zod schema so the
build accepts it, and `collections.json` so editors get an input for it. A field
present only in `config.ts` still renders on the site but is invisible in the
CMS; a field present only in `collections.json` will fail schema validation on
build. Both directions are pinned by `src/data/collections.test.ts`, so a field
added to only one file fails the test suite rather than being discovered later —
by a build error at deploy time, or by an editor who never finds the field at
all.

**Tagging an event to a chapter or community.** The `chapter` field on an event
is a plain text box today, and its value must be a **slug** — the chapter's or
community's filename without `.md` (`nyc`, `boston-cambridge`, `dc-dmv`,
`london`, `seattle`, `sf-bay-area`, `founders`, `ai`) — not its display name.
One field carries both on purpose: a community owns events exactly the way a
chapter does, so there is no second box to choose between. The match is exact, so
`New York City`, `London` with a capital, or a stray trailing space all leave the
event off its page while the entry still saves, the build still succeeds, and
`/events` still lists it. A tag matching neither list is named in a `[chapters]`
warning in the build log (visible in the Actions run and in `npm run dev`); it is
a warning, not an error, so a typo never blocks a deploy. Leave `chapter` blank
for an event that belongs to no single chapter or community. A picker will
replace the text box once the CMS supports reference fields.

## Navigation

The header menu is edited in **Settings** under `/admin` — every group there
(Programs, Communities, Content Hub, Membership) is yours to rename, reorder,
and relink.

**Two parts of the menu are generated from content instead.** Publish a chapter
or a community and it appears automatically; draft or delete one and it leaves.
There is nothing to add by hand and no second step to forget — which is the
point, since a hand-listed copy could only drift from the real list and leave the
menu pointing at pages that no longer exist.

- **Chapters** is a group the layout owns outright. It is always inserted
  directly after Programs, and the crimson strip at the very top of every page
  lists those same chapters, so it tracks the collection too. The one
  consequence: **the Chapters group cannot be renamed or reordered from the
  admin UI.**
- **Communities** is a group *you* own that generated items join. The
  hand-authored links you keep there (WhatsApp) stay exactly where you put them,
  and each published community is appended after them. So this group behaves
  normally in Settings — rename it, reorder its authored links — and still picks
  up new communities on its own.

Menu order is **alphabetical**: by `city` for chapters, by `name` for
communities, matching how the "Our chapters" section on the homepage orders its
cards. Each label is the entry's own display name. The `order` field is an
optional **pin** — leave it blank (the default, and what every entry ships with)
and the entry sorts alphabetically, so adding a chapter never means renumbering
the others; set it only to force one entry to the front.

## Media

`public/images/` is the media library. The existing images were adopted by
directory scan — there was no import step to run — and new uploads land in the
same tree. Since 0.2.0 the uploader offers a destination folder, so an upload
can go straight into `gallery/`, `team/` and so on rather than the images root.

What the library KNOWS about each image lives in a manifest, `src/data/media.json`.
Disk decides which images exist; the manifest decides what is recorded about
them — alt text above all, plus dimensions, size and upload date. It is edited
through the media library like any other content and commits in the same batch.
An image with no record is still selectable; it just carries nothing but its
path and size.

**Alt text written there reaches the rendered page.** The event gallery, the
chapter cards and the board headshots all read their alt from the manifest, so
describing a photo in `/admin` changes what a screen reader announces on the
public site. Each of those render sites keeps its previous value as a fallback,
so an image with no record — or a newly uploaded one nobody has described yet —
never ends up worse off than before.

**An empty alt is a deliberate "this image is decorative".** It is not the same
as leaving alt blank-because-nobody-got-to-it: an empty string in the manifest
wins over the render site's fallback, which is how a backdrop photo or a social
glyph sitting beside a visible label stays silent to a screen reader instead of
being announced twice. Records with no `alt` key at all are the "not yet
decided" case, and those do fall through to the fallback.

One caveat worth knowing: the Publish Checklist's "missing image alt text" check
treats an explicit `""` the same as no alt, so a deliberately decorative image
can still show up there. That check reads body images and cover/social
frontmatter on the entries you are publishing — it does not walk the whole
library — so in practice it rarely fires on these. Empty alt is written for the
rendered page and for the next person reading the manifest, not to silence it.

## Editing without the CMS

You can always skip the CMS and edit content directly:

1. Create or edit a `.md` file under `src/content/blog/`.
2. Give it frontmatter matching `src/content/config.ts` (`title`, `date`,
   optional `summary`, optional `coverImage`).
3. Run `npm run dev`; the post appears on the index automatically.
