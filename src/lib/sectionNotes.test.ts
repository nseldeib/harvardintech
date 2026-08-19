import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { KINDS_WITH_BODY } from './momentumSections';

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

/**
 * Each entry's `kind`, keyed by filename.
 *
 * Read from the frontmatter rather than hardcoded, so a band that changes kind —
 * or a new entry file — is classified correctly without anyone remembering to
 * update a list here.
 */
const KIND_OF: Record<string, string> = Object.fromEntries(
  fs
    .readdirSync(path.join(process.cwd(), ENTRY_DIR))
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const raw = fs.readFileSync(path.join(process.cwd(), ENTRY_DIR, file), 'utf8');
      return [file, raw.match(/^kind:\s*(\S+)/m)?.[1] ?? ''];
    }),
);

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
  //
  // `testimonials.md` LEFT this list when the campaign redesign gave that band a
  // rendered body. Its entry body is no longer a note to an editor — it is the
  // lede printed above the quotes on /donate — so a navigation instruction there
  // would be published to visitors. The same is true of the new `mission.md`,
  // which is why it never joined. Both kinds are named in `KINDS_WITH_BODY`, and
  // their editor guidance moved to the `kind` field's hint in
  // `src/data/collections.json`, which is where an editor picking the section
  // type actually reads it. Removing a file from this list is only legitimate
  // for that reason — a note that still exists and still points somewhere must
  // stay covered.
  it('sees a screen reference in every note that points an editor somewhere', () => {
    const bodies = entryBodies();
    const pointing = ['pillars.md', 'accomplishments.md', 'donors.md'];
    for (const file of pointing) {
      expect(bodies[file], `${file} is missing`).toBeDefined();
      expect(screenReferences(bodies[file]).length, `${file} names no screen`).toBeGreaterThan(0);
    }
  });

  // The other half of that change, asserted rather than left implicit: a band
  // whose body RENDERS must carry no editing note at all. The failure this
  // prevents is not a stale pointer but a published one — an instruction to
  // "edit this in Testimonials" appearing on the live campaign page, where the
  // lede is supposed to be. Keyed off KINDS_WITH_BODY so a future kind that
  // gains a rendered body is covered the day it is added.
  it('leaves no editor-facing note in a band whose body renders on the page', () => {
    const bodies = entryBodies();
    for (const [file, body] of Object.entries(bodies)) {
      const kind = KIND_OF[file];
      if (!kind || !KINDS_WITH_BODY.has(kind)) continue;
      expect(screenReferences(body), `${file} renders its body but names a CMS screen`).toEqual([]);
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
