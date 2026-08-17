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
`/admin` route from `astro.config.mjs`, which adds the integration **only on the
review track and in `astro dev`**:

```js
const integrations = [react()];
if (isDev || isReviewTrack) integrations.unshift(codeyamCms());
```

`/admin` is deliberately absent from the public build. The admin pages embed each
entry's raw markdown in their static HTML and the sign-in gate is client-side
only, so wherever `/admin` is deployed, every draft's full source is publicly
fetchable. Keeping it on the gated review origin is what makes draft-phasing
mean anything.

### The patch on top of the package

`patches/@codeyam+cms+0.7.1.patch` is applied by `patch-package` from
`postinstall`, so it lands on every install including CI. It is still true that
no admin code is hand-written here — the patch edits the dependency, it does not
add admin pages to this repo. It carries **two** things:

- **Reorder arrows on ordered collection lists.** Any collection declaring a
  numeric `order` field — 13 of them today, including Momentum Fund sections and
  home sections — renders as one ordered sequence with ↑ / ↓ arrows on each row
  instead of a Drafts-then-Published split, and a move stages ordinary pending
  changes that ride the normal publish review. The draft state moves onto the row
  as a chip, since those lists no longer have a "Drafts" heading to carry it.

- **Duplicate on every entry row.** An anchor to the ordinary create form with
  `?from=<slug>`, which prefills the form from the source entry so the copy is
  renamed BEFORE it exists rather than as a second edit afterwards. It is a link
  rather than a staged action, so opening it and changing your mind leaves
  nothing to undo. Preview rows are the one exclusion — copying one would mint a
  second unlisted clone of the same target. On the static build the prefill is
  resolved from a `sources` map shipped with the page, since there is no server
  to answer the query at request time.

**The publish deploy watch used to be the second half, and 0.5.0 released it.**
That is the lifecycle described below running to completion for the second time:
the upstream base now ships `deployWatch.ts`, `deployWatchStore.ts` and
`DeployChip.tsx`, so the patch dropped them and `deployWatch.test.ts` /
`deployStage.test.ts` / `deployMarker.test.ts` went from guarding a patch to
holding the released dependency to its contract. The patch shrank from 1,859
lines to ~530 in the process.

The arrows did NOT land upstream in 0.5.0, so they were **re-derived** against
its sources rather than replayed onto them — 0.5.0 rewrote `EntryRow` to add
preview actions (334 diff lines) and gave `entryList` a third group. Two
decisions in that rebase are worth knowing, because a future one has to make
them again: the ordered sequence is built from listed entries only, so a preview
clone never gets an `order` written onto it; and the Preview links group renders
above the sequence in an ordered collection exactly as it does elsewhere.

**Neither half landed upstream in 0.7.1 either, so the same re-derivation ran a
third time** (0.5.0 → 0.7.1). All nine files the patch edits had moved. The one
decision worth recording: 0.7.1 threads a `blockScalars` argument through
`entryActions`' `serialize`, and every upstream builder now passes it.
`buildOrderChange` predates that signature, so replaying the old hunk verbatim
would have compiled and shipped a real bug — reordering a section whose body
fields are YAML block scalars would reformat every one of them alongside the
single `order:` line, and a reorder is the one action an editor performs many
times in a row, so they would have met that diff noise once per click. It now
passes `blockScalars` like its siblings. This is the concrete argument for
re-deriving rather than replaying: a replayed patch fails loudly only when the
surrounding lines move, and silently when a signature grows.

**The remaining half is still meant to be temporary.** The lifecycle, which this
repo has now run twice — the media guard in `@codeyam+cms+0.2.2.patch` (deleted
by `abc5872` once 0.4.0 shipped it) and the deploy watch above — is: file the
change upstream against `codeyam-ai/codeyam-cms`, and delete the patch on the
release that carries it.

**Pin the dependency EXACTLY** (`"@codeyam/cms": "0.7.1"`, no caret). `npm
install @codeyam/cms@x` rewrites it to `^x` on its own, and a caret is what makes
the filename-matching failure below happen silently on a patch release nobody ran
deliberately.

The risk that makes writing this down worth it: `patch-package` matches a patch
to a version **by filename**, so the next `@codeyam/cms` bump silently drops
whatever this patch still holds. Nothing would fail — the arrows would just stop
being on the page, and the first person to notice would be an editor trying to
reorder the donate page. `src/lib/cmsOrderControls.test.ts` exists to make that a
CI failure instead, and it survives the patch being deleted: once the change is
released upstream it stops guarding a patch and starts holding the dependency to
its contract, which is when it matters most, because by then nobody is thinking
about this feature.

Two committed JSON files configure it:

- **`src/data/cms.json`** — which repo commits land in (`nseldeib/harvardintech`,
  branch **`staging`** — see *Where edits land* below) and which sign-in methods
  are offered (`auth.token: true`, `auth.worker: false` — token only, no service
  to deploy).
- **`src/data/collections.json`** — the editor's view of this site's content
  schema. See **How collections.json relates to src/content/config.ts** below.

### `settings.siteUrl` points at STAGING, on purpose

`src/data/settings.json` carries `siteUrl:
https://nseldeib.github.io/harvardintech-staging` — the working site, not the
reviewed one the team bookmarks. That looks wrong at a glance and is not.

Nothing the site RENDERS reads this field. Canonical URLs, Open Graph tags,
`sitemap.xml` and `robots.txt` all come from Astro's own `site`, which the deploy
workflow sets per track. `settings.siteUrl` is consumed only by the CMS, to build
the links it hands an editor: **View on site**, the social-card preview, and the
URL a **Preview link** row tells you to copy.

Every one of those links has to point where the commit actually LANDS. The CMS
commits to `staging` (`cms.json`), so a preview clone materialises on the staging
site — and only there, until someone promotes. Pointing this field at the
reviewed site would hand an editor a URL that 404s for as long as it takes
somebody to notice, which is exactly what it did before this was corrected.

**The two URLs are answering different questions and are meant to differ:**

| Field | Value | Answers |
|---|---|---|
| `cms.json` → `siteUrl` | `…/harvardintech-staging` | Which site's `deploy-status.json` the publish watch reads |
| `settings.json` → `siteUrl` | `…/harvardintech-staging` | Which site the editor's links point at |

They agree today because both describe where `staging` deploys. **At the
Strikingly cutover they still should** — the CMS keeps committing to the review
track, so both keep naming whatever that track's origin becomes
(`review.harvardintech.com`), NOT the public domain.

**This field is editable from the CMS** (Settings → Public URL), so an editor can
change it without touching the repo. If preview links ever start pointing at the
reviewed site again, that is the first place to look.

## Preview links: sharing a draft before it goes live

**Preview link** on any entry row clones that entry to
`src/content/<collection>/preview-<token>.md`, which the site's own per-entry
route builds into a real page at an unguessable URL. Hand that URL to a reviewer
and they read the page in the real layout with no GitHub account, no CMS access,
and no passphrase. The link goes live at the next publish, like any other edit.

Five collections have a per-entry route and therefore support it: **pages, blog,
chapters, communities, volunteer projects**. A collection that renders as a
section of someone else's page (`stats`, `pillars`, `heroSlides`) has nowhere for
a link to point, so it has no Preview link action. Adding a route is what would
make one eligible — not adding the fields.

### What holds it together

Four pieces, each load-bearing in a way that fails quietly if dropped:

- **`...previewFields` in the five schemas** (`src/content/config.ts`). Zod strips
  unknown keys, so without it `previewOf` never reaches `entry.data` and every
  filter below sees an ordinary page — an unlisted draft rendered as a live one.
- **`routableEntries` in those five `getStaticPaths`** (`src/lib/drafts.ts`).
  Listings keep `publishedEntries`, which excludes previews; routes use
  `routableEntries`, which adds them back. Build without list. Use
  `publishedEntries` in a `getStaticPaths` and every preview link 404s.
- **`noindex` from `SEO.astro`.** It used to come from `PreviewGate`, but that is
  off on the public track, so a preview merged to `main` would be indexable.
- **`sitemap({ filter: (page) => !isPreviewUrl(page) })`** in `astro.config.mjs`.
  `sitemap.xml` is public; a preview left in it publishes the token, and unlike
  an indexed page no `noindex` walks that back.

### Password-protected previews

A preview link can carry a password, and on a static site that can only honestly
mean **the content is encrypted at rest** — a prompt that merely compares a
password ships the content in the document it guards. The dashboard encrypts the
title and body in the editor's browser (AES-GCM, PBKDF2-SHA-256) and commits only
ciphertext.

**A locked entry needs render-side handling, and this is the part the package
README does not spell out.** Its stored body is base64, so a route that renders
it as markdown shows the reader a wall of ciphertext — which is what this site
did on the first attempt. All five routes therefore branch on `isLocked(entry)`
and render `src/components/LockedPreviewBody.astro` in place of the article; that
wrapper mounts the package's public unlock island, which swaps itself for the
decrypted content.

**The password is stored nowhere** — not in the repo, not in `localStorage`, not
in the dashboard. Lose it and the only way forward is a new preview. And
**rotating a password does not erase the old ciphertext from git history**: if
one leaks, treat the content it protected as leaked.

### Two unrelated things called a "preview gate"

`src/components/PreviewGate.astro` is the review site's `crimson2026` passphrase
overlay. The package's `PreviewGate` is the per-page decryption prompt above.
They are not variations on one idea — the passphrase is a deterrent that ships in
the client bundle, while the other cannot be bypassed because the bytes are
genuinely encrypted.

**Preview URLs are exempt from the passphrase** (`gateAppliesTo` in
`src/lib/previewGate.ts`). Gating them would mean sending a reviewer the link and
the site passphrase together, handing them the whole unreleased site to read one
page. The URL is the access mechanism instead — the same trade this repo already
made for `public/design-review-4ece6c14/`. It is a real trade: anyone forwarded
the link can read the page, which is what password protection is for.

### The shareable list link

`/admin/previews` gathers every preview page in one place, and from there an
editor can mint one `/previews/<token>` URL serving that whole list as a public
page. It stays current on its own — a preview created later appears without
re-sharing anything. The token lives in `src/data/settings.json` as
`previewIndexToken`; **rotating it is the revoke**, and it takes effect on the
next deploy. No token means the page is not emitted at all.

Unguessable is not secret. The token is committed, so anyone with repo read
access can find it, and anyone holding the URL can read every preview listed on
it. What it buys is "not linked, not indexed, not enumerable".

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
2. Open `/admin` on the **reviewed site**
   (`https://nseldeib.github.io/harvardintech/admin` — enter the site passphrase
   first) and paste the token into the sign-in prompt. `/admin` is never served on
   a public build by design, so after the migration this address moves to the
   gated review origin rather than to harvardintech.com.
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
3. Commit and push to `staging` yourself — the change appears on the review site
   on the next deploy, and goes live when you promote.

## Staging, review, and commit

The CMS does not commit on every keystroke. Edits accumulate as **pending
changes** — an edited entry, a settings change, a new image — and the **Publish**
tab shows everything staged, lets you review each diff, and then lands the whole
batch as a **single GitHub commit**. That keeps history readable and makes a
multi-part edit (say, a new chapter plus its hero image plus a nav entry) land
atomically.

## Where edits land

**Today, nothing an editor does can reach the public.** `harvardintech.com` is
still served by Strikingly and is untouched by this repo, so every site here is a
private preview.

CMS commits go to the branch named in `src/data/cms.json` — **`staging`**, which
builds the **staging site** at `nseldeib.github.io/harvardintech-staging`. An edit
appears there a minute or two after you publish, and reaches the **reviewed site**
at `nseldeib.github.io/harvardintech` when someone runs **Promote review → live**.

That extra step is deliberate, and it matters most *after* the migration: at the
cutover `main` becomes harvardintech.com, so a CMS that committed to `main` would
publish every save straight to the public site with no review. Pointing it at
`staging` means the promote button is the only thing that reaches the world —
before the cutover and after it.

> **Both sites serve `/admin`, and it does not matter which one you use.** The CMS
> commits to whatever `cms.json` names, so an edit made from either admin lands on
> `staging` either way.

Two independent things phase a change, and it helps to keep them straight:

| | What it phases | How you use it |
| --- | --- | --- |
| **Draft toggle** (per entry) | *content* | Leave Draft **on** while an entry is half-written. Drafts appear on the gated sites and never on a public build — so a draft is safe to publish. |
| **`staging` branch** (whole site) | *code* | Code changes land here first. The reviewed link does not move until someone promotes. |

**Promoting staging → reviewed.** Go to the repo's **Actions** tab → **Promote
review → live** → **Run workflow**. That merges `staging` into `main`. It is a
button, not a git exercise, and it is deliberately manual.

If the promote workflow reports it could not fast-forward, `main` has changes
`staging` does not. Content edits no longer cause this — they commit to `staging`
now — so it means someone committed to `main` directly. It opens a pull request
instead of guessing; review and merge that PR, or rebase `staging` on `main` and
re-run.

**After the Strikingly migration** the roles change: `main` becomes the public
harvardintech.com, `staging` becomes the gated review origin, and promoting then
means publishing to the world. See [DEPLOY_SETUP.md](./DEPLOY_SETUP.md).

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
  **`sponsors`** backs the wall on `/sponsor`: `tier` holds the id of a level
  declared in the Sponsorship page settings, and the **Example entry** toggle
  (`placeholder`) marks an illustrative row — the wall then renders an explicit
  "examples, not actual sponsors" notice and refuses to link those entries, which
  is what lets sample rows ship without claiming partnerships that do not exist.
  Switch it off for a real sponsor.
  **`momentumSections`** is the reorderable middle of the `/donate` campaign
  page. Its `kind` and `layout` are `text` fields with hints rather than enums
  because `CUSTOM_FIELD_TYPES` has no select control; `src/lib/momentumSections.ts`
  validates at build instead, so an unknown `kind` drops that one section with a
  `console.warn` and an unknown `layout` falls back to `text-only` — a typo costs
  an editor one section, never the deploy. Editor-facing instructions for the
  collection live in [docs/editing-the-site.md](docs/editing-the-site.md).
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
