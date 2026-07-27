import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Schema-drift guard for the CMS registry.
//
// `src/content/config.ts` is the source of truth: Astro validates every markdown
// file against its Zod schemas at build time. `src/data/collections.json` is the
// EDITOR's view of those same schemas — it tells @codeyam/cms which inputs to
// render. The two describe the same frontmatter and must not drift.
//
// A key declared only in the registry is the dangerous direction: the CMS happily
// renders an input for it, an editor fills it in, and the build then rejects the
// entry against the Zod schema — a failure that surfaces at deploy time, far from
// the edit that caused it.
//
// The retired Sveltia setup had exactly this guard over its `config.yml`
// (`astro_cms_config_fields_subset_of_content_schema`, documented in the old
// CMS_SETUP.md). That config file was deleted with the Sveltia editor, so this
// re-establishes the same contract for its replacement. Like
// ../components/landing/landing-images.test.ts, it pins a cross-file contract
// rather than a single function.

const REPO_ROOT = path.resolve(__dirname, '../..');

interface RegistryField {
  name: string;
  type: string;
  fields?: RegistryField[];
}

/** The top-level frontmatter keys a registry field list declares. Sub-fields of a
 * `list` are row keys, not frontmatter keys, so they are deliberately excluded. */
function declaredFieldNames(fields: RegistryField[]): string[] {
  return fields.map((f) => f.name);
}

/** Registry-declared keys with no counterpart in the content schema — the drift
 * that would let an editor author a field the build rejects. */
function unknownFields(fields: RegistryField[], schemaKeys: string[]): string[] {
  const known = new Set(schemaKeys);
  return declaredFieldNames(fields).filter((name) => !known.has(name));
}

// Strip `//` line comments so prose colons inside them are never read as schema
// keys. The `[^:]` guard leaves `https://` inside string literals alone.
//
// Block comments are deliberately NOT stripped. Every collection's loader carries
// a recursive markdown glob, and that glob's text contains both a block-comment
// opener and, one loader line later, a closer. A naive block-comment regex
// therefore matches from one loader to the next and eats the entire collection
// schema between them — which is exactly how the built-in collections first came
// back with zero keys. The content config uses only line comments, so stripping
// just those is sufficient and cannot silently delete a collection.
function stripComments(source: string): string {
  return source.replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Top-level keys of one collection's `z.object({...})` in the content config
 * source. Walks brace depth so nested shapes — a `z.array(z.object({...}))` row —
 * contribute none of their own keys. Returns [] for a collection that isn't declared. */
function schemaKeysFor(source: string, collection: string): string[] {
  const src = stripComments(source);
  const declIdx = src.indexOf(`const ${collection} = defineCollection(`);
  if (declIdx === -1) return [];
  const objIdx = src.indexOf('z.object({', declIdx);
  if (objIdx === -1) return [];

  const start = src.indexOf('{', objIdx + 'z.object'.length);
  const keys: string[] = [];
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) break;
    } else if (depth === 1 && /[A-Za-z_$]/.test(ch)) {
      const match = /^([A-Za-z0-9_$]+)\s*:/.exec(src.slice(i));
      if (match) {
        keys.push(match[1]);
        i += match[1].length;
      }
    }
  }
  return keys;
}

const CONFIG_SOURCE = fs.readFileSync(
  path.join(REPO_ROOT, 'src/content/config.ts'),
  'utf-8',
);
const REGISTRY = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'src/data/collections.json'), 'utf-8'),
) as {
  collections: { id: string; fields: RegistryField[] }[];
  builtins?: Record<string, RegistryField[]>;
  seo?: RegistryField[];
};

// A miniature stand-in for the real content config, shaped exactly like it —
// including a nested row object and a comment carrying a colon.
const FIXTURE_CONFIG = `
// A city: one per chapter.
const chapters = defineCollection({
  loader: glob({ pattern: '**/*.md', base: \`\${root}/chapters\` }),
  schema: z.object({
    city: z.string(),
    // tagline: this line is commented out and must not count as a key
    order: z.number().optional(),
    leads: z.array(z.object({ name: z.string(), role: z.string().optional() })).optional(),
  }),
});
`;

describe('declaredFieldNames', () => {
  // The ordinary case: every top-level field contributes its frontmatter key.
  it('returns each top-level field name in declaration order', () => {
    const fields: RegistryField[] = [
      { name: 'city', type: 'text' },
      { name: 'order', type: 'number' },
    ];
    expect(declaredFieldNames(fields)).toEqual(['city', 'order']);
  });

  // A `list`'s sub-fields are row keys inside the array, NOT frontmatter keys, so
  // they must not leak into the comparison against the schema.
  it('excludes the sub-fields of a repeatable list', () => {
    const fields: RegistryField[] = [
      {
        name: 'leads',
        type: 'list',
        fields: [
          { name: 'name', type: 'text' },
          { name: 'role', type: 'text' },
        ],
      },
    ];
    expect(declaredFieldNames(fields)).toEqual(['leads']);
  });

  // Empty input is legitimate — a built-in with no consumer extras declared.
  it('returns an empty list for no fields', () => {
    expect(declaredFieldNames([])).toEqual([]);
  });
});

describe('unknownFields', () => {
  // The healthy state: everything the editor renders exists in the schema.
  it('reports nothing when every declared field exists in the schema', () => {
    const fields: RegistryField[] = [
      { name: 'city', type: 'text' },
      { name: 'order', type: 'number' },
    ];
    expect(unknownFields(fields, ['city', 'order', 'region'])).toEqual([]);
  });

  // The failure this guard exists to catch: a registry key with no schema
  // counterpart, which builds fine until an editor actually fills it in.
  it('names a field that drifted out of the schema', () => {
    const fields: RegistryField[] = [
      { name: 'city', type: 'text' },
      { name: 'subtitle', type: 'text' },
    ];
    expect(unknownFields(fields, ['city'])).toEqual(['subtitle']);
  });

  // Degenerate edge: an empty schema makes every declared field unknown.
  it('treats every field as unknown when the schema has no keys', () => {
    const fields: RegistryField[] = [{ name: 'city', type: 'text' }];
    expect(unknownFields(fields, [])).toEqual(['city']);
  });

  // The other degenerate edge: nothing declared can never drift.
  it('reports nothing when no fields are declared', () => {
    expect(unknownFields([], ['city'])).toEqual([]);
  });
});

describe('schemaKeysFor', () => {
  // Parses the top-level keys and nothing else.
  it('extracts the top-level schema keys of a collection', () => {
    expect(schemaKeysFor(FIXTURE_CONFIG, 'chapters')).toEqual([
      'city',
      'order',
      'leads',
    ]);
  });

  // Nested row keys sit at brace depth 2 and a commented-out key is stripped
  // before parsing — neither may be mistaken for a frontmatter key.
  it('ignores nested row keys and commented-out keys', () => {
    const keys = schemaKeysFor(FIXTURE_CONFIG, 'chapters');
    expect(keys).not.toContain('role');
    expect(keys).not.toContain('tagline');
  });

  // An undeclared collection yields nothing rather than throwing, so a renamed
  // collection fails as a visible empty-schema mismatch below.
  it('returns an empty list for a collection that is not declared', () => {
    expect(schemaKeysFor(FIXTURE_CONFIG, 'podcasts')).toEqual([]);
  });
});

describe('committed CMS registry vs content schema', () => {
  // The headline contract: every field the Chapters editor renders is a real key
  // in the chapters Zod schema. This is the custom collection, so nothing but
  // this test keeps collections.json and config.ts aligned.
  it('declares only real schema keys for the custom chapters collection', () => {
    const chapters = REGISTRY.collections.find((c) => c.id === 'chapters');
    expect(chapters).toBeDefined();

    const schemaKeys = schemaKeysFor(CONFIG_SOURCE, 'chapters');
    expect(schemaKeys.length).toBeGreaterThan(0);
    expect(unknownFields(chapters!.fields, schemaKeys)).toEqual([]);
  });

  // The chapters row shapes must match too: `leads` and `links` write arrays of
  // objects, and a renamed row key silently drops data on save.
  it('declares the chapters list rows the schema expects', () => {
    const chapters = REGISTRY.collections.find((c) => c.id === 'chapters')!;
    const byName = (n: string) => chapters.fields.find((f) => f.name === n);

    expect(declaredFieldNames(byName('leads')!.fields ?? [])).toEqual(['name', 'role']);
    expect(declaredFieldNames(byName('links')!.fields ?? [])).toEqual(['label', 'url']);
  });

  // Consumer extras appended to a built-in are the same drift risk as a custom
  // collection's fields — each must exist in that built-in's schema.
  it('declares only real schema keys for every built-in extra', () => {
    const builtins = REGISTRY.builtins ?? {};
    expect(Object.keys(builtins).length).toBeGreaterThan(0);

    for (const [collection, extras] of Object.entries(builtins)) {
      const schemaKeys = schemaKeysFor(CONFIG_SOURCE, collection);
      expect(schemaKeys.length).toBeGreaterThan(0);
      expect({ collection, unknown: unknownFields(extras, schemaKeys) }).toEqual({
        collection,
        unknown: [],
      });
    }
  });

  // The consumer SEO group replaces the package defaults so the editor writes
  // this site's existing keys. If it drifted back to seoTitle/socialImage the
  // editor would write frontmatter no template reads and no schema allows.
  it('maps the SEO group onto the frontmatter keys this site already uses', () => {
    const seoNames = declaredFieldNames(REGISTRY.seo ?? []);
    expect(seoNames).toEqual(['metaTitle', 'metaDescription', 'ogImage']);

    for (const collection of ['blog', 'pages']) {
      const schemaKeys = schemaKeysFor(CONFIG_SOURCE, collection);
      for (const name of seoNames) {
        expect(schemaKeys).toContain(name);
      }
    }
  });
});
