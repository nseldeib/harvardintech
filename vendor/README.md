# vendor/ — temporary, delete me

## What this is

`codeyam-cms-0.2.1.tgz` is `@codeyam/cms` 0.2.1, packed from
[`codeyam-ai/codeyam-cms`](https://github.com/codeyam-ai/codeyam-cms) `main` at
commit `9be24b3`. `package.json` installs it with a `file:` dependency instead of
from npm.

## Why

0.2.1 is **merged but not yet published to npm** — the registry's latest is
0.2.0. We need it now because this site deploys to a GitHub Pages *project site*
(`/harvardintech`), and 0.2.0 has no base-path support: `/admin` loads but every
link inside it 404s, and stored media URLs render unprefixed so CMS thumbnails
and previews break. The fixes are
[PR #1](https://github.com/codeyam-ai/codeyam-cms/pull/1) and
[PR #2](https://github.com/codeyam-ai/codeyam-cms/pull/2).

Vendoring unblocks the review deadline without waiting on a publish we don't
control.

## How to remove it (do this once 0.2.1 is on npm)

```bash
npm pkg set dependencies.@codeyam/cms="^0.2.1"
npm install
git rm -r vendor
```

Then confirm `npm ci` still resolves 0.2.1 and rebuild — the admin links should
stay `/harvardintech/`-prefixed. `npm view @codeyam/cms version` tells you
whether it has landed yet.
