import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

// The notes in the `momentumSections` entries tell an editor WHERE to go to edit
// each band's content, which makes them navigation instructions written in prose
// — and prose is exactly what rots unnoticed. Three of them spent a release
// naming "Settings → Momentum Fund page copy", a screen that does not exist: the
// pillar cards and the accomplishment figures had moved into their own
// collections, `pageCopy` had been relabelled "Page settings", and the dashboard
// had stopped grouping anything under Settings. None of that broke a build or
// failed a test, because nothing connected the notes to the registry they
// describe. The editor just got sent somewhere by a note that looked
// authoritative. This test is the reminder.
//
// It guards the screen NAME, not the wording. The name is the machine-checkable
// part and the part that actually went wrong; asserting on the prose would fail
// on every future rewording and teach the next author to delete the test.

const ENTRY_DIR = 'src/content/momentumSections';

const registry = JSON.parse(fs.readFileSync('src/data/collections.json', 'utf8')) as {
  collections: { id: string; label: string }[];
};

// Screens the CMS ships that are not registry collections — the dashboard's own
// nav destinations. A note may legitimately send an editor to one of these, so
// they resolve just like a collection label does. The `BUILTIN_COLLECTIONS`
// counterpart in `./collectionPlacement.test.ts`, for the same reason.
const BUILTIN_SCREENS = [
  'Pages',
  'Content',
  'Media',
  'Previews',
  'Settings',
  'Editors',
  'Publish',
  'Site settings',
];

/** Every screen name a note is allowed to send an editor to, lowercased. */
function validScreens(): Set<string> {
  return new Set(
    [...registry.collections.map((c) => c.label), ...BUILTIN_SCREENS].map((name) =>
      name.trim().toLowerCase(),
    ),
  );
}

/**
 * The screen names a note deliberately references.
 *
 * Two forms count, and both are deliberate rather than incidental — which is the
 * point, because keying on "any capitalised phrase" would flag ordinary prose and
 * make the test unmaintainable:
 *
 *   1. A BOLD span, the form the notes use to name a collection.
 *   2. The destination of an ARROW navigation path, the form the stale notes used
 *      ("Settings → Momentum Fund page copy"). It stays matched even though no
 *      note writes it today: it is the shape the rot took, and a guard that could
 *      not see the original failure would not have caught it.
 *
 * Whitespace is collapsed first so a reference wrapped across two lines — these
 * files are hard-wrapped at 80 columns — reads as one name rather than two.
 */
function screenReferences(body: string): string[] {
  const text = body.replace(/\s+/g, ' ');
  const names: string[] = [];
  for (const match of text.matchAll(/\*\*([^*]+?)\*\*/g)) names.push(match[1]);
  for (const match of text.matchAll(/→\s*([^,.;—()*]+)/g)) names.push(match[1]);
  return names.map((name) => name.trim()).filter(Boolean);
}

/** The entry bodies, keyed by filename, with frontmatter stripped. */
function entryBodies(): Record<string, string> {
  const dir = path.join(process.cwd(), ENTRY_DIR);
  const bodies: Record<string, string> = {};
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    bodies[file] = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  }
  return bodies;
}

/**
 * Every screen reference that resolves to no real screen, reported as
 * `<entry file>: <name>` so a failure names the file to go fix.
 */
function unresolvedScreenReferences(): string[] {
  const valid = validScreens();
  const unresolved: string[] = [];
  for (const [file, body] of Object.entries(entryBodies())) {
    for (const name of screenReferences(body)) {
      if (!valid.has(name.toLowerCase())) unresolved.push(`${file}: ${name}`);
    }
  }
  return unresolved;
}

describe('momentumSections entry notes', () => {
  // The reproduction test. The editor is being sent somewhere, and it has to
  // exist — this is the assertion the three stale notes failed.
  it('names only CMS screens that exist in the registry', () => {
    expect(unresolvedScreenReferences()).toEqual([]);
  });

  // A scanner that matched nothing would satisfy the test above trivially and
  // silently stop guarding anything, which is the failure mode a prose test is
  // most prone to. Every note that sends an editor somewhere must be SEEN doing
  // it, so the guard's own reach is asserted rather than assumed.
  it('sees a screen reference in every note that points an editor somewhere', () => {
    const bodies = entryBodies();
    const pointing = ['pillars.md', 'accomplishments.md', 'donors.md', 'testimonials.md'];
    for (const file of pointing) {
      expect(bodies[file], `${file} is missing`).toBeDefined();
      expect(screenReferences(bodies[file]).length, `${file} names no screen`).toBeGreaterThan(0);
    }
  });

  // The registry is what carries the authority for what a screen is CALLED, and
  // this is the specific fact the whole guard turns on: the collection an editor
  // was being sent to is labelled "Page settings" and has never been labelled
  // "Momentum Fund page copy".
  it('takes its valid screen names from the collection labels', () => {
    const valid = validScreens();
    expect(valid.has('page settings')).toBe(true);
    expect(valid.has('momentum fund gift pillars')).toBe(true);
    expect(valid.has('momentum fund accomplishments')).toBe(true);
    expect(valid.has('momentum fund page copy')).toBe(false);
  });
});

describe('screenReferences', () => {
  // The form the rewritten notes use to name a collection.
  it('picks up a bolded collection name', () => {
    expect(screenReferences('edited in **Momentum Fund gift pillars**, not here')).toEqual([
      'Momentum Fund gift pillars',
    ]);
  });

  // The form the stale notes used. Matched so the guard can still see the
  // original failure, and so reintroducing that phrasing fails rather than
  // slipping through unreferenced.
  it('picks up the destination of an arrow navigation path', () => {
    expect(screenReferences('edited under Settings → Momentum Fund page copy, not here')).toEqual([
      'Momentum Fund page copy',
    ]);
  });

  // These files are hard-wrapped at 80 columns, so a two-word screen name lands
  // across a line break often enough that a line-oriented scan would miss it and
  // report a name that was never really written.
  it('reads a reference split across a line break as one name', () => {
    expect(screenReferences('needs a developer — **Page\nsettings** does not carry them')).toEqual([
      'Page settings',
    ]);
  });

  // Field names, filenames, and JSON keys are written in backticks precisely so
  // they are NOT read as places to navigate to. Only the deliberate forms count.
  it('ignores code spans and ordinary prose', () => {
    expect(
      screenReferences('via its Heading field, falling back to `donorsTitle` in `donatePage.json`'),
    ).toEqual([]);
  });

  // A note that names several screens has to have all of them checked, not just
  // the first — the donor wall note names two.
  it('collects every reference in one note', () => {
    expect(screenReferences('from **Donors**, and **Page settings** does not carry them')).toEqual([
      'Donors',
      'Page settings',
    ]);
  });
});
