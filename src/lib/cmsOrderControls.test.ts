// The reorder-arrow contract, tested against the @codeyam/cms entry list we
// depend on.
//
// The Momentum Fund page is a collection precisely so its sections can be
// rearranged without a code change, and until now rearranging meant opening each
// section and typing a number into an Order box while holding the other five
// sections' numbers in your head. The arrows on /admin/momentumSections replace
// that, and they live in @codeyam/cms — injected from node_modules, not written
// here — so this repo ships them as a patch-package patch.
//
// That is what these tests are for. `patch-package` matches a patch to a version
// BY FILENAME, so the next `@codeyam/cms` bump drops this patch silently unless
// something fails. Nothing else in this repo would notice: the arrows would just
// stop being on the page, and the first person to find out would be an editor
// trying to reorder the donate page. This is the same job
// `mediaCommitGuard.test.ts` does for the media guard, written for the same
// reason and against the same risk — hold the DEPENDENCY to its contract, and
// fail at CI time instead of at Nicole's next edit.
//
// These tests survive the patch being deleted. When the change lands upstream
// and the patch goes away, they stop guarding a patch and start guarding a
// released dependency — which is when they matter most, because that is the
// point at which nobody is thinking about this feature any more.
import { describe, it, expect } from 'vitest';
import {
  applySequence,
  entryOrder,
  hasOrderField,
  moveEntry,
  renumberEntries,
  sortByEntryOrder,
  type EntryListItem,
} from '@codeyam/cms/lib/entryList';
import { buildOrderChange } from '@codeyam/cms/lib/entryActions';
import { parseEntry } from '@codeyam/cms/lib/frontmatter';
import collections from '../data/collections.json';

/** A collection's declared fields, straight out of this site's registry — so a
 * field rename in `collections.json` is caught here rather than by an editor
 * finding the arrows gone. */
function fieldsFor(id: string): Array<{ name: string; type: string }> {
  const found = (collections.collections as Array<{ id: string; fields: Array<{ name: string; type: string }> }>)
    .find((c) => c.id === id);
  if (!found) throw new Error(`collections.json has no collection '${id}'`);
  return found.fields;
}

/** One entry as the admin list holds it: the raw markdown is what every ordering
 * rule actually reads. */
function entry(slug: string, label: string, order?: number, body = 'Body text.'): EntryListItem {
  const front = order === undefined ? `title: ${label}` : `order: ${order}\ntitle: ${label}`;
  return { slug, label, draft: false, raw: `---\n${front}\n---\n\n${body}\n` };
}

/** The six Momentum Fund sections, in the sequence /donate renders them. */
const SECTIONS: EntryListItem[] = [
  entry('donors', 'donors', 1),
  entry('why', 'Why Support Harvard in Tech?', 2),
  entry('accomplishments', 'accomplishments', 3),
  entry('pillars', 'pillars', 4),
  entry('stats', 'stats', 5),
  entry('close', 'close', 6),
];

describe('hasOrderField', () => {
  // The capability that switches the whole feature on. If this reads false for
  // momentumSections the arrows are gone from the page an editor uses.
  it('is true for the Momentum Fund sections', () => {
    expect(hasOrderField(fieldsFor('momentumSections'))).toBe(true);
  });

  // The other side of the split, and the regression guard for it: a collection
  // with no order has no sequence to arrange, and must keep its Drafts /
  // Published grouping exactly as it reads today.
  it('is false for a collection with no order field', () => {
    const blog = (collections.builtins as Record<string, Array<{ name: string; type: string }>>)?.blog ?? [];
    expect(hasOrderField(blog)).toBe(false);
  });

  // Scoped by capability rather than by name, so every ordered collection on
  // this site gets the arrows without the package naming any of them.
  it('is true for every collection this site declares an order on', () => {
    const ordered = (collections.collections as Array<{ id: string; fields: Array<{ name: string; type: string }> }>)
      .filter((c) => hasOrderField(c.fields))
      .map((c) => c.id);
    expect(ordered).toContain('momentumSections');
    expect(ordered).toContain('homeSections');
    expect(ordered.length).toBeGreaterThan(1);
  });

  // A same-named field of another type is not an order. Guards against a
  // consumer declaring a text `order` and getting arrows that write strings.
  it('ignores an order field that is not a number', () => {
    expect(hasOrderField([{ name: 'order', type: 'text' }])).toBe(false);
  });
});

describe('entryOrder', () => {
  // The ordinary case: the number an editor typed into the Order box.
  it('reads the order out of the frontmatter', () => {
    expect(entryOrder(entry('a', 'A', 3).raw)).toBe(3);
  });

  // Blank is a real state — most entries start with no order at all.
  it('returns undefined when the entry has no order', () => {
    expect(entryOrder(entry('a', 'A').raw)).toBeUndefined();
  });

  // Frontmatter is hand-editable, so junk has to read as unnumbered rather than
  // NaN, which would poison every comparison it reached.
  it('treats an unparseable order as unnumbered', () => {
    expect(entryOrder('---\norder: soon\ntitle: A\n---\n')).toBeUndefined();
  });
});

describe('sortByEntryOrder', () => {
  // The admin list must agree with what /donate renders, which is this repo's
  // own rule in src/lib/order.ts: ascending, unnumbered last.
  it('sorts ascending by order', () => {
    const shuffled = [SECTIONS[3], SECTIONS[0], SECTIONS[2], SECTIONS[1]];
    expect(sortByEntryOrder(shuffled).map((s) => s.slug)).toEqual([
      'donors',
      'why',
      'accomplishments',
      'pillars',
    ]);
  });

  // An entry nobody numbered must not jump to the front, which is what a
  // `undefined ?? 0` would do — it sorts after everything explicitly placed.
  it('puts an unnumbered entry last', () => {
    const items = [entry('new', 'A brand new section'), SECTIONS[0], SECTIONS[1]];
    expect(sortByEntryOrder(items).map((s) => s.slug)).toEqual(['donors', 'why', 'new']);
  });

  // The tiebreak is what makes turning this on safe for a collection nobody has
  // ordered yet: it sorts by label, exactly as the list does today.
  it('breaks ties by label', () => {
    const items = [entry('z', 'Zebra'), entry('a', 'Apple'), entry('m', 'Mango')];
    expect(sortByEntryOrder(items).map((s) => s.slug)).toEqual(['a', 'm', 'z']);
  });

  // Non-mutating, so the caller's array is safe to reuse.
  it('leaves the source array untouched', () => {
    const items = [SECTIONS[2], SECTIONS[0]];
    sortByEntryOrder(items);
    expect(items.map((s) => s.slug)).toEqual(['accomplishments', 'donors']);
  });
});

describe('moveEntry', () => {
  // One row up, which is the whole interaction.
  it('moves an entry up by one', () => {
    expect(moveEntry(SECTIONS, 2, -1).map((s) => s.slug)).toEqual([
      'donors',
      'accomplishments',
      'why',
      'pillars',
      'stats',
      'close',
    ]);
  });

  // And down, symmetrically.
  it('moves an entry down by one', () => {
    expect(moveEntry(SECTIONS, 0, 1).map((s) => s.slug)).toEqual([
      'why',
      'donors',
      'accomplishments',
      'pillars',
      'stats',
      'close',
    ]);
  });

  // The ends. The UI disables these arrows, but the rule lives here so the
  // component may stay presentational and a stale click cannot corrupt an order.
  it('returns the list unchanged at the top and bottom', () => {
    expect(moveEntry(SECTIONS, 0, -1).map((s) => s.slug)).toEqual(SECTIONS.map((s) => s.slug));
    expect(moveEntry(SECTIONS, SECTIONS.length - 1, 1).map((s) => s.slug)).toEqual(
      SECTIONS.map((s) => s.slug),
    );
  });

  // Non-mutating, like every other rule here.
  it('does not mutate the source list', () => {
    moveEntry(SECTIONS, 2, -1);
    expect(SECTIONS.map((s) => s.slug)).toEqual([
      'donors',
      'why',
      'accomplishments',
      'pillars',
      'stats',
      'close',
    ]);
  });
});

describe('renumberEntries', () => {
  // The economy of a move, and the reason a publish review stays readable: one
  // click stages TWO files, not the whole collection.
  it('reports only the rows whose number changed', () => {
    expect(renumberEntries(moveEntry(SECTIONS, 2, -1))).toEqual([
      { slug: 'accomplishments', order: 2 },
      { slug: 'why', order: 3 },
    ]);
  });

  // A list already in sequence stages nothing, so opening the page and clicking
  // nothing can never produce a pending change.
  it('reports nothing when the list is already numbered in sequence', () => {
    expect(renumberEntries(SECTIONS)).toEqual([]);
  });

  // Blank, duplicate and gapped numbers all converge on a clean 1..N at the
  // first click, rather than persisting as a puzzle for the editor to solve.
  it('renumbers a blank, duplicated and gapped list to a clean sequence', () => {
    const messy = [entry('a', 'A', 4), entry('b', 'B', 4), entry('c', 'C'), entry('d', 'D', 9)];
    expect(renumberEntries(messy)).toEqual([
      { slug: 'a', order: 1 },
      { slug: 'b', order: 2 },
      { slug: 'c', order: 3 },
      { slug: 'd', order: 4 },
    ]);
  });
});

describe('applySequence', () => {
  // With no session sequence the file-derived order stands.
  it('returns the incoming order when there is no sequence', () => {
    expect(applySequence(SECTIONS, null).map((s) => s.slug)).toEqual(SECTIONS.map((s) => s.slug));
  });

  // The reason this exists: a move stages a change but does not rewrite the
  // markdown, so the files still hold the old numbers and only this remembered
  // sequence keeps the row where the editor put it.
  it('reorders to follow the session sequence', () => {
    const seq = ['pillars', 'donors', 'why', 'accomplishments', 'stats', 'close'];
    expect(applySequence(SECTIONS, seq).map((s) => s.slug)).toEqual(seq);
  });

  // An entry the sequence has never seen must not vanish from the list — it
  // keeps its file-derived place instead.
  it('keeps an entry the sequence does not mention', () => {
    const seq = ['why', 'donors'];
    const items = [SECTIONS[0], SECTIONS[1], entry('fresh', 'Fresh section', 7)];
    expect(applySequence(items, seq).map((s) => s.slug)).toEqual(['why', 'donors', 'fresh']);
  });

  // A slug in the sequence that no longer exists is skipped rather than
  // producing a hole in the list.
  it('skips a slug that is no longer in the collection', () => {
    const seq = ['why', 'deleted-section', 'donors'];
    expect(applySequence([SECTIONS[0], SECTIONS[1]], seq).map((s) => s.slug)).toEqual(['why', 'donors']);
  });
});

describe('buildOrderChange', () => {
  const raw = [
    '---',
    'kind: narrative',
    'order: 2',
    'title: Why Support Harvard in Tech?',
    '---',
    '',
    '### Harvard in Tech is at a turning point',
    '',
    'We are a volunteer-led alumni community.',
    '',
  ].join('\n');

  // The one field a reorder is allowed to touch.
  it('writes the new order into the frontmatter', () => {
    const change = buildOrderChange('momentumSections', 'why', raw, 5);
    expect(parseEntry(change.updated).data.order).toBe(5);
  });

  // Everything else survives. A reorder that quietly dropped a section's kind or
  // rewrote its body would be far worse than the numbering it replaced.
  it('leaves the other frontmatter keys and the body intact', () => {
    const change = buildOrderChange('momentumSections', 'why', raw, 5);
    const { data, body } = parseEntry(change.updated);
    expect(data.kind).toBe('narrative');
    expect(data.title).toBe('Why Support Harvard in Tech?');
    expect(body).toContain('Harvard in Tech is at a turning point');
    expect(body).toContain('volunteer-led alumni community');
  });

  // Staged as an ordinary edit, which is what puts a reorder in the same publish
  // review as every other pending change instead of a path of its own.
  it('stages as an ordinary edit against the entry file', () => {
    const change = buildOrderChange('momentumSections', 'why', raw, 5);
    expect(change.kind).toBe('edit');
    expect(change.collection).toBe('momentumSections');
    expect(change.slug).toBe('why');
    expect(change.path).toContain('why');
  });

  // The baseline is the file normalized through parse-then-serialize, so the
  // diff an editor reviews is the one order line and nothing else.
  it('diffs as only the order line', () => {
    const change = buildOrderChange('momentumSections', 'why', raw, 5);
    const before = change.original.split('\n');
    const after = change.updated.split('\n');
    const differing = after.filter((line, i) => line !== before[i]);
    expect(differing).toEqual(['order: 5']);
  });
});
