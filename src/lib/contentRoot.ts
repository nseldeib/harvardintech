// Resolve where the app reads its content/data from. Normally this is the
// committed production source (`src/content`, `src/data`). During a codeyam
// session the app is pointed at a *sandbox* copy under
// `.codeyam/tmp/content-sandbox/` (via the `CODEYAM_CONTENT_ROOT` /
// `CODEYAM_DATA_ROOT` env vars set by `astro.config.mjs` in dev) so that
// seeding a scenario never writes to — or deletes — the committed markdown the
// site ships. A production `astro build` sets neither var, so it reads
// `src/content` / `src/data` unchanged. See `astro.config.mjs` and
// `.codeyam/seed-adapter.ts` for the two writers that agree on this convention.
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Directory the content collections (`blog`, `team`, …) are loaded from. */
export function contentRoot(): string {
  return process.env.CODEYAM_CONTENT_ROOT ?? 'src/content';
}

/** Directory the JSON singletons (`settings`, `nav`) are loaded from. */
export function dataRoot(): string {
  return process.env.CODEYAM_DATA_ROOT ?? 'src/data';
}

/**
 * Read and JSON-parse one singleton data file from the resolved `dataRoot()`.
 *
 * Lives here rather than in `site.ts` because the sandbox redirect is the whole
 * reason it cannot be a bare `readFileSync('src/data/…')`, and that redirect is
 * this module's subject. `site.ts` had a private copy and `cutoverProgress.ts`
 * grew a second identical one — two implementations of "respect the sandbox" is
 * exactly how one of them ends up not respecting it.
 *
 * Server-only: it reads the filesystem, so this module must never be reached
 * from a client island. Every current importer is `.astro` frontmatter or a
 * server lib; the runbook's React islands take only `import type` from the
 * modules that use it, which erases at compile time.
 */
export function readSingleton<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(dataRoot(), name), 'utf-8')) as T;
}
