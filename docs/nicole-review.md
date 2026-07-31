# Harvard in Tech — Review Handoff (for Nicole)

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
| **CMS / admin dashboard** | https://nseldeib.github.io/harvardintech/admin | *(GitHub token — see below)* |

The site and the todos page share one passphrase. It is a **deterrent, not
authentication** — it ships in the client bundle — so it keeps the preview out of
search results and away from casual visitors, and that is all. Every page also
carries `noindex`.

The **CMS is not behind the passphrase.** It is behind a GitHub token sign-in
instead, and the dashboard is `noindex, nofollow`. Treat its URL as
semi-private: the sign-in overlay hides the content visually, but the underlying
HTML is fetchable by anyone who has the address.

## Ready-to-send note

> Hi Nicole — here's the Harvard in Tech site preview to review. The site and
> the todos page use the password **crimson2026**:
>
> • **Website:** https://nseldeib.github.io/harvardintech/
> • **What's done / what's open (todos):** https://nseldeib.github.io/harvardintech/review
> • **Content editor (CMS):** https://nseldeib.github.io/harvardintech/admin
>
> The todos page walks through what's built and the decisions we need from you.
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

Her edits commit to the `main` branch of `nseldeib/harvardintech` (configured in
`src/data/cms.json`). That triggers a rebuild, and the password-protected
preview updates a minute or two later. There is no separate publish step right
now, and no path by which an edit reaches the real harvardintech.com — that only
happens at the Strikingly migration, deliberately.

Her commits are attributed to the token owner's GitHub identity, not her name.
That is expected for a review.

## Still open (team todos, not code)

- Real **board bios** (the live site has none to reproduce).
- A **donation-platform URL** (the Donate button currently opens an email).
- **Chapter + event content** for the 5 cities.

## Known rough edges

- The **staging → production split is not set up yet.** There is one site today.
  The machinery for two tracks exists in the repo but is dormant; see
  [DEPLOY_SETUP.md](../DEPLOY_SETUP.md).
