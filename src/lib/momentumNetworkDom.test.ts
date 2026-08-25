import { describe, it, expect, beforeEach } from 'vitest';
import { initMomentumNetwork, applyNetworkGreeting } from './momentumNetworkDom';
import { SUPPORTER_PARAM } from './supporterBadge';

/** The markup the component server-renders, trimmed to what the wiring reads. */
function renderNetwork(): void {
  const details = {
    margaret: {
      name: 'Margaret Chen-Alvarez',
      school: 'HBS',
      gradYear: 2004,
      location: 'San Francisco, CA',
      standing: 'Founding Supporter',
      shareMessage: 'I contributed because it mattered.',
      shareUrl: 'https://example.com/donate?supporter=margaret',
      linkedInUrl: 'https://www.linkedin.com/sharing/share-offsite/?url=margaret',
      facebookUrl: 'https://www.facebook.com/sharer/sharer.php?u=margaret',
    },
    ben: {
      name: 'Ben Wei',
      school: 'HKS',
      standing: 'Sustaining Donors',
      shareMessage: 'Happy to help.',
      linkedInUrl: 'https://www.linkedin.com/sharing/share-offsite/?url=ben',
      facebookUrl: 'https://www.facebook.com/sharer/sharer.php?u=ben',
    },
  };

  document.body.innerHTML = `
    <section data-momentum-network>
      <div data-network-stage>
        <svg>
          <g>
            <line data-network-edge="margaret|ben"></line>
            <line data-network-edge="ben|nina"></line>
          </g>
          <g>
            <circle data-network-node="margaret" data-selectable="true"
                    data-network-haystack="harvard business school hbs san francisco, ca"></circle>
            <circle data-network-node="ben" data-selectable="true"
                    data-network-haystack="harvard kennedy school hks boston, ma"></circle>
            <circle data-network-node="nina" data-selectable="false"
                    data-network-haystack=""></circle>
          </g>
        </svg>
        <div data-network-panel hidden>
          <button data-network-dismiss>x</button>
          <p data-network-field="name"></p>
          <p data-network-field="standing"></p>
          <p data-network-field="school"></p>
          <p data-network-field="location"></p>
          <div data-network-share hidden>
            <textarea data-network-share-message></textarea>
            <a data-network-share-linkedin href="#">LinkedIn</a>
            <a data-network-share-facebook href="#">Facebook</a>
          </div>
        </div>
      </div>
      <input type="search" data-network-search />
      <p data-network-summary></p>
      <button data-network-sound aria-pressed="true">Sound on</button>
      <ul>
        <li><button data-network-roll-entry="ben">Ben Wei</button></li>
      </ul>
      <script type="application/json" data-network-details>${JSON.stringify(details)}</script>
    </section>`;
}

const node = (slug: string) =>
  document.querySelector<SVGElement>(`[data-network-node="${slug}"]`)!;
const panel = () => document.querySelector<HTMLElement>('[data-network-panel]')!;
const field = (key: string) =>
  document.querySelector<HTMLElement>(`[data-network-field="${key}"]`)!;

beforeEach(() => {
  window.history.replaceState(null, '', '/donate');
});

describe('initMomentumNetwork', () => {
  // The band is one section of /donate, not the whole page, and the module is
  // imported by the page bundle regardless. A throw here would take the whole
  // campaign page down.
  it('does nothing when the network is not on the page', () => {
    document.body.innerHTML = '<main>No network here</main>';
    expect(() => initMomentumNetwork()).not.toThrow();
  });

  // The empty state renders the band without a graph, and the same page bundle
  // still runs this.
  it('does nothing when the network renders no nodes', () => {
    document.body.innerHTML = '<section data-momentum-network></section>';
    expect(() => initMomentumNetwork()).not.toThrow();
  });

  // The server ships the panel hidden; init must not open it, or every visitor
  // arrives with a stranger's card already on screen.
  it('leaves the panel closed until something is selected', () => {
    renderNetwork();
    initMomentumNetwork();
    expect(panel().hidden).toBe(true);
  });
});

describe('selecting a supporter', () => {
  beforeEach(() => {
    renderNetwork();
    initMomentumNetwork();
  });

  // The core interaction the design direction describes for a selected node.
  it('opens the panel with that supporter identity', () => {
    node('margaret').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(panel().hidden).toBe(false);
    expect(field('name').textContent).toBe('Margaret Chen-Alvarez');
    expect(field('standing').textContent).toBe('Founding Supporter');
    expect(field('school').textContent).toBe('HBS · 2004');
    expect(field('location').textContent).toBe('San Francisco, CA');
  });

  // "All other nodes should remain crimson" — gold is reserved for the one
  // node being read.
  it('marks the selected node and only that node', () => {
    node('margaret').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(node('margaret').classList.contains('is-selected')).toBe(true);
    expect(node('ben').classList.contains('is-selected')).toBe(false);
  });

  // "Brighten its immediate teal connections" — the selected supporter's OWN
  // edges, read from the endpoints the server wrote, not re-derived here.
  it('marks only the edges touching the selected supporter', () => {
    node('margaret').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const live = Array.from(document.querySelectorAll('[data-network-edge]'))
      .filter((edge) => edge.classList.contains('is-live'))
      .map((edge) => (edge as HTMLElement).dataset.networkEdge);

    expect(live).toEqual(['margaret|ben']);
  });

  // A slot with nothing to show is hidden rather than emptied, so the panel
  // never renders a stray label over a blank line.
  it('hides a field the supporter did not fill in', () => {
    node('ben').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(field('school').textContent).toBe('HKS');
    expect(field('location').hidden).toBe(true);
  });

  // The link a supporter posts and the badge they are looking at must be for
  // the same person.
  it('points the share links at that supporter own url', () => {
    node('margaret').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(
      document.querySelector<HTMLAnchorElement>('[data-network-share-linkedin]')!.href,
    ).toContain('margaret');
    expect(
      document.querySelector<HTMLAnchorElement>('[data-network-share-facebook]')!.href,
    ).toContain('margaret');
  });

  // The other half of a shareable badge: the url a supporter copies has to be
  // the url that reopens it.
  it('names the supporter in the address bar', () => {
    node('margaret').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(new URL(window.location.href).searchParams.get(SUPPORTER_PARAM)).toBe('margaret');
  });

  // A stale ?supporter= left behind would reopen someone else's badge on the
  // next reload or share of that url.
  it('clears the address bar and closes the panel on dismiss', () => {
    node('margaret').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document
      .querySelector<HTMLElement>('[data-network-dismiss]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(panel().hidden).toBe(true);
    expect(new URL(window.location.href).searchParams.get(SUPPORTER_PARAM)).toBeNull();
  });

  // An anonymous supporter's node is drawn and counted and stays inert — no
  // panel, so nothing invites a visitor to try to identify them.
  it('does not open a panel for an anonymous supporter node', () => {
    node('nina').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(panel().hidden).toBe(true);
    expect(new URL(window.location.href).searchParams.get(SUPPORTER_PARAM)).toBeNull();
  });

  // The roll is the route into a supporter that works by keyboard alone without
  // hunting a circle in an SVG — the accessible path to the same content.
  it('opens a supporter from their row in the roll', () => {
    document
      .querySelector<HTMLElement>('[data-network-roll-entry="ben"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(panel().hidden).toBe(false);
    expect(field('name').textContent).toBe('Ben Wei');
  });
});

describe('opening from a shared link', () => {
  // The other half of a shareable badge: following the link has to arrive at
  // the person, not at the page.
  it('opens straight to the supporter the url names', () => {
    window.history.replaceState(null, '', `/donate?${SUPPORTER_PARAM}=margaret`);
    renderNetwork();
    initMomentumNetwork();

    expect(panel().hidden).toBe(false);
    expect(field('name').textContent).toBe('Margaret Chen-Alvarez');
  });

  // A stale or hand-typed link lands on the network rather than erroring.
  it('ignores a slug that names nobody', () => {
    window.history.replaceState(null, '', `/donate?${SUPPORTER_PARAM}=nobody`);
    renderNetwork();
    initMomentumNetwork();

    expect(panel().hidden).toBe(true);
  });

  // An anonymous supporter's slug in a url must not open what their node will
  // not — otherwise the deep link is a way around the anonymity rule.
  it('ignores an anonymous supporter slug', () => {
    window.history.replaceState(null, '', `/donate?${SUPPORTER_PARAM}=nina`);
    renderNetwork();
    initMomentumNetwork();

    expect(panel().hidden).toBe(true);
  });
});

describe('searching the network', () => {
  beforeEach(() => {
    renderNetwork();
    initMomentumNetwork();
  });

  const search = () => document.querySelector<HTMLInputElement>('[data-network-search]')!;
  const summary = () => document.querySelector<HTMLElement>('[data-network-summary]')!;

  const type = (value: string) => {
    search().value = value;
    search().dispatchEvent(new Event('input', { bubbles: true }));
  };

  // Find-your-place is a highlight over the whole network rather than a filter
  // that removes people from it.
  it('highlights the matches and dims the rest', () => {
    type('kennedy');

    expect(node('ben').classList.contains('is-found')).toBe(true);
    expect(node('margaret').classList.contains('is-dimmed')).toBe(true);
  });

  // The count is how a visitor knows the search ran at all on a dense graph.
  it('counts what it found', () => {
    type('kennedy');
    expect(summary().textContent).toBe('1 supporter in the network');
  });

  // Searching your own school before anyone from it has given is a likely first
  // experience, and it should read as an opening rather than a zero.
  it('answers a miss with an invitation rather than a count', () => {
    type('reykjavik');
    expect(summary().textContent).toBe('No supporters here yet — yours would be the first.');
  });

  // The resting state is not a filter — emptying the box must restore the whole
  // network rather than leaving it dimmed.
  it('restores every node when the box is emptied', () => {
    type('kennedy');
    type('');

    expect(node('margaret').classList.contains('is-dimmed')).toBe(false);
    expect(node('ben').classList.contains('is-found')).toBe(false);
    expect(summary().textContent).toBe('');
  });

  // The anonymous node carries an empty haystack, so it can never match however
  // the query is typed — the search cannot become a way to confirm who gave.
  it('never matches the anonymous supporter node', () => {
    type('a');
    expect(node('nina').classList.contains('is-found')).toBe(false);
  });
});

describe('the sound control', () => {
  beforeEach(() => {
    renderNetwork();
    initMomentumNetwork();
  });

  const toggle = () => document.querySelector<HTMLButtonElement>('[data-network-sound]')!;

  // The direction asks for a VISIBLE control; a button that does not say what
  // is true is not one.
  it('reports the state it is in', () => {
    expect(toggle().textContent).toBe('Sound on');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
  });

  // Both the label and aria-pressed have to move, or the control lies to one
  // audience or the other.
  it('switches off and says so', () => {
    toggle().dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(toggle().textContent).toBe('Sound off');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
  });

  // A toggle that only travels one way is a mute button, not a toggle.
  it('switches back on', () => {
    toggle().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    toggle().dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(toggle().textContent).toBe('Sound on');
  });

  // Hovering a node must never throw, whatever the browser does about audio —
  // the same handler drives the hover highlight.
  it('survives a pointer entering a node with no audio available', () => {
    expect(() =>
      node('margaret').dispatchEvent(new Event('pointerenter', { bubbles: true })),
    ).not.toThrow();
  });
});

// The greeting the campaign email's `?name=` produces over the grid.
//
// The band became the page's hero, so it inherited the personalization the photo
// hero used to carry — but on different terms: an EXTRA line for a named arrival
// rather than a headline swap, because this band's headline is its composition.
// That asymmetry is the whole rule, and these cover both halves of it.
describe('applyNetworkGreeting', () => {
  const greeting = () => document.querySelector<HTMLElement>('[data-network-greeting]')!;

  function renderGreeting(attrs = ''): void {
    document.body.innerHTML = `
      <p class="network-greeting" data-network-greeting
         data-named="{name}, let's go further together." ${attrs} hidden></p>`;
  }

  beforeEach(() => renderGreeting());

  // The half the campaign pays for: the merge tag's name reaches the band and
  // the line becomes visible, rather than staying the hidden placeholder it
  // renders as for everyone else.
  it('greets a subscriber arriving from the campaign email', () => {
    applyNetworkGreeting('?name=Nicole');

    expect(greeting().textContent).toBe("Nicole, let's go further together.");
    expect(greeting().hidden).toBe(false);
  });

  // The public visitor is the majority, and the design they see is the one the
  // team directed. No name means no line at all — NOT a generic greeting sitting
  // in the slot, which is what the old hero would have done here.
  it('shows nothing at all to a visitor with no name in the link', () => {
    applyNetworkGreeting('');

    expect(greeting().hidden).toBe(true);
    expect(greeting().textContent).toBe('');
  });

  // This URL gets mailed to the whole list and forwarded onward, so a crafted
  // `?name=` is a plausible attack rather than a hypothetical one. It must
  // degrade to the un-greeted page, never render attacker-chosen text.
  it('refuses a name that is not plausibly a name', () => {
    applyNetworkGreeting('?name=%3Cscript%3Ealert(1)%3C%2Fscript%3E');

    expect(greeting().hidden).toBe(true);
    expect(greeting().textContent).toBe('');
  });

  // A scenario pins the greeting server-side so it can be captured; the capture
  // harness never carries a `?name=`, so recomputing would blank the very thing
  // the frame exists to show.
  it('leaves a server-pinned greeting alone', () => {
    renderGreeting('data-preview="true"');
    greeting().textContent = "Ben, let's go further together.";
    greeting().hidden = false;

    applyNetworkGreeting('?name=Nicole');

    expect(greeting().textContent).toBe("Ben, let's go further together.");
  });

  // Every other route, and /donate before the band is on the page.
  it('no-ops when the band is absent', () => {
    document.body.innerHTML = '';

    expect(() => applyNetworkGreeting('?name=Nicole')).not.toThrow();
  });
});
