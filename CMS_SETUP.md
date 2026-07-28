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

- **`collections`** — the custom **`chapters`** collection, whose ten fields
  mirror the `chapters` schema in `config.ts`, including the numeric `order` and
  the two repeatable lists (`leads`, `links`).
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
build.

## Navigation

The header menu is edited in **Settings** under `/admin` — every group there
(Programs, Communities, Content Hub, Membership) is yours to rename, reorder,
and relink.

**Chapters is the exception: it is generated from the chapters collection.**
Publish a chapter and it appears in the menu automatically; draft or delete one
and it leaves. There is nothing to add by hand, and no second step to forget —
which is the point, since a hand-listed copy could only drift from the real
chapter list and leave the menu pointing at pages that no longer exist. The
crimson strip at the very top of every page lists those same chapters, so it
tracks the collection too.

Menu order follows each chapter's `order` field, exactly as the "Our chapters"
section on the homepage orders its cards, and each menu label is the chapter's
own `city`.

The one consequence: **the Chapters group cannot be renamed or reordered from
the admin UI.** It is always inserted directly after Programs.

## Media

`public/images/` is the media library. The existing images were adopted by
directory scan — there was no import step and no manifest to author, and new
uploads land in the same tree.

## Editing without the CMS

You can always skip the CMS and edit content directly:

1. Create or edit a `.md` file under `src/content/blog/`.
2. Give it frontmatter matching `src/content/config.ts` (`title`, `date`,
   optional `summary`, optional `coverImage`).
3. Run `npm run dev`; the post appears on the index automatically.
