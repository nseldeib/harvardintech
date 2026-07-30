# Harvard in Tech — Review Handoff (for Nicole)

Internal reference for the external review. All three surfaces share one
passphrase — it's a deterrent to keep the preview out of casual/public view, not
hard security. Keep the links + password internal.

## Links + password

| Surface | Link | Password |
|---|---|---|
| **Website** | https://review.harvardintech.com/ | `crimson2026` |
| **CMS / admin dashboard** | https://review.harvardintech.com/admin | `crimson2026` |
| **Todos / project status** | https://review.harvardintech.com/review | `crimson2026` |

> These point at the **review site**, which is where in-flight work lives —
> including draft entries that are not on the live site. Edits made here do not
> change harvardintech.com until someone promotes them (Actions → *Promote review
> → live*). See [DEPLOY_SETUP.md](../DEPLOY_SETUP.md) if the review site is not
> reachable yet — it needs a one-time repo + DNS setup.

- **Reviewing only:** the passphrase is all that's needed — view the site, the
  todos page, and the CMS dashboard.
- **Editing content:** only editing requires a GitHub token. From `/admin`, open
  the editor and choose "Sign in with Token." Share the token **privately** (a
  password manager, not chat/email) — never paste it into this file.

## Ready-to-send note

> Hi Nicole — here's the Harvard in Tech site preview to review. All three links
> use the same password: **crimson2026**
>
> • **Website:** https://review.harvardintech.com/
> • **Content editor (CMS):** https://review.harvardintech.com/admin
> • **What's done / what's open (todos):** https://review.harvardintech.com/review
>
> The "todos" page walks through what's built and the decisions we need from you.
> Please keep the links + password internal for now. (I'll send you an editor
> access token separately if you'd like to make edits directly.)

## Editor access for Nicole (no GitHub account needed)

Sveltia commits through a GitHub token, but the **token is the credential** — no
GitHub login of her own is required.

1. You (with repo write access) generate a **fine-grained token**: Repository
   access → only `nseldeib/harvardintech`; Repository permissions → **Contents:
   Read and write** (Metadata: Read is auto-added and required). Give it a short
   expiry.
2. Share that token with Nicole privately; she pastes it into "Sign in with
   Token" at `/admin/editor/`.
3. **Revoke** the token from GitHub after the review (Settings → Developer
   settings → Fine-grained tokens). Use a separate token per person so you can
   revoke one without affecting the other.

Her edits will commit under the token owner's GitHub identity (not her name) —
fine for a review.

## Still open (team todos, not code)

- Real **board bios** (the live site has none to reproduce).
- A **donation-platform URL** (the Donate button currently opens an email).
- **Chapter + event content** for the 5 cities.
