import { describe, it, expect } from 'vitest';
import {
  declaredFieldNames,
  missingFields,
  schemaKeysFor,
  singletonKeysWithoutEditor,
  stripComments,
  unknownFields,
  type RegistryField,
} from './collectionRegistryDrift';

// Unit coverage for the three drift directions, against hand-built inputs.
//
// The committed-file assertions — the ones that read the real `config.ts`,
// `collections.json` and `*Page.json` and would fail a deploy — live in
// `src/data/collections.test.ts`. This file pins the RULES those assertions are
// built from, so a rule that stops meaning what its name says fails here, in one
// small test, rather than as a confusing whole-registry diff over there.

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

  // A `list`'s sub-fields are row keys inside the array, NOT frontmatter keys,
  // so they must not leak into the comparison against the schema.
  it('excludes the sub-fields of a repeatable list', () => {
    const fields: RegistryField[] = [
      {
        name: 'donorTiers',
        type: 'list',
        fields: [
          { name: 'id', type: 'text' },
          { name: 'name', type: 'text' },
        ],
      },
    ];
    expect(declaredFieldNames(fields)).toEqual(['donorTiers']);
  });

  // The empty registry is a real state — a collection can declare no fields.
  it('returns an empty list for no fields', () => {
    expect(declaredFieldNames([])).toEqual([]);
  });
});

describe('unknownFields', () => {
  // Nothing to report when the editor only renders real schema keys.
  it('reports nothing when every declared field exists in the schema', () => {
    const fields: RegistryField[] = [{ name: 'city', type: 'text' }];
    expect(unknownFields(fields, ['city', 'order'])).toEqual([]);
  });

  // The dangerous direction: an input whose key the build will reject on save.
  it('names a field that drifted out of the schema', () => {
    const fields: RegistryField[] = [
      { name: 'city', type: 'text' },
      { name: 'nickname', type: 'text' },
    ];
    expect(unknownFields(fields, ['city'])).toEqual(['nickname']);
  });

  // A collection the config never declares yields no schema keys at all, so
  // every field is unknown — which is what makes the caller's separate
  // "declared in schema" assertion necessary rather than redundant.
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
  // The clean case: an input exists for every key the schema declares.
  it('reports nothing when the editor renders an input for every key', () => {
    expect(missingFields(['city', 'order'], ['city', 'order'])).toEqual([]);
  });

  // The quiet direction: a key an editor cannot set and cannot discover.
  it('names a key that drifted out of the editor', () => {
    expect(missingFields(['city', 'order'], ['city'])).toEqual(['order']);
  });

  // The escape hatch, which must actually excuse the key it names.
  it('ignores an exempted key', () => {
    expect(missingFields(['city', 'order'], ['city'], ['order'])).toEqual([]);
  });

  // An exemption for a key that is already rendered is harmless, not an error —
  // it just has nothing to excuse.
  it('leaves a rendered key alone even when it is also exempted', () => {
    expect(missingFields(['city'], ['city'], ['city'])).toEqual([]);
  });

  // An editor that renders nothing leaves every key unreachable.
  it('treats every key as missing when the editor renders nothing', () => {
    expect(missingFields(['city', 'order'], [])).toEqual(['city', 'order']);
  });

  // The other degenerate edge: an empty schema can never be missing anything.
  it('reports nothing when the schema has no keys', () => {
    expect(missingFields([], ['city'])).toEqual([]);
  });
});

describe('singletonKeysWithoutEditor', () => {
  // The clean case: every key in the committed fallback has a box in /admin.
  it('reports nothing when every singleton key has an editor input', () => {
    expect(
      singletonKeysWithoutEditor(['kicker', 'headline'], ['kicker', 'headline']),
    ).toEqual([]);
  });

  // The regression this rule exists for: copy that reached production through
  // the JSON fallback alone, with no editor anywhere. `networkTitle` is the real
  // key that did exactly this.
  it('names a singleton key the CMS renders no input for', () => {
    expect(
      singletonKeysWithoutEditor(
        ['heroKicker', 'networkTitle', 'shareMessage'],
        ['heroKicker'],
      ),
    ).toEqual(['networkTitle', 'shareMessage']);
  });

  // A key whose band no longer renders anywhere is excused deliberately —
  // `donorsIntro`, whose donor wall is no longer mounted on any page.
  it('ignores a key named as retired', () => {
    expect(
      singletonKeysWithoutEditor(
        ['donorsTitle', 'donorsIntro'],
        ['donorsTitle'],
        ['donorsIntro'],
      ),
    ).toEqual([]);
  });

  // An empty singleton cannot be missing anything.
  it('reports nothing for a singleton with no keys', () => {
    expect(singletonKeysWithoutEditor([], ['kicker'])).toEqual([]);
  });

  // Retiring a key that DOES have an editor input is not an error — the
  // retired list only ever subtracts, so it cannot manufacture a finding.
  it('does not report a retired key that also has an input', () => {
    expect(singletonKeysWithoutEditor(['kicker'], ['kicker'], ['kicker'])).toEqual([]);
  });
});

describe('stripComments', () => {
  // The whole point: a colon inside prose must not survive to look like a key.
  it('removes a line comment carrying a colon', () => {
    expect(stripComments('// A city: one per chapter.\ncity: z.string(),')).toContain(
      'city: z.string(),',
    );
    expect(stripComments('// A city: one per chapter.\ncity: z.string(),')).not.toContain(
      'one per chapter',
    );
  });

  // The guard that keeps a URL in a string literal intact — `https://` is not a
  // comment, and eating the rest of that line would drop real schema text.
  it('leaves a protocol-relative URL in a string literal alone', () => {
    const source = "hint: 'see https://example.com/docs for more',";
    expect(stripComments(source)).toBe(source);
  });
});

describe('schemaKeysFor', () => {
  // The ordinary walk: top-level keys only, in declaration order.
  it('extracts the top-level schema keys of a collection', () => {
    expect(schemaKeysFor(FIXTURE_CONFIG, 'chapters')).toEqual(['city', 'order', 'leads']);
  });

  // Nested row keys (`name`, `role`) and the commented-out `tagline` must not
  // appear — the first would look like missing top-level keys, the second like a
  // key the editor forgot.
  it('ignores nested row keys and commented-out keys', () => {
    const keys = schemaKeysFor(FIXTURE_CONFIG, 'chapters');
    expect(keys).not.toContain('name');
    expect(keys).not.toContain('role');
    expect(keys).not.toContain('tagline');
  });

  // An undeclared collection returns nothing rather than throwing, so the
  // caller decides whether that is a failure.
  it('returns an empty list for a collection that is not declared', () => {
    expect(schemaKeysFor(FIXTURE_CONFIG, 'podcasts')).toEqual([]);
  });
});
