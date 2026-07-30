/**
 * CodeYam Seed Adapter for Astro content collections.
 *
 * For static sites whose "data" is a set of typed markdown files under
 * `src/content/<collection>/` rather than a runtime database. Each scenario
 * seeds a *set of content files*: this adapter clears every managed collection
 * directory and rewrites it from the seed payload, one markdown file per entry
 * (frontmatter from the entry's scalar fields, body from its `body`/`content`).
 *
 * Usage: npx tsx .codeyam/seed-adapter.ts <path-to-seed-data.json>
 *
 * Canonical wire shape (`SeedInput` in `crates/types/src/seed_input.rs`):
 * {
 *   "seed": {
 *     "blog": [
 *       { "slug": "hello", "title": "Hello", "date": "2026-01-01", "body": "# Hi" },
 *       ...
 *     ]
 *   }
 * }
 *
 * The legacy flat shape (`{ "blog": [...] }`) is also accepted.
 *
 * Each *array-valued* collection key maps to a directory under the content root
 * (read from `.codeyam/stack.json` → `data.contentDir`, default `src/content`).
 * For each entry, the file name is `<slug>.md` (falling back to `<id>` or a
 * positional index), the `body`/`content` field becomes the markdown body, and
 * every other scalar/array field becomes YAML frontmatter.
 *
 * An *object-valued* key is a **singleton**: site-wide editable data (the
 * `settings` / `nav` "file" collections the CMS edits) written verbatim as
 * `<dataDir>/<key>.json` (data root from `.codeyam/stack.json` →
 * `data.dataDir`, default `src/data`). This lets a scenario seed "site with 3
 * socials and a chapters dropdown" vs "minimal nav" without touching markup.
 *
 * Per-collection success emits a structured stderr log line so the editor's
 * row-count banner has a number to show:
 *   [codeyam-seed] inserted <N> rows into <collection>
 *
 * Unlike the database adapters this mutates the filesystem directly, so the
 * stdout payload is an informational summary rather than something the editor
 * injects.
 *
 * Export mode is not supported — the source of truth is the markdown on disk.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// codeyam-adapter-version: 5
//
// v5: scenario seeds write into a *sandbox* copy of the content/data under
// `.codeyam/tmp/content-sandbox/` instead of the committed production source.
// Before each seed the sandbox is re-initialised from production (so unseeded
// collections show real content and no scenario leaks into the next), then the
// seeded collections are cleared + rewritten inside the sandbox. `src/content`
// and `src/data` are never modified. The Astro app reads the sandbox in dev via
// `CODEYAM_CONTENT_ROOT`/`CODEYAM_DATA_ROOT` (see `astro.config.mjs`); both
// sides agree on the `.codeyam/tmp/content-sandbox` convention.

/**
 * Load `.env*` files into `process.env` in canonical precedence order:
 *
 *   .env.local > .env.development.local > .env.development > .env
 *
 * Later wins. Missing files are skipped. Pre-set `process.env` keys are never
 * overwritten. Inlined per adapter because adapters are copied verbatim into
 * `.codeyam/seed-adapter.ts` and run standalone.
 */
export function loadDotEnvFiles(cwd: string = process.cwd()): void {
  const preExisting = new Set(Object.keys(process.env));
  const filesInOrder = ['.env', '.env.development', '.env.development.local', '.env.local'];

  let scriptDir: string | null = null;
  try {
    scriptDir = path.dirname(fileURLToPath(import.meta.url));
  } catch {
    // import.meta.url unavailable — fall back to the explicit cwd.
  }
  const roots = Array.from(
    new Set(
      [cwd, scriptDir ? path.resolve(scriptDir, '..') : null, scriptDir].filter(
        (r): r is string => typeof r === 'string' && r.length > 0,
      ),
    ),
  );

  const seenFiles = new Set<string>();
  for (const name of filesInOrder) {
    for (const root of roots) {
      const filePath = path.join(root, name);
      if (seenFiles.has(filePath)) continue;
      seenFiles.add(filePath);
      let content: string;
      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!preExisting.has(key)) {
          process.env[key] = value;
        }
      }
    }
  }
}

/** Resolve the content root from stack.json, defaulting to `src/content`. */
export function resolveContentDir(projectRoot: string): string {
  const stackPath = path.join(projectRoot, '.codeyam', 'stack.json');
  try {
    const stack = JSON.parse(fs.readFileSync(stackPath, 'utf-8'));
    const dir = stack?.data?.contentDir;
    if (typeof dir === 'string' && dir.length > 0) return dir;
  } catch {
    // No stack.json (or unreadable) — fall back to the convention.
  }
  return 'src/content';
}

/** Resolve the singleton data root from stack.json, defaulting to `src/data`. */
export function resolveDataDir(projectRoot: string): string {
  const stackPath = path.join(projectRoot, '.codeyam', 'stack.json');
  try {
    const stack = JSON.parse(fs.readFileSync(stackPath, 'utf-8'));
    const dir = stack?.data?.dataDir;
    if (typeof dir === 'string' && dir.length > 0) return dir;
  } catch {
    // No stack.json (or unreadable) — fall back to the convention.
  }
  return 'src/data';
}

/** Sandbox convention shared with `astro.config.mjs`: scenario seeds land here,
 * never in the committed `src/content`/`src/data`. Relative to the project root. */
const SANDBOX_REL = path.join('.codeyam', 'tmp', 'content-sandbox');

/** Absolute sandbox content/data roots for a project. */
export function resolveSandboxDirs(projectRoot: string): {
  sandboxContent: string;
  sandboxData: string;
} {
  return {
    sandboxContent: path.join(projectRoot, SANDBOX_REL, 'content'),
    sandboxData: path.join(projectRoot, SANDBOX_REL, 'data'),
  };
}

/**
 * Re-initialise the sandbox from the committed production content/data: wipe the
 * sandbox dirs and copy `prodContent`→sandbox/content, `prodData`→sandbox/data.
 * Run before every seed so each scenario starts from real production state
 * (collections it doesn't seed render production; nothing leaks scenario→scenario)
 * and so the seed only ever writes inside `.codeyam/tmp/`.
 */
export function resetSandboxFromProduction(
  projectRoot: string,
  prodContent: string,
  prodData: string,
): { sandboxContent: string; sandboxData: string } {
  const { sandboxContent, sandboxData } = resolveSandboxDirs(projectRoot);
  for (const [src, dest] of [
    [prodContent, sandboxContent],
    [prodData, sandboxData],
  ]) {
    fs.rmSync(dest, { recursive: true, force: true });
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.mkdirSync(dest, { recursive: true });
    }
  }
  return { sandboxContent, sandboxData };
}

/**
 * Serialize a frontmatter value as YAML.
 *
 * Handles the three shapes a content-collection schema actually uses: scalars, a
 * list of scalars, and a list of OBJECTS — the last one being how `leads` and
 * `links` are declared on the chapters and communities collections. Without the
 * object branch every row serialized through `String(v)` to the literal text
 * `[object Object]`, which parses as a string and fails Zod validation with
 * `Expected type "object", received "array"` — a seeded scenario that renders an
 * Astro error page instead of the component.
 *
 * Nested objects are emitted as a block map under the `- ` bullet, indented to
 * `indent`, so the row keys survive the round-trip.
 */
function yamlValue(value: unknown, indent = '  '): string {
  if (Array.isArray(value)) {
    return `\n${value.map((v) => `${indent}- ${yamlItem(v, indent)}`).join('\n')}`;
  }
  return ` ${yamlScalar(value)}`;
}

/** One list item: a block map for an object row, a scalar otherwise. */
function yamlItem(value: unknown, indent: string): string {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const rowIndent = `${indent}  `;
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v], i) => `${i === 0 ? '' : rowIndent}${k}:${yamlValue(v, `${rowIndent}  `)}`)
      .join('\n');
  }
  return yamlScalar(value);
}

function yamlScalar(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const s = String(value);
  // Quote when the string could be misread as YAML (colons, leading specials).
  if (/[:#]|^[-?>|&*!%@`"']/.test(s) || s !== s.trim()) {
    return JSON.stringify(s);
  }
  return s;
}

/**
 * Pure transform: turn one collection entry into a `{ fileName, contents }`
 * markdown file. The `body`/`content` field becomes the markdown body; every
 * other field becomes frontmatter. The file name comes from `slug`, then `id`,
 * then the positional `index`.
 */
export function entryToFile(
  entry: Record<string, unknown>,
  index: number,
): { fileName: string; contents: string } {
  const { body, content, slug, id, ...rest } = entry;
  const markdownBody = typeof body === 'string' ? body : typeof content === 'string' ? content : '';
  const stem = String(slug ?? id ?? `entry-${index + 1}`).replace(/[^a-z0-9-_]+/gi, '-');

  const frontmatterKeys = Object.keys(rest);
  const frontmatter =
    frontmatterKeys.length > 0
      ? `---\n${frontmatterKeys.map((k) => `${k}:${yamlValue(rest[k])}`).join('\n')}\n---\n\n`
      : '';

  return { fileName: `${stem}.md`, contents: `${frontmatter}${markdownBody}\n` };
}

/** Remove every `.md`/`.mdx` file in a collection directory, then recreate it. */
function clearCollectionDir(dir: string): void {
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      if (/\.mdx?$/.test(name)) fs.rmSync(path.join(dir, name));
    }
  } else {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write one singleton object to `<dataRoot>/<name>.json`, replacing any prior
 * file. Singletons are site-wide editable data (settings, nav) the CMS edits as
 * "file" collections; the loader (`src/lib/site.ts`) imports them directly.
 */
function writeSingleton(dataRoot: string, name: string, value: Record<string, unknown>): void {
  fs.mkdirSync(dataRoot, { recursive: true });
  fs.writeFileSync(path.join(dataRoot, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Write a whole seed to disk, returning per-key written counts. Array-valued
 * keys are folder collections (one markdown file per entry, directory cleared
 * first so a scenario fully replaces prior content); object-valued keys are
 * singletons written as `<dataRoot>/<key>.json` (count 1). `dataRoot` defaults
 * to the `data` sibling of `contentRoot` (`src/data` for `src/content`).
 */
export function writeSeed(
  contentRoot: string,
  seed: Record<string, unknown>,
  dataRoot: string = path.resolve(contentRoot, '..', 'data'),
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(seed)) {
    if (key === '_auth') continue;
    if (Array.isArray(value)) {
      const dir = path.join(contentRoot, key);
      clearCollectionDir(dir);
      value.forEach((raw, index) => {
        const entry = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
        const { fileName, contents } = entryToFile(entry, index);
        fs.writeFileSync(path.join(dir, fileName), contents);
      });
      counts[key] = value.length;
    } else if (value && typeof value === 'object') {
      writeSingleton(dataRoot, key, value as Record<string, unknown>);
      counts[key] = 1;
    }
    // Primitive values (string/number/bool) are not seedable shapes — skip.
  }
  return counts;
}

export function main() {
  loadDotEnvFiles();
  const seedDataPath = process.argv[2];
  if (!seedDataPath) {
    console.error('Usage: npx tsx .codeyam/seed-adapter.ts <seed-data.json>');
    process.exit(1);
  }

  const raw = fs.readFileSync(seedDataPath, 'utf-8');
  const data = JSON.parse(raw);
  // Canonical envelope unwrap: collections live under `seed`. Fall through to
  // the flat shape for back-compat with hand-written adapters.
  const seed: Record<string, unknown> =
    data && typeof data === 'object' && data.seed && typeof data.seed === 'object'
      ? data.seed
      : data;

  // The adapter is deployed at `.codeyam/seed-adapter.ts`, so the project root
  // is its parent directory; fall back to cwd when run from elsewhere.
  let projectRoot = process.cwd();
  try {
    projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  } catch {
    // import.meta.url unavailable — keep cwd.
  }
  // Production source (committed) — read-only here, used as the copy source.
  const prodContent = path.join(projectRoot, resolveContentDir(projectRoot));
  const prodData = path.join(projectRoot, resolveDataDir(projectRoot));

  // Seed writes go to a sandbox copy, never to the committed source. Reset the
  // sandbox from production first so unseeded collections render real content
  // and scenarios don't leak into one another.
  const { sandboxContent: contentRoot, sandboxData: dataRoot } =
    resetSandboxFromProduction(projectRoot, prodContent, prodData);

  const expectedKeys = Object.keys(seed).filter((k) => k !== '_auth');
  const expectedRows = expectedKeys.reduce((sum, k) => {
    const v = seed[k];
    return sum + (Array.isArray(v) ? v.length : 0);
  }, 0);

  const counts = writeSeed(contentRoot, seed, dataRoot);

  console.log(JSON.stringify({ contentCollection: counts }, null, 2));

  let actualRows = 0;
  for (const [collection, n] of Object.entries(counts)) {
    console.error(`[codeyam-seed] inserted ${n} rows into ${collection}`);
    actualRows += n;
  }

  if (expectedRows > 0 && actualRows === 0) {
    console.error(
      `[codeyam-seed] FATAL: input declared ${expectedRows} content entries ` +
        `but adapter wrote 0. Likely a contract mismatch. Inspect the ` +
        `snapshot at .codeyam/tmp/seed-input-snapshot-*.json to see what ` +
        `the editor sent.`,
    );
    process.exit(1);
  }
}

// Only run main() when invoked directly (not when imported by tests). The
// deployed file is `.codeyam/seed-adapter.ts`, so match the deployed basename.
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  /seed-adapter\.(ts|js|cjs|mjs)$/.test(process.argv[1]);

if (invokedDirectly) {
  if (process.argv[2] === '--export') {
    console.error('Export mode is not supported for the content-collection adapter.');
    console.error('The source of truth is the markdown on disk.');
    process.exit(1);
  } else {
    main();
  }
}
