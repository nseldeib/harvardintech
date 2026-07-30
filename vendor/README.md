# vendor/ — temporary, delete me

## What this is

`codeyam-cms-0.2.2.tgz` is `@codeyam/cms` 0.2.2, packed from
[`codeyam-ai/codeyam-cms`](https://github.com/codeyam-ai/codeyam-cms) `main` at
commit `c37f3f9`. `package.json` installs it with a `file:` dependency instead of
from npm.

## Why

0.2.2 is **merged but not yet published to npm** — the registry's latest is
0.2.0. Three fixes in it are load-bearing for this site, which deploys to a
GitHub Pages *project site* (`/harvardintech`) published by Actions:

- [PR #1](https://github.com/codeyam-ai/codeyam-cms/pull/1) — base-path support
  for admin links. Without it `/admin` loads but every link inside it 404s.
- [PR #2](https://github.com/codeyam-ai/codeyam-cms/pull/2) — the same for stored
  media URLs, so CMS thumbnails and previews aren't broken images.
- [PR #3](https://github.com/codeyam-ai/codeyam-cms/pull/3) — deploy tracking on
  Actions-published Pages. Without it the publish stepper hangs at `queued`
  until it times out, even though the deploy succeeded.

0.2.1 was never published, so 0.2.2 supersedes it entirely.

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
