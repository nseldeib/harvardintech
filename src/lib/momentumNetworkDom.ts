// Interaction wiring for The Momentum Network — hover, selection, search, sound.
//
// Progressive enhancement in the `./donorFilter.ts` mould, and for a stronger
// reason than usual: the SVG itself is rendered on the SERVER from
// `networkLayout`, so the network is a real picture in the HTML before this file
// loads. Nothing here draws anything. It adds the parts that need a pointer —
// which is why the whole module no-ops cleanly when the band is absent, and why
// with JavaScript off a visitor still sees the grid and still reads every name
// in the roll beneath it.

import {
  shouldPlayActivation,
  soundEnabledByDefault,
  soundToggleLabel,
  playActivationTone,
  type SoundState,
} from './networkSound';
import { SUPPORTER_PARAM } from './supporterBadge';
import { sanitizeFirstName, nameFromSearch } from './personalize';

/**
 * Greet a visitor who arrived from the campaign email with `?name=`.
 *
 * Deliberately asymmetric with the old photo hero's personalization, which
 * chose between a named and a generic headline. This band's headline is its
 * composition, so the greeting is an EXTRA line instead: a named arrival gets
 * it, everyone else gets the page unchanged. That is why there is no generic
 * fallback text here — no name means the element simply stays hidden, and a
 * visitor without one never sees an empty slot where a greeting would go.
 *
 * `data-preview` means a scenario pinned the greeting on the server so it can
 * be captured; leave that alone rather than recomputing it from a URL the
 * capture harness never carries.
 *
 * SECURITY: the name is attacker-controllable (this URL gets mailed to the
 * whole list and forwarded onward). `sanitizeFirstName` rejects anything that
 * isn't plausibly a first name, and the result is written with `textContent`,
 * never `innerHTML` — so a hostile `?name=` renders no greeting at all rather
 * than attacker-chosen text under Harvard's brand.
 *
 * Exported and DOM-injectable so the whole rule is unit-testable without a
 * browser or a built page.
 */
export function applyNetworkGreeting(
  search: string | null | undefined,
  scope: ParentNode | null = typeof document === 'undefined' ? null : document,
): void {
  if (!scope) return;

  const el = scope.querySelector<HTMLElement>('[data-network-greeting]');
  if (!el || el.dataset.preview === 'true') return;

  const named = el.dataset.named ?? '';
  const name = sanitizeFirstName(nameFromSearch(search));
  if (name === null || !named.includes('{name}')) return;

  el.textContent = named.replace(/\{name\}/g, name);
  el.hidden = false;
}

/** What the panel needs about one supporter, as the server hands it over. */
export interface NetworkDetailRecord {
  name: string;
  school?: string;
  gradYear?: number;
  location?: string;
  standing?: string;
  /** Precomposed on the server so the share text and the badge cannot disagree. */
  shareMessage?: string;
  /** This supporter's own address on the network. */
  shareUrl?: string;
  linkedInUrl?: string;
  facebookUrl?: string;
}

/**
 * Idempotent DOM wiring. No-op under SSR / vitest, and no-op when the band is
 * not on the page — /donate without a `donors` section, and every other route.
 */
export function initMomentumNetwork(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const root = document.querySelector<HTMLElement>('[data-momentum-network]');
  if (!root) return;

  const nodes = Array.from(root.querySelectorAll<SVGElement>('[data-network-node]'));
  if (nodes.length === 0) return;

  const details = readDetails(root);
  const panel = root.querySelector<HTMLElement>('[data-network-panel]');
  const search = root.querySelector<HTMLInputElement>('[data-network-search]');
  const summary = root.querySelector<HTMLElement>('[data-network-summary]');
  const toggle = root.querySelector<HTMLButtonElement>('[data-network-sound]');
  const stage = root.querySelector<HTMLElement>('[data-network-stage]');
  const hover = root.querySelector<HTMLElement>('[data-network-hover]');

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const sound: SoundState = {
    enabled: soundEnabledByDefault(reduced),
    lastPlayedAt: 0,
  };

  // The context is created on the FIRST real interaction, never on load: a page
  // that builds an AudioContext before the visitor has touched anything gets it
  // suspended by the browser's autoplay policy, and every later pulse is silent
  // with no error to notice.
  let ctx: AudioContext | null = null;
  const activate = () => {
    if (!shouldPlayActivation(sound, performance.now())) return;
    sound.lastPlayedAt = performance.now();
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx ??= new Ctor();
      if (ctx.state === 'suspended') void ctx.resume();
      playActivationTone(ctx);
    } catch {
      // A browser that refuses audio costs the visitor the pulse and nothing
      // else — never the hover highlight this handler also drives.
    }
  };

  if (toggle) {
    const render = () => {
      toggle.setAttribute('aria-pressed', String(sound.enabled));
      toggle.textContent = soundToggleLabel(sound.enabled);
    };
    toggle.addEventListener('click', () => {
      sound.enabled = !sound.enabled;
      render();
    });
    render();
  }

  const edges = Array.from(root.querySelectorAll<SVGElement>('[data-network-edge]'));

  /** Keep the address bar in step with what is open, so the URL a supporter
   *  copies is the URL that reopens their badge. `replaceState`, not `pushState`:
   *  clicking through six nodes should not bury the page under six history
   *  entries a visitor has to press Back through to leave. */
  const syncUrl = (slug: string | null) => {
    try {
      const url = new URL(window.location.href);
      if (slug) url.searchParams.set(SUPPORTER_PARAM, slug);
      else url.searchParams.delete(SUPPORTER_PARAM);
      window.history.replaceState(null, '', url);
    } catch {
      // A browser that refuses history access costs the shareable URL and
      // nothing else — never the selection the visitor actually asked for.
    }
  };

  /**
   * The hover preview: name, then school · class year.
   *
   * Reads the SAME `details` map the panel reads, which is what carries the
   * anonymity guarantee into this feature for free — an anonymous supporter has
   * no entry there, so `detail` is undefined and nothing is shown. The node loop
   * below also skips them outright. Two independent reasons the preview cannot
   * name someone who asked not to be named.
   */
  const showHover = (node: Element) => {
    if (!hover || !stage) return;
    const slug = (node as HTMLElement).dataset?.networkNode ?? '';
    const detail = details[slug];
    if (!detail) return;

    const setField = (key: string, value: string) => {
      const slot = hover.querySelector<HTMLElement>(`[data-network-hover-field="${key}"]`);
      if (slot) slot.textContent = value;
    };

    setField('name', detail.name);
    setField(
      'meta',
      [detail.school, detail.gradYear ? String(detail.gradYear) : undefined]
        .filter(Boolean)
        .join(' · '),
    );

    hover.hidden = false;

    // Positioned from the NODE's own box, not the pointer's coordinates.
    // Pointer coordinates would work for hover and be unavailable for focus,
    // and this card has to serve both: hover has no keyboard equivalent and no
    // touch equivalent, so a preview only reachable by pointer is a preview
    // half the visitors cannot get to. Anchoring to the node gives one
    // code path and puts the card in the same place either way.
    //
    // Measured against the stage rather than the page so the card travels with
    // the artwork instead of drifting on scroll. Guarded because
    // `getBoundingClientRect` is absent under JSDOM, where an unguarded call
    // would throw inside the handler and take the whole feature down with it.
    if (
      typeof stage.getBoundingClientRect !== 'function' ||
      typeof node.getBoundingClientRect !== 'function'
    ) {
      return;
    }
    const stageBox = stage.getBoundingClientRect();
    const nodeBox = node.getBoundingClientRect();
    hover.style.left = `${nodeBox.right - stageBox.left + 14}px`;
    hover.style.top = `${nodeBox.top - stageBox.top - 8}px`;
  };

  const hideHover = () => {
    if (hover) hover.hidden = true;
  };

  const select = (slug: string | null) => {
    for (const node of nodes) {
      node.classList.toggle('is-selected', slug !== null && node.dataset.networkNode === slug);
    }

    // "Brighten its immediate teal connections" — the direction asks for the
    // selected supporter's OWN edges, not the whole web. The server wrote each
    // edge's two endpoints into its data attribute, so which edges are
    // "immediate" is answered by reading the DOM rather than by re-deriving the
    // layout in the browser, where a second copy could disagree with the drawn
    // one.
    for (const edge of edges) {
      const ends = (edge.dataset.networkEdge ?? '').split('|');
      edge.classList.toggle('is-live', slug !== null && ends.includes(slug));
    }

    root.classList.toggle('is-selecting', slug !== null);
    syncUrl(details[slug ?? ''] ? slug : null);
    if (!panel) return;

    const detail = slug ? details[slug] : undefined;
    panel.hidden = !detail;
    if (!detail) return;
    fillPanel(panel, detail);
  };

  for (const node of nodes) {
    // Only selectable nodes react. An anonymous supporter's node is drawn and
    // counted, and stays inert — no pointer cursor, no panel, no sound, so
    // nothing about it invites a visitor to try to identify them.
    if (node.dataset.selectable !== 'true') continue;

    // pointerenter, NOT pointerover: `over` refires as the pointer crosses the
    // child elements inside one node, which would retrigger the sound several
    // times on a single node — exactly the "continuously while hovering" the
    // direction rules out.
    node.addEventListener('pointerenter', () => {
      activate();
      showHover(node);
    });
    node.addEventListener('pointerleave', hideHover);
    // The keyboard route to the same preview. Every selectable node already
    // carries `tabindex="0"` and `role="button"` for the panel, so without this
    // a keyboard user could OPEN a supporter but never skim one.
    node.addEventListener('focus', () => showHover(node));
    node.addEventListener('blur', hideHover);
    // A click promotes the preview into the full badge, so the small card would
    // otherwise sit on top of the panel it just opened.
    node.addEventListener('click', () => {
      hideHover();
      select(node.dataset.networkNode ?? null);
    });
    node.addEventListener('keydown', (event) => {
      const key = (event as KeyboardEvent).key;
      if (key !== 'Enter' && key !== ' ') return;
      event.preventDefault();
      activate();
      select(node.dataset.networkNode ?? null);
    });
  }

  root.querySelector<HTMLElement>('[data-network-dismiss]')?.addEventListener('click', () => select(null));

  // The roll beneath the graphic selects nodes too. It is the only route into a
  // supporter that works by keyboard alone without hunting a circle in an SVG,
  // and it is how a screen-reader user reaches the same content — so it is the
  // accessible path to the feature, not a convenience.
  /** Bring the graphic into view, where the environment can. Guarded because
   *  `scrollIntoView` is not universal — it is absent under JSDOM, and an
   *  unguarded call throws INSIDE the click handler, after the selection has
   *  already been made. That is the worst shape for this bug: the feature looks
   *  like it worked while the handler died partway through. */
  const revealStage = (behavior?: ScrollBehavior) => {
    const stage = root.querySelector<HTMLElement>('[data-network-stage]');
    if (typeof stage?.scrollIntoView !== 'function') return;
    stage.scrollIntoView({ block: 'center', behavior });
  };

  for (const entry of Array.from(root.querySelectorAll<HTMLElement>('[data-network-roll-entry]'))) {
    entry.addEventListener('click', () => {
      select(entry.dataset.networkRollEntry ?? null);
      revealStage('smooth');
    });
  }

  // Open straight to a supporter when the URL names one — the other half of the
  // shareable badge. Only a slug with a detail record opens, so a stale or
  // hand-typed link (or an anonymous supporter's slug) lands on the network
  // rather than erroring.
  try {
    const wanted = new URL(window.location.href).searchParams.get(SUPPORTER_PARAM);
    if (wanted && details[wanted]) {
      select(wanted);
      revealStage();
    }
  } catch {
    // No URL access — the network still works, it just cannot be deep-linked.
  }

  if (search) {
    search.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      let matched = 0;

      for (const node of nodes) {
        // The server wrote what each node is searchable ON, already filtered for
        // anonymity — an anonymous node carries an empty haystack, so it can
        // never match however the query is typed.
        //
        // Named `haystack`, NOT `search`: the input is `[data-network-search]`,
        // and when the nodes carried that attribute too, `querySelector` for the
        // input returned the first CIRCLE instead and the search silently did
        // nothing.
        const haystack = node.dataset.networkHaystack ?? '';
        const hit = query.length === 0 || (haystack.length > 0 && haystack.includes(query));
        node.classList.toggle('is-dimmed', query.length > 0 && !hit);
        node.classList.toggle('is-found', query.length > 0 && hit);
        if (query.length > 0 && hit) matched += 1;
      }

      root.classList.toggle('is-searching', query.length > 0);
      if (summary) summary.textContent = summaryText(matched, query);
    });
  }
}

/** The summary line. Mirrors `searchSummary`, which owns the wording. */
function summaryText(matches: number, query: string): string {
  if (query.length === 0) return '';
  if (matches === 0) return 'No supporters here yet — yours would be the first.';
  return matches === 1 ? '1 supporter in the network' : `${matches} supporters in the network`;
}

/** The server's detail payload, or an empty map when it is absent or malformed —
 *  a broken payload should cost the panel, never the whole visualization. */
function readDetails(root: HTMLElement): Record<string, NetworkDetailRecord> {
  const script = root.querySelector<HTMLScriptElement>('[data-network-details]');
  if (!script?.textContent) return {};
  try {
    return JSON.parse(script.textContent) as Record<string, NetworkDetailRecord>;
  } catch {
    return {};
  }
}

/** Write one supporter into the panel's slots. A slot with nothing to show is
 *  hidden rather than emptied, so the panel never renders a stray label over a
 *  blank line for a supporter who left a field unset. */
function fillPanel(panel: HTMLElement, detail: NetworkDetailRecord): void {
  const set = (key: string, value?: string) => {
    const slot = panel.querySelector<HTMLElement>(`[data-network-field="${key}"]`);
    if (!slot) return;
    slot.textContent = value ?? '';
    slot.hidden = !value;
  };

  set('name', detail.name);
  set('standing', detail.standing);
  set('location', detail.location);
  set(
    'school',
    [detail.school, detail.gradYear ? String(detail.gradYear) : undefined]
      .filter(Boolean)
      .join(' · ') || undefined,
  );

  const share = panel.querySelector<HTMLTextAreaElement>('[data-network-share-message]');
  if (share) share.value = detail.shareMessage ?? '';

  // Point the share links at THIS supporter's url. The server precomputed both,
  // so the link a supporter posts and the badge they are looking at can never be
  // for two different people.
  const linkedIn = panel.querySelector<HTMLAnchorElement>('[data-network-share-linkedin]');
  if (linkedIn) linkedIn.href = detail.linkedInUrl ?? '#';
  const facebook = panel.querySelector<HTMLAnchorElement>('[data-network-share-facebook]');
  if (facebook) facebook.href = detail.facebookUrl ?? '#';

  const shareBox = panel.querySelector<HTMLElement>('[data-network-share]');
  if (shareBox) shareBox.hidden = !detail.shareMessage;
}
