---
title: "Disable The Astro Dev Toolbar In The Live Preview"
mode: backend
createdAt: "2026-08-07T02:55:20Z"
source: manual
---

## Summary

Disable the Astro dev toolbar so the Live Preview stops throwing
`TypeError: Cannot read properties of undefined (reading 'send')` on every page
load.

One line in `astro.config.mjs` plus the reasoning behind it. Nothing about the
built site changes — `output: 'static'` ships none of the toolbar.

## The failure

The reported stack bottoms out in Vite's own client:

```js
send(data) {
  ws.send(JSON.stringify(data));   // ws is undefined
}
```

Two conditions combine, and neither is in this repo's code:

1. **The HMR socket cannot connect through the fleet proxy.** Served over HTTPS
   on the default port, Vite's client derives its socket host as
   `` `${hostname}:${''}` `` — not a reachable URL — so `ws` is never assigned.
2. **Vite does not guard `send()`.** It guards teardown with `ws?.close()` but
   leaves `send()` as a bare `ws.send(...)`, so any caller before a successful
   connect hits an undefined socket.

The caller is the Astro dev toolbar, which fires on load. Confirmed
empirically rather than inferred: `dev-toolbar` appears in the served HTML
without the fix and is absent with it.

## Key Decisions

- **Remove the caller rather than chase the socket.** The toolbar is a dev-only
  overlay this project never uses; the Live Preview is driven through explicit
  editor commands. Disabling it costs nothing and stops the throw at its source.

- **Do NOT port the sibling project's `hmr: { clientPort: 443, protocol: 'wss' }`
  setting.** `codeyam-cms` hit this identical error and its config carries both
  the toolbar fix and an HMR override — but its own comment records why the
  override is double-edged: the headless capture harness loads the SAME dev
  server from `http://localhost:<port>`, where that config makes the client
  derive `wss://localhost:443` and nothing is listening. The failed connect
  throws a console error and fails every scenario capture. Captures here work
  today, so the override would trade a harmless console message for a broken
  capture suite. The cost of leaving it out is that hot-reload still will not
  fire in the preview tab, which the workflow does not rely on.

- **Backend mode.** This changes dev-server behaviour only. The static build is
  byte-identical, no component renders differently, and no scenario frame moves.

## Implementation

`astro.config.mjs` — add `devToolbar: { enabled: false }` to the config object,
with a comment recording the Vite rough edge, why the socket cannot connect
here, and that the built site is unaffected. A future reader who deletes the
line should be able to see what comes back.

## Verification

Already performed while diagnosing, and to be re-confirmed:

- `dev-toolbar` absent from served HTML with the fix, present without it.
- `astro check` — 0 errors.
- `verify-build` passes.
- `client-errors` clean.
- `/admin/siteIntegrations/site` — the route the dev-server log showed
  re-fetching every ~2s — captures successfully.

## Out of scope

- Vite's unguarded `send()`. Worth reporting upstream to Vite; not this change.
- Making hot reload actually work through the fleet tunnel.
- Anything touching `@codeyam/cms`, the runbook, or the domain migration.