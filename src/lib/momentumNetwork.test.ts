import { describe, it, expect } from 'vitest';
import {
  headlineHtml,
  ambientField,
  networkViewBox,
  networkRng,
  clusterCentres,
  schoolsPresent,
  placeNodes,
  nearestNeighborEdges,
  networkLayout,
  isSelectableNode,
  networkNodeDetail,
  matchesNetworkSearch,
  searchNetwork,
  searchSummary,
  supporterRoll,
  shortSchoolLabel,
  FOUNDING_SUPPORTER_LABEL,
  NETWORK_COLORS,
} from './momentumNetwork';
import { ANONYMOUS_DONOR_LABEL, type DonorLike } from './donors';

function donor(slug: string, name: string, extra: Partial<DonorLike> = {}): DonorLike {
  return { slug, name, ...extra };
}

/** A spread of supporters across several schools — the shape the layout is for. */
function population(): DonorLike[] {
  return [
    donor('a', 'Aisha Rahman', { school: 'Harvard Kennedy School', location: 'London, United Kingdom' }),
    donor('b', 'Ben Wei', { school: 'Harvard Kennedy School', location: 'Boston, MA' }),
    donor('c', 'Clara Ndiaye', { school: 'Harvard College', founding: true }),
    donor('d', 'David Osei-Bonsu', { school: 'Harvard College' }),
    donor('e', 'Elena Marchetti', { school: 'Harvard Business School' }),
    donor('f', 'Farid Haddad'),
  ];
}

describe('networkViewBox', () => {
  // The canvas grows with the count so the SPACING between supporters stays
  // constant — this is what keeps the picture reading as a dense network at
  // nineteen supporters as well as at two hundred.
  it('grows with the supporter count', () => {
    const small = networkViewBox(20);
    const large = networkViewBox(200);
    expect(large.width).toBeGreaterThan(small.width);
  });

  // Constant density means area per supporter stays roughly fixed — the
  // property the whole approach rests on, asserted directly rather than
  // inferred from the width alone.
  it('keeps the area per supporter roughly constant as the count grows', () => {
    const perSupporter = (n: number) => {
      const box = networkViewBox(n);
      return (box.width * box.height) / n;
    };
    // Both counts are above the minimum-width floor on purpose: below it the box
    // deliberately stops shrinking, so density there is expected to rise. The
    // floor is its own test just below.
    //
    // 400 and 800 rather than the original 50 and 400. The floor moved from 340
    // to 1100 when the band became the page's full-bleed hero — see
    // `MIN_VIEWBOX_WIDTH` for why — and 50 supporters now sit BELOW it, where
    // constant density is not the contract. Testing there would assert the
    // opposite of what the code promises.
    const ratio = perSupporter(800) / perSupporter(400);
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);
  });

  // Below the floor the box stops shrinking, so one supporter is a small
  // network in a normal frame rather than a single enormous disc.
  it('stops shrinking at a floor for a tiny network', () => {
    expect(networkViewBox(1).width).toBe(networkViewBox(2).width);
  });

  // An empty network still needs a frame to draw its empty state in.
  it('returns a usable box for no supporters at all', () => {
    expect(networkViewBox(0).width).toBeGreaterThan(0);
    expect(networkViewBox(0).height).toBeGreaterThan(0);
  });

  // The network sits as a band across the page, so a canvas taller than it is
  // wide would letterbox inside its own frame.
  it('keeps the canvas wider than it is tall', () => {
    const box = networkViewBox(50);
    expect(box.width).toBeGreaterThan(box.height);
  });
});

describe('networkRng', () => {
  // The layout must be reproducible: a network that reshuffles between renders
  // is a different picture on every load, and a reviewed screenshot would stop
  // matching what ships.
  it('produces the same sequence for the same seed', () => {
    const a = networkRng(5);
    const b = networkRng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  // A scenario pins its own seed to keep a reviewed layout; that only works if
  // seeds actually diverge.
  it('produces a different sequence for a different seed', () => {
    expect(networkRng(1)()).not.toBe(networkRng(2)());
  });

  // Every caller multiplies this by a canvas dimension, so a value outside
  // [0,1) places a supporter off the picture.
  it('stays within the unit interval', () => {
    const rnd = networkRng(9);
    for (let i = 0; i < 50; i += 1) {
      const value = rnd();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('schoolsPresent', () => {
  // Densest first, so the biggest clusters are placed before the rest. Built
  // with a clear winner rather than reusing the shared population, where two
  // schools tie at two members and the result is decided by the tiebreak below.
  it('lists the schools present, most supporters first', () => {
    const donors = [
      donor('a', 'A', { school: 'Harvard Kennedy School' }),
      donor('b', 'B', { school: 'Harvard Kennedy School' }),
      donor('c', 'C', { school: 'Harvard Kennedy School' }),
      donor('d', 'D', { school: 'Harvard College' }),
    ];
    expect(schoolsPresent(donors)[0]).toBe('Harvard Kennedy School');
  });

  // A tie is broken by the canonical school order rather than by whichever
  // supporter happened to be read first — otherwise the same people in a
  // different row order would produce a different picture.
  it('breaks a tie by the canonical school order, not by input order', () => {
    const donors = [
      donor('a', 'A', { school: 'Harvard Kennedy School' }),
      donor('b', 'B', { school: 'Harvard College' }),
    ];
    const reversed = [donors[1], donors[0]];
    expect(schoolsPresent(donors)).toEqual(schoolsPresent(reversed));
    expect(schoolsPresent(donors)[0]).toBe('Harvard College');
  });

  // Read through resolveSchool, so a differently-cased value joins its real
  // cluster instead of founding a cluster of one.
  it('folds a differently-cased school into one cluster', () => {
    const donors = [
      donor('a', 'A', { school: 'Harvard College' }),
      donor('b', 'B', { school: 'harvard college' }),
    ];
    expect(schoolsPresent(donors)).toEqual(['Harvard College']);
  });

  // A supporter with no school founds no cluster — they are placed among the
  // others instead, rather than creating an empty band of one.
  it('ignores supporters with no school', () => {
    expect(schoolsPresent([donor('f', 'Farid Haddad')])).toEqual([]);
  });
});

describe('clusterCentres', () => {
  // Every cluster has to land inside the frame, or its supporters are drawn off
  // the edge of the picture.
  it('places every centre inside the canvas', () => {
    const centres = clusterCentres(['A', 'B', 'C', 'D', 'E'], 1000, 620, networkRng(3));
    for (const [x, y] of Object.values(centres)) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1000);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(620);
    }
  });

  // Day one, before anyone has given: the layout still has to answer.
  it('returns nothing when there are no schools', () => {
    expect(clusterCentres([], 1000, 620, networkRng(3))).toEqual({});
  });

  // The phyllotaxis spiral replaced a grid precisely because a grid leaves its
  // last row part-empty at any non-square count. Distinct centres are the
  // minimum evidence that it is distributing rather than stacking.
  it('gives each school its own distinct centre', () => {
    const centres = clusterCentres(['A', 'B', 'C', 'D'], 1000, 620, networkRng(7));
    const keys = Object.values(centres).map(([x, y]) => `${Math.round(x)}:${Math.round(y)}`);
    expect(new Set(keys).size).toBe(4);
  });
});

describe('placeNodes', () => {
  const build = () => {
    const donors = population();
    const rnd = networkRng(5);
    const centres = clusterCentres(schoolsPresent(donors), 1000, 620, rnd);
    return placeNodes(donors, centres, 1000, 620, rnd);
  };

  // Nobody is dropped, including the supporter with no school — a visualization
  // that quietly omitted them would undercount the community it exists to show.
  it('places every supporter, including one with no school', () => {
    const nodes = build();
    expect(nodes).toHaveLength(6);
    expect(nodes.map((n) => n.slug)).toContain('f');
  });

  // A supporter drawn outside the viewBox is a supporter the page silently
  // fails to recognise.
  it('keeps every node inside the canvas', () => {
    for (const node of build()) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.x).toBeLessThan(1000);
      expect(node.y).toBeGreaterThan(0);
      expect(node.y).toBeLessThan(620);
    }
  });

  // Founding supporters read larger, which is how the badge survives a design
  // where every node is otherwise the same crimson.
  it('draws a founding supporter larger than the rest', () => {
    const nodes = build();
    const founding = nodes.find((n) => n.slug === 'c')!;
    const plain = nodes.find((n) => n.slug === 'd')!;
    expect(founding.r).toBeGreaterThan(plain.r);
  });

  // The selectable flag is what makes an anonymous node inert in the DOM.
  it('marks an anonymous supporter as not selectable', () => {
    const donors = [donor('x', 'X', { anonymous: true }), donor('y', 'Y')];
    const rnd = networkRng(5);
    const nodes = placeNodes(donors, {}, 1000, 620, rnd);
    expect(nodes.find((n) => n.slug === 'x')!.selectable).toBe(false);
    expect(nodes.find((n) => n.slug === 'y')!.selectable).toBe(true);
  });

  // Same supporters in, same picture out — otherwise every page load is a
  // different design and a reviewed screenshot stops matching what ships.
  it('is reproducible for the same seed', () => {
    expect(build().map((n) => [n.x, n.y])).toEqual(build().map((n) => [n.x, n.y]));
  });
});

describe('nearestNeighborEdges', () => {
  const nodes = [
    { slug: 'a', x: 0, y: 0, r: 3, founding: false, selectable: true },
    { slug: 'b', x: 10, y: 0, r: 3, founding: false, selectable: true },
    { slug: 'c', x: 20, y: 0, r: 3, founding: false, selectable: true },
    { slug: 'd', x: 30, y: 0, r: 3, founding: false, selectable: true },
  ];

  // THE decision the whole design turns on. One edge per node back to a hub is
  // what made the exploration read as "a constellation of stars"; several edges
  // per node is what makes it read as a network.
  it('gives a node more than one connection', () => {
    const edges = nearestNeighborEdges(nodes, 2);
    const touching = edges.filter((e) => e.a === 0 || e.b === 0);
    expect(touching.length).toBeGreaterThan(1);
  });

  // A mutual nearest pair must not yield the same connection twice: a
  // double-drawn line renders visibly brighter than its neighbours and implies
  // a relationship that is not there.
  it('never repeats the same connection', () => {
    const edges = nearestNeighborEdges(nodes, 3);
    const keys = edges.map((e) => `${e.a}:${e.b}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // One spelling per pair is what makes the dedup above sound; two orderings
  // would let the same connection through twice.
  it('always orders an edge low index first, so a pair has one spelling', () => {
    for (const edge of nearestNeighborEdges(nodes, 3)) {
      expect(edge.a).toBeLessThan(edge.b);
    }
  });

  // A self-edge renders as a dot on a dot and reads as a rendering fault.
  it('never connects a node to itself', () => {
    for (const edge of nearestNeighborEdges(nodes, 3)) {
      expect(edge.a).not.toBe(edge.b);
    }
  });

  // The day after the first gift, which is a state the page really ships in.
  it('returns nothing for a single node, which has nobody to connect to', () => {
    expect(nearestNeighborEdges([nodes[0]], 3)).toEqual([]);
  });
});

describe('networkLayout', () => {
  // The composed result is what the component consumes, so its three parts are
  // asserted together rather than only through their helpers.
  it('returns a node for every supporter, with edges and a viewBox', () => {
    const layout = networkLayout(population());
    expect(layout.nodes).toHaveLength(6);
    expect(layout.edges.length).toBeGreaterThan(0);
    expect(layout.viewBox.width).toBeGreaterThan(0);
  });

  // Every edge index has to address a real node, or the component renders a
  // line from undefined coordinates.
  it('only produces edges that address real nodes', () => {
    const layout = networkLayout(population());
    for (const edge of layout.edges) {
      expect(layout.nodes[edge.a]).toBeDefined();
      expect(layout.nodes[edge.b]).toBeDefined();
    }
  });

  // The blooms are placed from the same seeded draw as the supporters under
  // them; a cluster with no light, or light with no cluster, means the two have
  // drifted apart.
  it('returns one glow cluster per school present', () => {
    const layout = networkLayout(population());
    expect(layout.clusters).toHaveLength(schoolsPresent(population()).length);
  });

  // The production default until the first gift clears — it must not throw on
  // the page every visitor currently sees.
  it('handles an empty network without throwing', () => {
    const layout = networkLayout([]);
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
  });

  // One node and no web: the network has to survive being looked at before it
  // is a network.
  it('handles a single supporter, who has no connections yet', () => {
    const layout = networkLayout([donor('a', 'A', { school: 'Harvard College' })]);
    expect(layout.nodes).toHaveLength(1);
    expect(layout.edges).toEqual([]);
  });
});

describe('shortSchoolLabel', () => {
  // The panel prints the school beside a year in a narrow column, and the
  // longest real school name is 66 characters.
  it('shortens the longest school name', () => {
    expect(
      shortSchoolLabel('Harvard John A. Paulson School of Engineering and Applied Sciences'),
    ).toBe('SEAS');
  });

  // A hand-edited or seeded value should still shorten rather than falling
  // through to its long form.
  it('matches case-insensitively, like the resolver behind it', () => {
    expect(shortSchoolLabel('harvard business school')).toBe('HBS');
  });

  // Losing the school entirely would be worse than printing it long.
  it('falls back to the value as given for an unrecognized school', () => {
    expect(shortSchoolLabel('Somewhere Else')).toBe('Somewhere Else');
  });

  // Nothing to print is not the same as an empty string to print — the panel
  // hides the slot rather than rendering a label over a blank line.
  it('returns nothing for a blank or absent school', () => {
    expect(shortSchoolLabel('')).toBeUndefined();
    expect(shortSchoolLabel(undefined)).toBeUndefined();
  });
});

describe('isSelectableNode', () => {
  // An anonymous supporter is drawn and counted, and cannot be opened: the
  // panel prints a school, a year and a city, which together identify someone
  // about as surely as their name.
  it('refuses an anonymous supporter', () => {
    expect(isSelectableNode(donor('x', 'X', { anonymous: true }))).toBe(false);
  });

  // The ordinary case; without it the rule above could pass by refusing
  // everyone.
  it('allows a named supporter', () => {
    expect(isSelectableNode(donor('y', 'Y'))).toBe(true);
  });
});

describe('networkNodeDetail', () => {
  // The four fields the design direction lists for a selected node, in the
  // shortened form the narrow panel can actually fit.
  it('returns the identity a named supporter node panel prints', () => {
    const d = donor('m', 'Margaret Chen-Alvarez', {
      school: 'Harvard Business School',
      gradYear: 2004,
      location: 'San Francisco, CA',
      founding: true,
    });

    expect(networkNodeDetail(d)).toEqual({
      name: 'Margaret Chen-Alvarez',
      school: 'HBS',
      gradYear: 2004,
      location: 'San Francisco, CA',
      standing: FOUNDING_SUPPORTER_LABEL,
    });
  });

  // The design direction treats every node as a Founding Supporter, but the
  // giving levels survived the data-model plan — so a supporter without the
  // badge shows the level they actually gave at rather than an empty line.
  it('shows the giving level for a supporter without the founding badge', () => {
    const d = donor('j', 'Jonathan Feld', { tier: 'sustaining' });
    expect(networkNodeDetail(d, 'Sustaining Donors').standing).toBe('Sustaining Donors');
  });

  // Anonymity is applied upstream by donorPublicIdentity, not re-checked here —
  // this test is what proves the delegation actually holds.
  it('withholds every identity field for an anonymous supporter', () => {
    const d = donor('r', 'Robert K. Whitmore', {
      anonymous: true,
      school: 'Harvard Law School',
      gradYear: 1998,
      location: 'Greenwich, CT',
    });

    const detail = networkNodeDetail(d);
    expect(detail.name).toBe(ANONYMOUS_DONOR_LABEL);
    expect(detail.school).toBeUndefined();
    expect(detail.gradYear).toBeUndefined();
    expect(detail.location).toBeUndefined();
  });
});

describe('matchesNetworkSearch', () => {
  const aisha = donor('a', 'Aisha Rahman', {
    school: 'Harvard Kennedy School',
    location: 'London, United Kingdom',
  });

  // One of the two axes the direction names for find-your-place.
  it('matches on location', () => {
    expect(matchesNetworkSearch(aisha, 'london')).toBe(true);
  });

  // The other named axis, matched on the value the CMS dropdown stores.
  it('matches on the school name', () => {
    expect(matchesNetworkSearch(aisha, 'kennedy')).toBe(true);
  });

  // A supporter who knows themselves as "HKS" should not have to type the long
  // form, so the short label is searchable too.
  it('matches on the school short label', () => {
    expect(matchesNetworkSearch(aisha, 'hks')).toBe(true);
  });

  // Nobody types their city with the same capitalisation the record has.
  it('ignores case and surrounding whitespace', () => {
    expect(matchesNetworkSearch(aisha, '  LONDON  ')).toBe(true);
  });

  // The resting state of the search box is not a filter — an empty field must
  // not empty the network.
  it('matches everyone for a blank query', () => {
    expect(matchesNetworkSearch(aisha, '')).toBe(true);
    expect(matchesNetworkSearch(donor('z', 'Z'), '   ')).toBe(true);
  });

  // A search that matched everything would be a control that filters nothing.
  it('does not match on a value nobody carries', () => {
    expect(matchesNetworkSearch(aisha, 'reykjavik')).toBe(false);
  });

  // Deliberately NOT searchable by name: the search is for finding your school
  // or your city, and a name lookup is a different feature with a different
  // privacy question attached.
  it('does not match on the supporter name', () => {
    expect(matchesNetworkSearch(aisha, 'aisha')).toBe(false);
  });

  // The load-bearing privacy assertion on this function. A search box that
  // confirmed "yes, someone from Harvard Law class of 1998 in Greenwich gave"
  // would undo the anonymity the node itself protects.
  it('never matches an anonymous supporter, whatever the query', () => {
    const hidden = donor('r', 'Robert', {
      anonymous: true,
      school: 'Harvard Law School',
      location: 'Greenwich, CT',
    });

    expect(matchesNetworkSearch(hidden, 'greenwich')).toBe(false);
    expect(matchesNetworkSearch(hidden, 'law')).toBe(false);
    expect(matchesNetworkSearch(hidden, 'hls')).toBe(false);
  });
});

describe('searchNetwork', () => {
  // The list form of the predicate, which is what drives the highlight.
  it('returns the supporters a query selects', () => {
    const found = searchNetwork(population(), 'kennedy');
    expect(found.map((d) => d.slug)).toEqual(['a', 'b']);
  });

  // A highlight, not a destructive filter.
  it('returns everyone for a blank query', () => {
    expect(searchNetwork(population(), '')).toHaveLength(6);
  });

  // The miss has to be empty rather than everyone, or the summary line lies.
  it('returns nobody when nothing matches', () => {
    expect(searchNetwork(population(), 'reykjavik')).toEqual([]);
  });
});

describe('searchSummary', () => {
  // A count under an untouched search box would read as a result nobody asked
  // for.
  it('says nothing at all when the box is empty', () => {
    expect(searchSummary(6, '')).toBeUndefined();
  });

  // "1 supporters" is the small error that makes a page feel unfinished.
  it('counts a single match in the singular', () => {
    expect(searchSummary(1, 'london')).toBe('1 supporter in the network');
  });

  // The other half of the pluralisation, so neither branch can rot alone.
  it('counts several matches in the plural', () => {
    expect(searchSummary(4, 'college')).toBe('4 supporters in the network');
  });

  // The miss is a real answer on this page: someone searching their own school
  // before anyone from it has given should read a sentence, not a zero.
  it('answers a miss with an invitation rather than a count', () => {
    expect(searchSummary(0, 'reykjavik')).toBe('No supporters here yet — yours would be the first.');
  });
});

describe('supporterRoll', () => {
  // The roll is how a reader looks someone up, so it has to be scannable.
  it('sorts supporters alphabetically by displayed name', () => {
    const roll = supporterRoll(population());
    expect(roll[0].name).toBe('Aisha Rahman');
  });

  // Sorting on a withheld real name breaks the alphabetical run exactly where
  // the anonymous entries sit and hints at the hidden first letter — the same
  // reasoning groupDonorsByTier already documents.
  it('sorts an anonymous supporter under their displayed label, not their real name', () => {
    const donors = [
      donor('z', 'Zara Whitfield'),
      donor('r', 'Robert K. Whitmore', { anonymous: true }),
      donor('m', 'Margaret Chen-Alvarez'),
    ];

    expect(supporterRoll(donors).map((d) => d.slug)).toEqual(['r', 'm', 'z']);
  });

  // The same donor array feeds the graph and the roll; sorting in place would
  // silently reorder the nodes too.
  it('does not mutate the list it was given', () => {
    const donors = population();
    const before = donors.map((d) => d.slug);
    supporterRoll(donors);
    expect(donors.map((d) => d.slug)).toEqual(before);
  });
});

describe('NETWORK_COLORS', () => {
  // The direction rules colours OUT by name — no magenta, purple or cobalt. An
  // earlier pass reached a purple-magenta wash by BLOOMING crimson over navy
  // rather than by declaring it, so this pins the four declared values against
  // an edit that drifts them.
  it('is exactly the four colours the design direction specifies', () => {
    expect(NETWORK_COLORS).toEqual({
      // Near-black since the band became the page's hero. The node, edge and
      // active values are unchanged and still carry their documented meanings.
      background: '#07070A',
      node: '#A51034',
      edge: '#04979E',
      active: '#F6C76B',
    });
  });
});

// The band's heading is ONE CMS string carrying one emphasised phrase, so the
// asterisk syntax is what lets an editor move the emphasis without a developer.
// It reaches the page through `set:html`, which is why the escaping below is a
// safety property rather than a formatting nicety.
describe('headlineHtml', () => {
  // The feature: an asterisked run becomes the crimson italic phrase.
  it('turns an asterisked run into an em', () => {
    expect(headlineHtml('A grid, *lit from within*.')).toBe('A grid, <em>lit from within</em>.');
  });

  // A heading with no asterisks passes through unchanged, so every existing
  // heading keeps rendering exactly as it did before the syntax existed.
  it('leaves a plain heading untouched', () => {
    expect(headlineHtml('The people behind the fund')).toBe('The people behind the fund');
  });

  // The escaping is the load-bearing part. `set:html` renders whatever it is
  // handed and this value comes from a CMS field, so the only markup that may
  // reach the page is the em this function creates.
  it('escapes markup so only its own em can reach the page', () => {
    expect(headlineHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  // Ampersands and quotes are the two characters a heading is most likely to
  // contain innocently, and both break the attribute or entity parse if they
  // reach the page raw.
  it('escapes ampersands and quotes', () => {
    expect(headlineHtml('Tools & "toys"')).toBe('Tools &amp; &quot;toys&quot;');
  });

  // Escaping runs BEFORE the em substitution, so a heading carrying both real
  // markup and an asterisked phrase still yields exactly one element.
  it('escapes markup even when the heading also carries emphasis', () => {
    expect(headlineHtml('<b>x</b> and *this*')).toBe('&lt;b&gt;x&lt;/b&gt; and <em>this</em>');
  });

  // An unclosed asterisk is a typo an editor will make. It prints literally
  // rather than swallowing the rest of the heading into an em that never ends.
  it('leaves an unclosed asterisk as a literal character', () => {
    expect(headlineHtml('A grid, *lit from within')).toBe('A grid, *lit from within');
  });

  // Two separate phrases each get their own em rather than one spanning the
  // text between them.
  it('emphasises two phrases independently', () => {
    expect(headlineHtml('*one* and *two*')).toBe('<em>one</em> and <em>two</em>');
  });

  // A cleared CMS heading yields an empty string rather than markup, so the
  // band renders an empty h2 instead of stray characters.
  it('returns an empty string unchanged', () => {
    expect(headlineHtml('')).toBe('');
  });
});

// The unlit field behind the real supporters. It exists because the campaign
// starts empty and the design needs density — so the tests that matter most are
// the ones pinning that it can never be mistaken for supporter data.
describe('ambientField', () => {
  const rnd = () => 0.5;

  // At zero supporters the field carries the whole picture, so it is at its
  // densest — the production default on day one.
  it('fills an empty campaign with points', () => {
    const { points } = ambientField(0, 1100, 500, rnd);
    expect(points.length).toBeGreaterThan(0);
  });

  // The field RECEDES as real gifts arrive: capacity is fixed, so each real
  // supporter displaces an ambient point. Without this the picture would stay
  // padded forever and its density would never come to mean anything.
  it('yields fewer points as real supporters arrive', () => {
    const empty = ambientField(0, 1100, 500, rnd).points.length;
    const busy = ambientField(200, 1100, 500, rnd).points.length;
    expect(busy).toBeLessThan(empty);
  });

  // Past capacity there is nothing left to pad, so the field disappears rather
  // than going negative or drawing a stray row.
  it('returns nothing once supporters exceed the frame capacity', () => {
    const { points, edges } = ambientField(100000, 1100, 500, rnd);
    expect(points).toEqual([]);
    expect(edges).toEqual([]);
  });

  // Not reachable through the UI, but cheap to make total — and zero is the
  // only sensible reading of a negative count.
  it('treats a negative supporter count as zero', () => {
    const negative = ambientField(-5, 1100, 500, rnd).points.length;
    const zero = ambientField(0, 1100, 500, rnd).points.length;
    expect(negative).toBe(zero);
  });

  // THE HONESTY GUARANTEE, pinned. An ambient point carries no slug, no school
  // and no `selectable` — nothing a consumer could read as a person, which is
  // what keeps the field from ever being counted, searched or opened.
  it('gives an ambient point no identity of any kind', () => {
    const { points } = ambientField(0, 1100, 500, rnd);
    expect(Object.keys(points[0]).sort()).toEqual(['r', 'x', 'y']);
  });

  // The points are wired, and that wiring is what makes the field read as a
  // lattice rather than as scattered dots — the difference the recomposition
  // turned on.
  it('wires the points together', () => {
    const { points, edges } = ambientField(0, 1100, 500, rnd);
    expect(edges.length).toBeGreaterThan(points.length);
  });

  // Every point stays inside the drawn frame, so none is clipped at an edge or
  // stranded outside the viewBox where it would silently cost density.
  it('keeps every point within the frame', () => {
    const width = 1100;
    const height = 500;
    const { points } = ambientField(0, width, height, () => 0.99);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(height);
    }
  });

  // Ambient points draw SMALLER than a supporter's 3.2 radius. Size is one of
  // the two cues separating them; the other is the bloom, which is CSS.
  it('draws every point smaller than an ordinary supporter', () => {
    const { points } = ambientField(0, 1100, 500, () => 0.999);
    for (const p of points) expect(p.r).toBeLessThan(3.2);
  });

  // Seeded and reproducible, for the reason `networkRng` documents: a field
  // that reshuffled per render would change under a reviewed screenshot.
  it('is reproducible for the same stream', () => {
    const a = ambientField(10, 900, 400, () => 0.25).points;
    const b = ambientField(10, 900, 400, () => 0.25).points;
    expect(a).toEqual(b);
  });
});
