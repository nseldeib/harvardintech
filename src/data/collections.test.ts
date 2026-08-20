import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  resolveCollections,
  type CollectionsRegistry,
} from '@codeyam/cms/lib/collectionRegistry';
import {
  declaredFieldNames,
  missingFields,
  schemaKeysFor,
  singletonKeysWithoutEditor,
  unknownFields,
  type RegistryField,
} from '../lib/collectionRegistryDrift';

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

// `declaredFieldNames`, `unknownFields`, `missingFields`, `stripComments` and
// `schemaKeysFor` were defined here until a second guard — the singleton check
// at the bottom of this file — needed them too. They now live in
// `src/lib/collectionRegistryDrift.ts`, unit-tested there against hand-built
// inputs; this file keeps the assertions that read the REAL committed files.

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

// MOVED: the unit cases for the five helpers above — declaredFieldNames,
// unknownFields, missingFields, stripComments, schemaKeysFor — now live beside
// the functions themselves in `src/lib/collectionRegistryDrift.test.ts`, against
// the same hand-built fixture. They are deliberately NOT duplicated here: two
// copies of one rule's tests is how the copies stop agreeing. What stays below
// is the part only this file can do — the assertions that read the real
// committed `config.ts`, `collections.json`, and `*Page.json`.
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

// The THIRD drift direction, and the one nothing guarded until the Momentum
// Network shipped its whole copy surface — heading, tagline, search label, share
// message — reachable only by editing `donatePage.json` by hand.
//
// The suite above compares COLLECTIONS to SCHEMAS. It is thorough in both
// directions and it structurally cannot see this: a singleton is not a
// collection. `src/lib/site.ts` reads these three files through `readSingleton`,
// and `src/lib/pageCopyMerge.ts` merges a CMS entry OVER them, so the JSON is the
// fallback and the collection is the override. A key present in the fallback but
// absent from the registry therefore renders on the live site and appears in no
// editor anywhere — no build error, no failing test, just copy nobody but a
// developer can change.
describe('committed page singletons vs CMS registry', () => {
  // Each singleton paired with the collection whose editor is supposed to cover
  // it, plus the keys that legitimately have no input.
  //
  // RETIRED is not a convenience list. Every entry asserts that no visitor can
  // see the key, so each one carries the reason it is dead — and an entry added
  // without one is this guard being silenced rather than satisfied.
  const SINGLETONS: {
    file: string;
    collection: string;
    retired: string[];
  }[] = [
    {
      file: 'donatePage.json',
      collection: 'pageCopy',
      retired: [
        // Band headings. Each is the FALLBACK behind its section's own Heading
        // field — `sectionHeading(section, copy.xTitle)` in MomentumFundPage —
        // so an editor renames the band from the section entry in
        // `momentumSections`, and a second box here would be a competing one.
        'accomplishmentsTitle',
        'pillarsTitle',
        'testimonialsTitle',
        'donorsTitle',
        // The donor wall's intro paragraph. The wall itself is no longer mounted
        // on `/donate` — the Momentum Network replaced it — so this reaches only
        // the wall's isolated-component scenarios. A box editing something no
        // visitor can see would be worse than its absence. Retire it with the
        // wall, not before.
        'donorsIntro',
      ],
    },
    { file: 'volunteerPage.json', collection: 'volunteerPage', retired: [] },
    {
      file: 'sponsorPage.json',
      collection: 'sponsorPage',
      retired: [
        // Moved out to the `sponsorLevels` collection, which is where an editor
        // adds, reorders and rewrites a tier. What is left in the JSON is the
        // fallback behind that collection.
        'levels',
      ],
    },
  ];

  const readSingletonKeys = (file: string): string[] =>
    Object.keys(
      JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, 'src/data', file), 'utf-8'),
      ) as Record<string, unknown>,
    );

  const editorFieldNamesFor = (collection: string): string[] => {
    const resolved = resolveCollections(PACKAGE_REGISTRY).find(
      (c) => c.id === collection,
    );
    expect({ collection, found: resolved !== undefined }).toEqual({
      collection,
      found: true,
    });
    return resolved!.fields.map((f) => f.name);
  };

  // The headline contract, over all three singletons at once: every key in a
  // committed fallback either has an editor input or is named as retired.
  // Deliberately a loop over the table rather than one case per file — a fourth
  // singleton must be covered by adding a row, not by remembering to add a test.
  it('renders an editor input for every key of every committed page singleton', () => {
    for (const { file, collection, retired } of SINGLETONS) {
      const singletonKeys = readSingletonKeys(file);
      expect({ file, hasKeys: singletonKeys.length > 0 }).toEqual({
        file,
        hasKeys: true,
      });

      expect({
        file,
        withoutEditor: singletonKeysWithoutEditor(
          singletonKeys,
          editorFieldNamesFor(collection),
          retired,
        ),
      }).toEqual({ file, withoutEditor: [] });
    }
  });

  // A retired key that has since GAINED an input, or that has been deleted from
  // the JSON, leaves a stale excuse behind — and a stale excuse is how a future
  // key slips through under a name someone already forgave.
  it('keeps every retired-key excuse pointing at something real and still uneditable', () => {
    for (const { file, collection, retired } of SINGLETONS) {
      const singletonKeys = new Set(readSingletonKeys(file));
      const editorFieldNames = new Set(editorFieldNamesFor(collection));

      for (const key of retired) {
        expect({ file, key, presentInJson: singletonKeys.has(key) }).toEqual({
          file,
          key,
          presentInJson: true,
        });
        expect({ file, key, hasEditorInput: editorFieldNames.has(key) }).toEqual({
          file,
          key,
          hasEditorInput: false,
        });
      }
    }
  });
});
