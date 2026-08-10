import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  resolveCollections,
  type CollectionsRegistry,
} from '@codeyam/cms/lib/collectionRegistry';

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
  // The presentation half of a field definition. The drift checks do not need it
  // — they compare names against the Zod schema — but the hero-video case below
  // asserts it directly, because the label an editor reads and the hint telling
  // her the file has to be committed by the team are that field's usability.
  label?: string;
  optional?: boolean;
  hint?: string;
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

/** Schema keys the editor renders no input for — the quiet direction of the same
 * drift. Nothing breaks: the key renders on the site and validates fine, but it
 * is absent from /admin, so an editor has no way to set it and no way to learn
 * it exists. `exempt` names the keys that legitimately have no input. */
function missingFields(
  schemaKeys: string[],
  editorFieldNames: string[],
  exempt: string[] = [],
): string[] {
  const rendered = new Set(editorFieldNames);
  const skip = new Set(exempt);
  return schemaKeys.filter((key) => !rendered.has(key) && !skip.has(key));
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
const REGISTRY_SOURCE = fs.readFileSync(
  path.join(REPO_ROOT, 'src/data/collections.json'),
  'utf-8',
);
const REGISTRY = JSON.parse(REGISTRY_SOURCE) as {
  collections: { id: string; fields: RegistryField[] }[];
  builtins?: Record<string, RegistryField[]>;
  seo?: RegistryField[];
};
// The same file read through the package's own type, so `resolveCollections`
// below sees exactly what the admin sees. Kept separate from `REGISTRY` because
// the local shape above is deliberately looser — it describes only the parts the
// registry-vs-schema comparison needs, and predates this import.
const PACKAGE_REGISTRY = JSON.parse(REGISTRY_SOURCE) as CollectionsRegistry;

// Schema keys that legitimately have no editor input, per collection.
//
// Currently empty, and that is the interesting part: the implicit `draft` toggle
// and the built-ins' core fields all come back from `resolveCollections` as real
// editor inputs, so nothing needs excusing today. Keep it that way — every entry
// added here is a field an editor cannot set from /admin, so an unexplained
// addition is the guard being silenced rather than satisfied.
const EXEMPT_SCHEMA_KEYS: Record<string, string[]> = {};

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

describe('missingFields', () => {
  // The healthy state: every schema key has an input an editor can fill in.
  it('reports nothing when the editor renders an input for every key', () => {
    expect(missingFields(['city', 'order'], ['city', 'order', 'draft'])).toEqual([]);
  });

  // The failure this guard exists to catch: a key that renders on the site but
  // is invisible in /admin, so no editor can ever set it.
  it('names a key that drifted out of the editor', () => {
    expect(missingFields(['city', 'tagline'], ['city'])).toEqual(['tagline']);
  });

  // An exempted key is absent from the editor on purpose and must stay quiet.
  it('ignores an exempted key', () => {
    expect(missingFields(['city', 'draft'], ['city'], ['draft'])).toEqual([]);
  });

  // Degenerate edge: no editor fields at all makes every key missing.
  it('treats every key as missing when the editor renders nothing', () => {
    expect(missingFields(['city'], [])).toEqual(['city']);
  });

  // The other degenerate edge: an empty schema can never be missing anything.
  it('reports nothing when the schema has no keys', () => {
    expect(missingFields([], ['city'])).toEqual([]);
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
  // The headline contract: every field a custom collection's editor renders is a
  // real key in that collection's Zod schema. Nothing but this test keeps
  // collections.json and config.ts aligned, and a field declared here but absent
  // from the schema fails the whole BUILD the moment an editor saves a value
  // into it — so the failure lands on a deploy rather than on the person who
  // added the field.
  //
  // Deliberately a loop over EVERY custom collection rather than a case for
  // `chapters` alone. It was chapters-only when chapters was the only custom
  // collection; the registry now carries a dozen, and one hand-written case
  // means each new one ships unguarded unless whoever adds it also remembers to
  // add a case — which is exactly the kind of remembering this file exists to
  // make unnecessary.
  it('declares only real schema keys for every custom collection', () => {
    expect(REGISTRY.collections.length).toBeGreaterThan(0);

    for (const collection of REGISTRY.collections) {
      const schemaKeys = schemaKeysFor(CONFIG_SOURCE, collection.id);

      // A collection the editor renders but `config.ts` never declares would
      // pass the unknown-field check vacuously — every field is "unknown", so
      // the empty-diff assertion below would be comparing against nothing.
      expect({ collection: collection.id, declaredInSchema: schemaKeys.length > 0 }).toEqual({
        collection: collection.id,
        declaredInSchema: true,
      });

      expect({ collection: collection.id, unknown: unknownFields(collection.fields, schemaKeys) }).toEqual({
        collection: collection.id,
        unknown: [],
      });
    }
  });

  // The chapters row shapes must match too: `leads` and `links` write arrays of
  // objects, and a renamed row key silently drops data on save.
  it('declares the chapters list rows the schema expects', () => {
    const chapters = REGISTRY.collections.find((c) => c.id === 'chapters')!;
    const byName = (n: string) => chapters.fields.find((f) => f.name === n);

    expect(declaredFieldNames(byName('leads')!.fields ?? [])).toEqual(['name', 'role']);
    expect(declaredFieldNames(byName('links')!.fields ?? [])).toEqual(['label', 'url']);
  });

  // The hero video field's SHAPE, which the drift guard above cannot see: that
  // check proves `heroVideo` exists in both the registry and the schema, but a
  // field of the wrong type would satisfy it and still be unusable.
  //
  // `text` is the load-bearing part. The obvious choice is the `image` type used
  // by `heroImage` beside it, and it would be wrong: the media library uploader
  // is images-only (`accept="image/*"`), so an image-typed field renders a picker
  // that can never list a video — an editor would be handed a control that looks
  // right and cannot work. A plain box she pastes a path into is the honest
  // control for a file only the team can add.
  //
  // Optional matters too: this is the only hero field that is genuinely absent in
  // production, and a required one would block saving the entry at all.
  //
  // The hint is asserted because it is the only place an editor is told the file
  // has to be committed by the team, that the video is silent and looping, and
  // that the photo is its fallback. The field is unusable without it.
  it('declares the hero video as an optional text field with guidance', () => {
    const pageCopy = REGISTRY.collections.find((c) => c.id === 'pageCopy')!;
    const heroVideo = pageCopy.fields.find((f) => f.name === 'heroVideo');

    expect(heroVideo).toBeDefined();
    expect({ type: heroVideo!.type, optional: heroVideo!.optional }).toEqual({
      type: 'text',
      optional: true,
    });
    expect(heroVideo!.label).toBe('Hero video');
    expect(heroVideo!.hint ?? '').not.toBe('');
  });

  // It has to sit with the hero, not at the end of the form. The fields are
  // rendered in declaration order, and a video control separated from the photo
  // it falls back to reads as unrelated to it.
  it('places the hero video directly after the hero image', () => {
    const pageCopy = REGISTRY.collections.find((c) => c.id === 'pageCopy')!;
    const names = pageCopy.fields.map((f) => f.name);

    expect(names.indexOf('heroVideo')).toBe(names.indexOf('heroImage') + 1);
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

  // The other direction, and the one nothing guarded before: a key in the Zod
  // schema that the editor renders no input for. It costs no build error — the
  // key just never appears in /admin, so an editor cannot set it and cannot
  // learn it exists. Resolving the field list through the package's own
  // `resolveCollections` (rather than restating CONTENT_FIELDS here) means a
  // package upgrade that adds or moves a built-in field cannot leave this test
  // asserting a stale picture of the editor.
  it('renders an editor input for every schema key of every collection', () => {
    const resolved = resolveCollections(PACKAGE_REGISTRY);
    expect(resolved.length).toBeGreaterThan(0);

    for (const collection of resolved) {
      const schemaKeys = schemaKeysFor(CONFIG_SOURCE, collection.id);
      expect({ collection: collection.id, declared: schemaKeys.length > 0 }).toEqual({
        collection: collection.id,
        declared: true,
      });

      const editorFieldNames = collection.fields.map((f) => f.name);
      const exempt = EXEMPT_SCHEMA_KEYS[collection.id] ?? [];
      expect({ collection: collection.id, missing: missingFields(schemaKeys, editorFieldNames, exempt) }).toEqual({
        collection: collection.id,
        missing: [],
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
