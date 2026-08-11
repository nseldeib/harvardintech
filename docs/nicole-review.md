# Harvard Alumni in Tech — Review Handoff (for Nicole)

Internal reference for the external review. Keep the links and the password
internal.

Nothing here is public. `harvardintech.com` is still served by Strikingly and is
untouched by any of this — the preview below is a separate, password-protected
site that only people with the link and passphrase can see. It stays that way
until the Strikingly migration.

## Links + password

| Surface | Link | Password |
|---|---|---|
| **Website** | https://nseldeib.github.io/harvardintech/ | `crimson2026` |
| **Todos / project status** | https://nseldeib.github.io/harvardintech/review | `crimson2026` |
| **Supporter recognition review** | https://nseldeib.github.io/harvardintech/donor-network.html | `crimson2026` |
| **Domain cutover runbook** | https://nseldeib.github.io/harvardintech/cutover-runbook/ | `crimson2026` |
| **CMS / admin dashboard** | https://nseldeib.github.io/harvardintech/admin | *(GitHub token — see below)* |

The trailing slash on the runbook link matters — it is a directory route, and
without it the link 404s.

The site, the todos page and the runbook share one passphrase. It is a
**deterrent, not authentication** — it ships in the client bundle — so it keeps
the preview out of search results and away from casual visitors, and that is
all. Every page also carries `noindex`.

The runbook is additionally **never built for the public site**: it is excluded
from the public track in code rather than merely gated, so it cannot appear on
`harvardintech.com` even by a configuration mistake at cutover. That matters
because it names where the domain's records live.

The **CMS is not behind the passphrase.** It is behind a GitHub token sign-in
instead, and the dashboard is `noindex, nofollow`. Treat its URL as
semi-private: the sign-in overlay hides the content visually, but the underlying
HTML is fetchable by anyone who has the address.

## Ready-to-send note

> Hi Nicole — here's the Harvard Alumni in Tech site preview to review. Everything
> except the content editor uses the password **crimson2026**:
>
> • **Website:** https://nseldeib.github.io/harvardintech/
> • **What's done / what's open (todos):** https://nseldeib.github.io/harvardintech/review
> • **Supporter recognition:** https://nseldeib.github.io/harvardintech/donor-network.html
> • **Moving the domain over:** https://nseldeib.github.io/harvardintech/cutover-runbook/
> • **Content editor (CMS):** https://nseldeib.github.io/harvardintech/admin
>
> The todos page walks through what's built and the decisions we need from you.
>
> The domain link is the one with something we need back from you. The site is
> finished — moving harvardintech.com onto it is just a handful of settings at
> the registrar, and that page lays out every step in the order it has to happen,
> including how we keep your email working throughout. Nothing has been done yet;
> it's written so the move can be reviewed before it's run.
>
> Five questions on that page are yours rather than ours, and the first one
> blocks all the others: **who has the GoDaddy login?** We've never had access,
> and until that's answered nothing can start — not even the first step, which
> only reads the current settings and changes nothing. Each question has what
> we'd suggest, so there's something to react to rather than a blank page.
>
> The supporter recognition link is the one I'd most like your reaction to. It
> shows the donor wall as it's built today, then nine directions for replacing
> it, then what actually happens when the bi-weekly spreadsheet meets either —
> which turns out to be the interesting problem. Nothing on that page records
> anything; at the bottom there's an outline to paste into a doc. Everything is
> numbered (W1–W5, 01–09, I1–I4, Q1–Q4) so a one-line reaction lands exactly
> where you meant it.
>
> Please keep the links and password internal for now. The editor needs a
> separate access token, which I'll send you privately if you'd like to make
> edits directly.
>
> One thing if you do edit: after you save, the site takes a minute or two to
> rebuild before your change shows up. The editor will tell you when it's live.
>
> (The real harvardintech.com is unchanged — this is a private preview.)

## Editor access (no GitHub account needed)

The CMS commits through a GitHub token, and **the token is the credential** —
Nicole does not need a GitHub login of her own.

### Generating the token

1. Go to GitHub → **Settings** → **Developer settings** → **Personal access
   tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Repository access** → *Only select repositories* → `nseldeib/harvardintech`.
3. **Repository permissions** → **Contents: Read and write**. That is the only
   one to set; *Metadata: Read* is added automatically and is required.
4. **Expiration** → short. The review does not need 90 days.
5. Generate, copy the value, and share it **privately** — a password manager,
   not chat or email. Never paste it into this file.

Those permissions are exactly what the dashboard uses: it reads and writes
repository contents via `api.github.com/repos/.../contents/...`, and calls
`api.github.com/user` once to show who is signed in. Nothing else.

### Using it

She opens the CMS link, chooses **Sign in with Token**, and pastes the value.
It is stored in her browser's local storage, so she signs in once per browser.

### Reusing an older token

Functionally yes — the permissions are identical to the ones the previous
editor setup used, so a token that is still valid will work. Two caveats:

- Check whether it still exists at **Settings → Developer settings →
  Fine-grained tokens**. The earlier round of this doc said to revoke it after
  the review and to keep the expiry short, so it has most likely lapsed.
- Even a valid one must be **pasted in again**. This is a different editor from
  the one used before, and it stores the token under its own key, so nothing
  carries over from the old sign-in.

Issuing a fresh token per person is the better habit anyway: it lets you revoke
one person's access without disturbing anyone else's.

### Afterwards

**Revoke the token** at Settings → Developer settings → Fine-grained tokens.

## What she can edit herself

[editing-the-site.md](./editing-the-site.md) is written for her, not for us — send
it alongside the links. It answers the two questions from her review directly:
how to edit the Momentum Fund page (its middle is now a **Momentum Fund sections**
collection in the CMS) and how to move sections up or down (the **Order** field;
lower appears higher). It also names what is still code-only — the hero, the
closing CTA, the card figures, and the GA id — so those come to us rather than
sending her hunting through /admin for a screen that does not exist.

## What happens when she edits

Her edits commit to the `staging` branch of `nseldeib/harvardintech` (configured
in `src/data/cms.json`). That triggers a rebuild, and the **staging** site
updates a minute or two later. Her change reaches the **reviewed** link when
someone runs **Actions → Promote review → live**.

There is no path by which an edit reaches the real harvardintech.com — that only
happens at the Strikingly migration, deliberately. The promote step exists now
rather than later on purpose: at the cutover `main` becomes the public site, so a
CMS pointed at `main` would publish every save straight to the world.

Her commits are attributed to the token owner's GitHub identity, not her name.
That is expected for a review.

## Answering her two reports (volunteer project)

Both of the things she flagged on the volunteer project she created — "uploaded
photo not visible" and "thumbnail appears but does not link to full description"
— reproduced, and both were our bugs, not mistakes she made.

### "Thumbnail does not link to the full description"

Correct, and there was nowhere for it to link *to*. The long description she
wrote lives in the markdown body of her entry, and **nothing in the site rendered
a project's body anywhere** — the grid card only ever showed title, commitment,
and blurb. Her description was on the site but invisible.

Each project now has its own page at `/volunteer/projects/<slug>`. The card's
thumbnail and title link to it, and there is a "Read the full description →"
link in the card footer. Projects still marked **Draft** get a page on this
preview but not on the public site, so she can read hers before it goes live.

If a project has no sign-up link of its own, its page falls back to the general
"Volunteer with us" CTA — a project posted before its form exists still gives a
reader somewhere to go.

### "Uploaded photo not visible"

Her photo genuinely did not make it. The CMS records an upload in two places —
the image file itself, and a library entry in `src/data/media.json` — and it
published the library entries **without the image files**. Her publish recorded
three uploads and committed one file, so two of them pointed at files that were
never there. Her project ended up with no photo set at all.

Two things changed:

- The orphaned library entries were removed, so the media picker no longer
  offers photos that do not exist.
- **The CMS now refuses to publish** an upload whose image data went missing,
  and names the files instead of committing a broken image. She will see an
  error asking her to re-upload rather than a silently broken photo.

**Her project still has no photo — she should pick one herself.** In /admin →
**Projects** → her entry → the **Image** field, either choose an existing library
image or upload a new one. Uploading is now safe to retry: if the upload does not
survive, publishing will tell her instead of failing quietly.

One thing worth knowing: an upload has to be **published from the media library**
before it appears on the site. Selecting a file stages it; it is not live until
the publish commits.

The underlying upload bug was in the `@codeyam/cms` package, not this site. The
guard shipped here as a local patch at first; it is now **fixed upstream and
released in `@codeyam/cms` 0.4.0**, which this site depends on, so the patch has
been deleted. Every site using the package gets the fix, not just this one.

`src/lib/mediaCommitGuard.test.ts` stays as a check on that dependency: if a
future release reworks or drops the guard, it fails in CI rather than at an
editor's next upload. That matters because the bug is invisible at publish time
— the CMS truthfully says the upload succeeded — so nothing else would catch it.

## Still open (team todos, not code)

- Real **board bios** — **2 of the 5 are now written** (Ben Wei and Nadia
  Eldeib); three are still blank. *Optional, and not a launch blocker* — a
  member without one renders as photo + name + role, which is exactly what
  harvardintech.com shows today. Add the rest in /admin whenever they are
  written, one at a time if that is easier; a half-filled board is a supported
  state, not a broken one.
- A **donation-platform URL** (the Donate button currently opens an email).
- **Chapter + event content** for the 6 chapters (Boston/Cambridge, DC-DMV,
  London, NYC, Seattle, SF Bay Area). 8 events and 11 blog posts are in.

## Two sites, and which one to send

There are now two gated sites. **Only the first is for Nicole:**

| | URL | What it is |
|---|---|---|
| **Reviewed** | `nseldeib.github.io/harvardintech` | The link above. Moves only when someone promotes, so it never changes under her mid-review. |
| **Staging** | `nseldeib.github.io/harvardintech-staging` | Ours. Takes every commit. Not for sharing. |

Neither is public — `harvardintech.com` is still Strikingly's.

When a change is ready for her, go to **Actions → Promote review → live → Run
workflow**. That merges `staging` into `main` and her link catches up a minute or
two later.

Her CMS edits commit to `staging`, so they ride the same promote as our code
changes rather than landing on the reviewed link behind it. Promotes should
fast-forward cleanly; if one opens a PR instead, someone committed to `main`
directly — review and merge that PR, or rebase `staging` on `main` and re-run.

## Known rough edges

- The **production split is not set up yet** — both sites are gated and neither
  is public. That is the domain cutover, not this; see
  [DEPLOY_SETUP.md](../DEPLOY_SETUP.md).
