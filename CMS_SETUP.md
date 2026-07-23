# Content Management Setup

This site stores content as typed markdown in `src/content/`. A friendly,
browser-based editing UI — **Sveltia CMS**, a modern Decap-compatible editor —
is wired in at **`/admin/editor/`**, fronted by a lightweight CRM dashboard at
**`/admin`** (live content counts + sign-in guidance). The editor commits
markdown straight to your content collections, so editors never touch code and
the static-hosting model is unchanged: GitHub Pages still serves plain HTML, and
codeyam can still seed the same files per scenario through the
`content-collection` seed adapter.

## The admin app

- `src/pages/admin/index.astro` renders the CRM **dashboard** at `/admin` — a
  build-time summary of every editable collection (counts read from the same
  `src/content/*` the public site uses) with an "Open content editor" button.
- `public/admin/editor/index.html` loads Sveltia from its CDN and auto-mounts at
  `/admin/editor/` (Astro serves `public/` verbatim — works live and locally).
- `public/admin/editor/config.yml` is the Decap/Sveltia config. Its `collections`
  block mirrors `src/content/config.ts`; see **Keeping the schema honest** below.
  The `backend:` block points at the plain GitHub backend with
  `auth_methods: [token]`, so the live login screen shows a single **"Sign in
  with Token"** button and nothing extra to deploy.

## Choosing an editing path

| Path | Editors need | Extra service | Best for |
| --- | --- | --- | --- |
| **Token (hosted)** | a GitHub account with repo write + a fine-grained PAT | none | editors working on the live site |
| **Local** | the repo cloned locally | none | yourself / quick edits |

### 1. Hosted editing with a GitHub token

Sveltia ships a built-in **"Sign in with Token"** flow that needs no relay and no
service: editors paste a fine-grained GitHub Personal Access Token, Sveltia
stores it in their browser, and commits go straight to the repo. Because
`auth_methods: [token]` is set in `config.yml`, the login screen shows only that
one button (no unwired "Sign in with GitHub").

**Pre-flight:** a GitHub account with write access to
`nseldeib/harvardintech`.

1. On GitHub, go to **Settings → Developer settings → Fine-grained tokens →
   Generate new token**. Set **Repository access → Only select repositories →
   nseldeib/harvardintech** and **Repository permissions → Contents → Read
   and write** (the single permission the CMS needs). Choose an expiry, generate,
   and copy the token.
2. Open `/admin/editor/` on the live site (linked from the `/admin` dashboard),
   click **"Sign in with Token"**, and paste the token.
3. Edit content; your changes commit straight to `src/content/` under your own
   GitHub identity and the site redeploys. The token lives in your browser only
   (local storage) — each editor uses their own, and you revoke or rotate it from
   GitHub's token settings when its expiry approaches.

> **Want OAuth instead?** "Sign in with Token" is the zero-infrastructure path.
> To offer a one-click "Sign in with GitHub" button later, stand up an OAuth
> relay (Sveltia's hosted helper or a self-hosted `sveltia/sveltia-cms-auth`
> Worker), add `base_url`/`auth_endpoint` to the `backend:` block, and add
> `oauth` to `auth_methods` (e.g. `auth_methods: [token, oauth]`).

### 2. Local

Always available, no auth, no server.

**Pre-flight:** the repo cloned locally.

1. `local_backend: true` is already set in `public/admin/editor/config.yml`.
2. Run `npm run dev`, open `/admin/editor/` (or click "Open content editor" from
   the `/admin` dashboard), and choose **"Work with Local Repository"**.
3. Edit posts; Sveltia writes straight to `src/content/`. Commit and push
   yourself — the change goes live on the next GitHub Pages deploy.

## Dashboard gate

The `/admin` dashboard is fronted by a lightweight **client-side passcode gate**
(`src/components/admin/AdminGate.astro`, logic in `src/lib/adminGate.ts`). On the
live site, first visit prompts for a passcode; a correct value unlocks the
dashboard for the rest of the browser session (`sessionStorage`), and
cancel/incorrect redirects to the public home.

- **Set the passcode** with the build-time env var `ADMIN_GATE_PASSCODE` (e.g. a
  CI/Pages build secret). When unset, a clearly-named non-secret fallback keeps
  the build from breaking.
- **The gate runs only in production builds.** On a local dev server / the
  codeyam preview the dashboard is left open — the same "local is trusted"
  stance as `local_backend: true` — so editing and previewing stay frictionless.
- **It is a deterrent, not server-enforced security.** On static GitHub Pages the
  passcode ships inside the public HTML, so anyone reading source can find it. It
  only keeps casual visitors out of the dashboard. The real write-access boundary
  is each editor's GitHub token (Contents: Read & Write), entered via "Sign in
  with Token" — without a valid token no commit can land.

## Keeping the schema honest

`public/admin/editor/config.yml` and `src/content/config.ts` describe the **same**
markdown files and must stay in sync: every field `name` in a collection must
exist in the matching Astro schema (the reserved `body` field is the markdown
body, not frontmatter, so it has no schema counterpart). codeyam's template test
`astro_cms_config_fields_subset_of_content_schema` enforces this for the shipped
template. When you add a content field, add it in **both** files.

## Editing without the CMS

You can always skip the CMS and edit content directly:

1. Create or edit a `.md` file under `src/content/blog/`.
2. Give it frontmatter matching `src/content/config.ts` (`title`, `date`,
   optional `summary`, optional `coverImage`).
3. Run `npm run dev`; the post appears on the index automatically.
