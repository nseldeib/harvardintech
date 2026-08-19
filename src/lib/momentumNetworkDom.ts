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
    node.addEventListener('pointerenter', activate);
    node.addEventListener('click', () => select(node.dataset.networkNode ?? null));
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
