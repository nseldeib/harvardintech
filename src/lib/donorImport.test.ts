import { describe, expect, it } from 'vitest';
import imports from './donorImport.js';

/* The supporters already on the wall. Two of them carry the properties that
 * make re-importing dangerous rather than merely redundant: Robert is
 * anonymous, and Tomás is spelled with an accent the upload will not have. */
const existing = [
  { name: 'Margaret Chen-Alvarez', anonymous: false },
  { name: 'Robert K. Whitmore', anonymous: true },
  { name: 'Tomás Vidal', anonymous: false },
  { name: 'Priya Raman', anonymous: false },
];

describe('mapping the spreadsheet columns', () => {
  // The seam this exists for: every rule below reads `row.gradYear`, while the
  // file arrives with human headings. Get the mapping wrong and normalizeGradYear
  // returns null for every row — the import then reports "no usable class year"
  // fourteen times while looking like it worked.
  it('keys a row by the field names the rules read', () => {
    expect(
      imports.mapUploadRow({
        Name: 'Sofia Marchetti',
        School: 'Harvard College',
        'Class Year': '2019',
        Email: 'sofia@example.com',
      })
    ).toEqual({
      name: 'Sofia Marchetti',
      school: 'Harvard College',
      gradYear: '2019',
      email: 'sofia@example.com',
    });
  });

  // A column the collection has nowhere to put is dropped rather than carried,
  // since carrying it would imply the wall can show it.
  it('drops a column the site has no field for', () => {
    const mapped = imports.mapUploadRow({ Name: 'Devon Ashworth', 'Gift Date': '2026-03-01' });
    expect(mapped).toEqual({ name: 'Devon Ashworth' });
  });

  // A missing column must stay missing rather than becoming an empty string —
  // the difference between "not supplied" and "supplied as blank".
  it('omits a heading the file does not carry', () => {
    expect(imports.mapUploadRow({ Name: 'Ravi Balasubramanian' })).toEqual({
      name: 'Ravi Balasubramanian',
    });
  });

  // The page hands it whatever is in the JSON. A malformed entry should cost
  // one row, not the whole import.
  it('returns an empty object for a non-row rather than throwing', () => {
    expect(imports.mapUploadRow(null)).toEqual({});
    expect(imports.mapUploadRow('Sofia')).toEqual({});
  });

  // The upload arrives as `{rows: [...]}`; a file that failed to parse gives
  // undefined, and an empty walkthrough beats a thrown error on a review page.
  it('maps a whole upload, and survives one that carries no rows', () => {
    const rows = imports.mapUploadRows([{ Name: 'A' }, { Name: 'B', School: 'Harvard College' }]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ name: 'B', school: 'Harvard College' });
    expect(imports.mapUploadRows(undefined)).toEqual([]);
  });
});

describe('name normalization — the ways one person arrives twice', () => {
  // A spreadsheet export pads cells and a web form uppercases. Neither is a
  // different human, but a bare === treats both as new supporters and puts a
  // second card on the wall.
  it('reads padding and case as the same person', () => {
    expect(imports.normalizeName('  robert k. whitmore  ')).toBe(
      imports.normalizeName('Robert K. Whitmore')
    );
  });

  // The accent is dropped constantly in exports and re-entry. Treating "Tomas"
  // as a new supporter is the single most likely duplicate this file produces.
  it('reads a dropped accent as the same person', () => {
    expect(imports.normalizeName('Tomas Vidal')).toBe(imports.normalizeName('Tomás Vidal'));
  });

  // Punctuation is deliberately KEPT, so a suffix does not silently merge two
  // people. Father and son share a name; an importer that collapses them
  // deletes one supporter without telling anyone.
  it('does not collapse a suffix into the bare name', () => {
    expect(imports.normalizeName('Gregory Tanaka-Lindqvist III')).not.toBe(
      imports.normalizeName('Gregory Tanaka Lindqvist')
    );
  });

  // A blank cell reaches here as undefined from the column mapping, so the
  // normalizer is on the path for every missing name in the file.
  it('returns an empty string for a non-string, rather than throwing', () => {
    expect(imports.normalizeName(undefined)).toBe('');
    expect(imports.normalizeName(null)).toBe('');
  });
});

describe('anonymity arriving in the name column', () => {
  // The file has no anonymity column, so the request turns up in the only free
  // text field there is. Imported literally it becomes a card reading
  // "Anonymous" as though that were a person's name.
  it('recognizes the ways a supporter writes "do not name me"', () => {
    expect(imports.looksAnonymous('Anonymous')).toBe(true);
    expect(imports.looksAnonymous('  anon  ')).toBe(true);
    expect(imports.looksAnonymous('Prefer not to say')).toBe(true);
    expect(imports.looksAnonymous('Withheld')).toBe(true);
  });

  // The check must not fire on a real name that merely contains a marker word,
  // or it would strip the identity of someone who wanted to be listed.
  it('does not mistake a real name for an anonymity request', () => {
    expect(imports.looksAnonymous('Anne Morrison')).toBe(false);
    expect(imports.looksAnonymous('Nadia Anonuevo')).toBe(false);
  });
});

describe('school mapping', () => {
  // Someone filling a form writes the school out in full; the site stores a
  // short form. Without the alias map an ordinary correct answer arrives as an
  // unknown value.
  it('maps a written-out school onto the spelling the site uses', () => {
    expect(imports.normalizeSchool('Harvard Graduate School of Design')).toBe('Harvard GSD');
    expect(imports.normalizeSchool('kennedy school')).toBe('Harvard Kennedy School');
  });

  // An unrecognized school is a mapping to confirm, not a value to discard —
  // dropping it would quietly empty that supporter out of three directions.
  it('keeps an unrecognized school rather than discarding it', () => {
    expect(imports.normalizeSchool('Harvard Divinity School')).toBe('Harvard Divinity School');
  });

  // Null and empty string mean different things downstream: null is "the file
  // did not say", which is what rowIssues reports on.
  it('reports an empty cell as nothing, not as an empty school', () => {
    expect(imports.normalizeSchool('')).toBeNull();
    expect(imports.normalizeSchool('   ')).toBeNull();
    expect(imports.normalizeSchool(undefined)).toBeNull();
  });
});

describe('class year', () => {
  // The ordinary case, from both a text cell and a numeric one — a spreadsheet
  // export gives either depending on how the column was typed.
  it('accepts the four-digit form', () => {
    expect(imports.normalizeGradYear('2019')).toBe(2019);
    expect(imports.normalizeGradYear(1987)).toBe(1987);
  });

  // The apostrophe form is how people actually write a class year, and a
  // spreadsheet preserves it as text.
  it('accepts the apostrophe form a spreadsheet produces', () => {
    expect(imports.normalizeGradYear("'04")).toBe(2004);
    expect(imports.normalizeGradYear('’98')).toBe(1998);
    expect(imports.normalizeGradYear('87')).toBe(1987);
  });

  // A wrong year is worse than a missing one: it places a supporter in the
  // wrong cohort in three of the nine directions, where it looks like data
  // rather than like an error.
  it('refuses to guess at anything else', () => {
    expect(imports.normalizeGradYear('class of 04')).toBeNull();
    expect(imports.normalizeGradYear('')).toBeNull();
    expect(imports.normalizeGradYear('n/a')).toBeNull();
    expect(imports.normalizeGradYear(3200)).toBeNull();
  });
});

describe('matching against the wall', () => {
  // Each of these is a real way one supporter arrives twice, and each is
  // invisible to the eye scanning the file.
  it('finds an exact match through padding, case and a dropped accent', () => {
    expect(imports.matchExisting('  robert k. whitmore  ', existing).status).toBe('duplicate');
    expect(imports.matchExisting('Tomas Vidal', existing).status).toBe('duplicate');
  });

  // The middle outcome is the point of the function: it neither duplicates a
  // supporter nor merges two of them, it asks.
  it('reports a suffix difference as possible rather than deciding it', () => {
    const result = imports.matchExisting('Margaret Chen Alvarez III', existing);
    expect(result.status).toBe('possible');
    expect(result.match.name).toBe('Margaret Chen-Alvarez');
  });

  // The baseline: most of a bi-weekly upload is genuinely new people, and they
  // must not be flagged as anything.
  it('reports an unknown name as new', () => {
    expect(imports.matchExisting('Wendell Achebe-Okoro', existing).status).toBe('new');
  });

  // The specific path by which a withheld name reaches the public site: the
  // upload carries the real name and no anonymity column, so a blind overwrite
  // republishes it.
  it('flags when the matched supporter is anonymous', () => {
    expect(imports.matchExisting('robert k. whitmore', existing).existingAnonymous).toBe(true);
    expect(imports.matchExisting('Priya Raman', existing).existingAnonymous).toBe(false);
  });
});

describe('what a row still needs a human for', () => {
  // Name is the one field the wall genuinely requires, so a blank one cannot be
  // resolved by any later edit to the tier or badge.
  it('blocks a row with no name at all', () => {
    const issues = imports.rowIssues({ name: '', school: 'Harvard College', gradYear: '2010' }, existing);
    expect(issues.some((i) => i.code === 'missing-name' && i.severity === 'blocking')).toBe(true);
  });

  // Blocking rather than asking: imported literally this publishes a card that
  // reads "Anonymous" as if it were a person's name.
  it('blocks an anonymity request sitting in the name column', () => {
    const issues = imports.rowIssues({ name: 'Anonymous', school: 'Harvard Law School', gradYear: '2001' }, existing);
    expect(issues.some((i) => i.code === 'anonymity-in-name' && i.severity === 'blocking')).toBe(true);
  });

  // The harm here is one-way. Every other issue can be corrected after the
  // fact; a published name that was meant to be withheld cannot.
  it('blocks re-importing someone who is anonymous on the wall', () => {
    const issues = imports.rowIssues({ name: 'robert k. whitmore', school: 'Harvard College', gradYear: '1987' }, existing);
    expect(issues.some((i) => i.code === 'would-unmask' && i.severity === 'blocking')).toBe(true);
  });

  // A duplicate is a correctable mistake, so it asks rather than blocks —
  // unless it is the unmasking case above.
  it('asks about an ordinary duplicate rather than blocking it', () => {
    const issues = imports.rowIssues({ name: 'Priya Raman', school: 'Harvard SEAS', gradYear: '2014' }, existing);
    const dup = issues.find((i) => i.code === 'duplicate');
    expect(dup?.severity).toBe('review');
    expect(issues.some((i) => i.code === 'would-unmask')).toBe(false);
  });

  // Not blocking — the supporter can still land — but directions 01, 03 and 09
  // group by these, so the gap decides which designs stay viable.
  it('notes a missing school and a missing class year', () => {
    const issues = imports.rowIssues({ name: 'Devon Ashworth', school: '', gradYear: '' }, existing);
    expect(issues.some((i) => i.code === 'missing-school')).toBe(true);
    expect(issues.some((i) => i.code === 'missing-grad-year')).toBe(true);
  });

  // The negative case that keeps the others honest: if everything raised an
  // issue, the issue list would carry no information.
  it('finds nothing to raise on a clean, new row', () => {
    const issues = imports.rowIssues(
      { name: 'Wendell Achebe-Okoro', school: 'Harvard Kennedy School', gradYear: '2007' },
      existing
    );
    expect(issues).toEqual([]);
  });
});

describe('the summary of a whole upload', () => {
  const rows = [
    { name: 'Wendell Achebe-Okoro', school: 'Harvard Kennedy School', gradYear: '2007' },
    { name: 'Priya Raman', school: 'Harvard SEAS', gradYear: '2014' },
    { name: '  robert k. whitmore  ', school: 'Harvard College', gradYear: '1987' },
    { name: 'Anonymous', school: 'Harvard Law School', gradYear: '2001' },
    { name: '', school: 'Harvard College', gradYear: '2010' },
  ];

  // The numbers the walkthrough puts on screen at I2, so they are worth pinning
  // rather than trusting to a render.
  it('counts what can land against what needs a decision', () => {
    const summary = imports.summarizeImport(rows, existing);
    expect(summary.total).toBe(5);
    // Wendell and Priya can land; the other three each hit a blocking issue.
    expect(summary.ready).toBe(2);
    expect(summary.needsDecision).toBe(3);
    expect(summary.duplicates).toBe(2);
  });

  // The load-bearing assertion of this file. tier, founding and anonymous are
  // properties of the FILE FORMAT, not of any row — a spreadsheet where every
  // row is spotless still cannot say who gave at what level, who is a founding
  // donor, or who asked to stay anonymous. A summary that hid them on a clean
  // file would report success for a job it did a third of.
  it('reports the unanswerable fields even when every row is clean', () => {
    const clean = [
      { name: 'Sofia Marchetti', school: 'Harvard College', gradYear: '2019' },
      { name: 'Jae-Won Park', school: 'Harvard Medical School', gradYear: '2005' },
    ];
    const summary = imports.summarizeImport(clean, existing);
    expect(summary.needsDecision).toBe(0);
    expect(summary.unresolvable.map((f) => f.field)).toEqual(['tier', 'founding', 'anonymous']);
    expect(summary.unmodelled.map((f) => f.field)).toEqual(['school', 'gradYear']);
  });

  // A zero-row file still has a shape, and its shape still cannot answer tier,
  // founding or anonymous.
  it('survives an empty upload', () => {
    const summary = imports.summarizeImport([], existing);
    expect(summary.total).toBe(0);
    expect(summary.unresolvable).toHaveLength(3);
  });
});
