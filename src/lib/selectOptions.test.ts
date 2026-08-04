import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HOME_SECTION_KINDS } from './homeSections';
import { SECTION_KINDS, SECTION_LAYOUTS } from './momentumSections';
import { PILLAR_ICONS } from './pillars';

// Four fields on this site are enums in everything but name: the code validates
// them against a fixed list and silently falls back (or drops the section) on
// anything else. The CMS had no dropdown, so they shipped as text boxes with the
// valid values spelled out in prose hints — an editor adding a homepage band had
// to type one of thirteen exact strings, and a typo meant the band just did not
// appear.
//
// They are now `select` fields whose `options` live in collections.json. That
// duplicates the lists, so these tests are the thing that keeps the copy honest:
// add a section kind to the code without adding it to the CMS and this fails,
// rather than the new kind being quietly unreachable to every editor.

const registry = JSON.parse(fs.readFileSync('src/data/collections.json', 'utf8')) as {
  collections: { id: string; fields: { name: string; type: string; options?: string[] }[] }[];
};

function field(collectionId: string, fieldName: string) {
  const collection = registry.collections.find((c) => c.id === collectionId);
  expect(collection, `collection ${collectionId} is missing`).toBeDefined();
  const found = collection!.fields.find((f) => f.name === fieldName);
  expect(found, `${collectionId}.${fieldName} is missing`).toBeDefined();
  return found!;
}

describe('enum-shaped fields are dropdowns, not text boxes', () => {
  it.each([
    ['homeSections', 'kind'],
    ['momentumSections', 'kind'],
    ['momentumSections', 'layout'],
    ['pillars', 'icon'],
  ])('%s.%s is a select', (collectionId, fieldName) => {
    expect(field(collectionId, fieldName).type).toBe('select');
  });
});

describe('dropdown options match the validators that enforce them', () => {
  // An unlisted kind is dropped from the page with a warning, so an option the
  // code does not know is an option that silently does nothing.
  it('homeSections.kind offers exactly the kinds the homepage renders', () => {
    expect(field('homeSections', 'kind').options).toEqual([...HOME_SECTION_KINDS]);
  });

  // The list that was actually wrong before: the old prose hint omitted donors
  // entirely, so no editor could learn that band was addable.
  it('momentumSections.kind offers exactly the Momentum Fund section kinds', () => {
    expect(field('momentumSections', 'kind').options).toEqual([...SECTION_KINDS]);
  });

  // A mistyped layout silently falls back to text-only, losing the chosen design.
  it('momentumSections.layout offers exactly the layouts', () => {
    expect(field('momentumSections', 'layout').options).toEqual([...SECTION_LAYOUTS]);
  });

  // An unrecognized icon falls back to people, so a typo quietly changes the art.
  it('pillars.icon offers exactly the drawn glyphs', () => {
    expect(field('pillars', 'icon').options).toEqual([...PILLAR_ICONS]);
  });
});

describe('every declared select is usable', () => {
  // A select with no options is strictly worse than the text box it replaced —
  // there is no longer any way to enter a value at all.
  it('gives each select a non-empty options list', () => {
    for (const collection of registry.collections) {
      for (const f of collection.fields) {
        if (f.type !== 'select') continue;
        expect(f.options ?? [], `${collection.id}.${f.name} has no options`).not.toHaveLength(0);
      }
    }
  });

  // The control already spells unset with its own blank entry; a second one
  // would be indistinguishable from it in the menu.
  it('gives no select a duplicate or blank option', () => {
    for (const collection of registry.collections) {
      for (const f of collection.fields) {
        if (f.type !== 'select') continue;
        const options = f.options ?? [];
        expect(new Set(options).size, `${collection.id}.${f.name} repeats an option`).toBe(
          options.length,
        );
        // A blank option is how the control already spells "unset"; a second one
        // in the list would be an indistinguishable duplicate of it.
        expect(options.filter((o) => o.trim() === '')).toEqual([]);
      }
    }
  });
});

describe('existing content still validates against the new dropdowns', () => {
  // The values already committed were typed as free text. If any of them is not
  // an option, an editor opening that entry sees an out-of-list value — which
  // the control preserves, but which means the site is rendering something the
  // CMS calls invalid. Worth failing over: it means the lists disagree.
  it.each([
    ['homeSections', 'kind'],
    ['momentumSections', 'kind'],
    ['momentumSections', 'layout'],
    ['pillars', 'icon'],
  ])('every committed %s.%s value is offered', (collectionId, fieldName) => {
    const options = new Set(field(collectionId, fieldName).options ?? []);
    const dir = `src/content/${collectionId}`;
    if (!fs.existsSync(dir)) return;

    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const raw = fs.readFileSync(`${dir}/${file}`, 'utf8');
      const match = raw.match(new RegExp(`^${fieldName}:\\s*(.+)$`, 'm'));
      if (!match) continue;
      const value = match[1].trim().replace(/^['"]|['"]$/g, '');
      if (value === '') continue;
      expect(options.has(value), `${collectionId}/${file} has ${fieldName}: ${value}`).toBe(true);
    }
  });
});
