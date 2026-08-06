// Shared progress on the domain cutover.
//
// Two things live here, and the split is the point:
//
//   1. The runbook's STRUCTURE — the nine steps, the five decisions, which
//      decision blocks which step, who owns each step, when it happens, and what
//      goes wrong if it goes wrong. This is authored prose. It is the same for
//      every reader and every scenario, so it is code, not data.
//   2. The runbook's STATE — what has actually been ticked. This is the
//      `cutoverProgress.json` singleton, written from the page itself via the
//      CMS's GitHub commit path and seeded per scenario by codeyam.
//
// Keeping them apart is what lets a scenario show "partway through" by supplying
// five booleans instead of restating the whole runbook, and what stops an editor
// from accidentally rewriting the migration plan while ticking a box.
//
// The state file is read through `readSingleton` so it honours the codeyam
// sandbox redirect (`dataRoot()`), the same as settings/nav.
import { readSingleton } from './contentRoot';

/** When a step happens relative to the switch itself. */
export type Phase = 'before' | 'day' | 'after';

/** Who is on the hook for a step. */
export type Owner = 'jared' | 'login-holder' | 'team';

/** One of the nine steps, as authored. */
export interface StepDef {
  id: string;
  title: string;
  /** The plain-language line the team reads. */
  summary: string;
  /** What a bad outcome looks like, how we'd know, how fast. */
  risk: string;
  /** True when the step changes something visitors or search engines can see. */
  touchesLive: boolean;
  owner: Owner;
  phase: Phase;
  /** Rough wall-clock, in the form the page prints. */
  duration: string;
  /** Decision ids that must be answered before this step can start. */
  needs: string[];
  /**
   * A standing note that shows regardless of state.
   *
   * The steps used to carry two kinds of note in one slot: "Needs D1 answered"
   * — which is now derived from `needs` and disappears once the decision lands —
   * and notes like S7's "never replace all records", which are true forever.
   * Deriving the first kind and then dropping the second is how S7 briefly lost
   * the most important instruction on the page, so the standing ones are their
   * own field. `html` because the originals carry inline <code>.
   */
  note?: { label: string; html: string };
}

/** One of the five open decisions, as authored. */
export interface DecisionDef {
  id: string;
  question: string;
  /** The stated suggestion. The team still decides; the page stops being neutral. */
  recommendation: string;
  /** Why that suggestion, in one line. */
  because: string;
  /** Step ids this decision holds up. */
  blocks: string[];
}

/** The ticked state of one step, as stored. */
export interface StepState {
  id: string;
  done: boolean;
  /** GitHub login of whoever ticked it. Absent while untouched. */
  by?: string;
  /** ISO timestamp of the tick. Absent while untouched. */
  at?: string;
}

/** The answered state of one decision, as stored. */
export interface DecisionState {
  id: string;
  answered: boolean;
  /** What was decided, in the team's own words. */
  answer?: string;
  by?: string;
  at?: string;
}

export interface CutoverProgress {
  steps: StepState[];
  decisions: DecisionState[];
}

/**
 * The nine steps, in order. Reversible ones first — that ordering is the plan's
 * central safety property, not a presentation choice, so it lives in the data.
 */
export const STEPS: StepDef[] = [
  {
    id: 'S1',
    title: 'Re-check what’s there now',
    summary:
      'Read the domain’s current settings and write them down before changing anything. The last look was 2026-07-02, and a record that has quietly changed since is exactly what turns a clean cutover into an outage.',
    risk:
      'Nothing can go wrong here — this step only reads. The risk is skipping it: every later step assumes the records still look the way discovery found them.',
    touchesLive: false,
    owner: 'login-holder',
    phase: 'before',
    duration: '15 minutes',
    needs: ['D1'],
  },
  {
    id: 'S2',
    title: 'Prove it on a real subdomain',
    summary:
      'Run the new site on review.harvardintech.com — a real subdomain of the real domain, with a real certificate — before touching the address people actually use.',
    risk:
      'If the new site behaves differently on the real domain than in preview, this is where it shows up, while harvardintech.com is completely untouched. A mistake here affects one subdomain nobody has been given yet.',
    touchesLive: false,
    owner: 'login-holder',
    phase: 'before',
    duration: 'Minutes to set up, then wait for the certificate',
    needs: ['D1'],
    note: {
      label: 'Note',
      html: 'The gated review track already exists, so this costs one DNS record and no new setup.',
    },
  },
  {
    id: 'S3',
    title: 'Work out where old links should land',
    summary:
      'Links to the old site exist in emails, on LinkedIn, in other people’s posts. Where an old address doesn’t match a new one, catch it and send the visitor to the right page instead of a dead end.',
    risk:
      'Gets weaker with search engines than with people: a static host can’t issue a real redirect, so Google treats it far more weakly than a permanent move. Some ranking on changed paths is lost. Humans following old links land correctly.',
    touchesLive: false,
    owner: 'jared',
    phase: 'before',
    duration: 'Half a day',
    needs: [],
    note: {
      label: 'Honest limit',
      html: "This works for people; it's weaker for Google. See the detail.",
    },
  },
  {
    id: 'S4',
    title: 'Tell the host which domain it’s serving',
    summary:
      'A one-line file naming the domain. Without it the host serves the site but doesn’t know it should answer to harvardintech.com.',
    risk:
      'Invisible to visitors; nothing changes for anyone until the records move in S7. The one trap is ordering — done in the wrong order the review site claims the main domain and the two fight over it.',
    touchesLive: false,
    owner: 'jared',
    phase: 'before',
    duration: 'Minutes',
    needs: [],
  },
  {
    id: 'S5',
    title: 'Take the passphrase off',
    summary:
      'The moment the site stops being private. One change removes the passphrase and tells search engines they may index the site.',
    risk:
      'The step that can’t be quietly undone: search engines start reading immediately, and anything half-finished is public and indexable from that moment. Re-gating later removes the page but not what was already crawled.',
    touchesLive: true,
    owner: 'jared',
    phase: 'before',
    duration: 'Minutes',
    needs: ['D2'],
  },
  {
    id: 'S6',
    title: 'Clear out what shouldn’t be public',
    summary:
      'Two internal things live inside the site and would ship to the public domain with it: the board’s design gallery, and the status page.',
    risk:
      'Skipping it publishes internal material at a guessable moment. Deleting the wrong thing breaks a link the board is actively using. Neither is a disaster; both are decisions rather than defaults.',
    touchesLive: false,
    owner: 'team',
    phase: 'before',
    duration: 'An hour',
    needs: ['D3', 'D4'],
  },
  {
    id: 'S7',
    title: 'Point the domain at the new site',
    summary:
      'The actual switch, and the only step with a risk window. Two settings change; the email settings sitting next to them are left strictly alone.',
    risk:
      'The real exposure. Editing the wrong records — or using “replace all” — breaks @harvardintech.com email, and mail failures are silent: nobody sees an error, messages just stop arriving. The web half is self-announcing and reversible in minutes. The email half is neither, which is why V5 sends a real test message both ways before this is called done.',
    touchesLive: true,
    owner: 'login-holder',
    phase: 'day',
    duration: '30 minutes, plus waiting for the certificate',
    needs: ['D1', 'D5'],
    note: {
      label: 'The rule again',
      html:
        'Never "replace all records". Edit two lines; leave <code>MX</code>, <code>mail.</code>, and every <code>TXT</code> exactly as they are.',
    },
  },
  {
    id: 'S8',
    title: 'Check it properly',
    summary:
      'Six checks. “The site loads” is not the same as “the cutover worked” — email, search-engine instructions, and the review site can all break silently while the homepage looks perfect.',
    risk:
      'The risk is doing it casually. Every failure this catches is one that otherwise surfaces days later, through someone reporting that they never got a reply.',
    touchesLive: false,
    owner: 'team',
    phase: 'day',
    duration: '30 minutes',
    needs: [],
  },
  {
    id: 'S9',
    title: 'Retire Strikingly',
    summary:
      'Last, and deliberately not on cutover day. While Strikingly is alive, going back is a two-minute change rather than a rebuild.',
    risk:
      'Cancelling early is the mistake — it converts a two-minute rollback into a reconstruction. There is no upside to doing this quickly.',
    touchesLive: false,
    owner: 'jared',
    phase: 'after',
    duration: 'Minutes, several days later',
    needs: [],
  },
];

/** The five decisions, in the order the page presents them. */
export const DECISIONS: DecisionDef[] = [
  {
    id: 'D1',
    question: 'Who holds the GoDaddy login?',
    recommendation:
      'Find out this week, and give a second person access at the same time.',
    because:
      'It has been open since the 2026-07-02 discovery and it blocks S1, which blocks everything else. A domain with exactly one person who can reach it is also a domain that is one unavailable person away from being unreachable.',
    blocks: ['S1', 'S2', 'S7'],
  },
  {
    id: 'D2',
    question: 'Is the content ready to be public?',
    recommendation:
      'Yes — go, and use the “coming soon” toggle for anything unfinished.',
    because:
      'Nothing on the list is broken; the gaps are empty sections, and an empty section can be turned off from /admin without a code change. Waiting for every collection to be full means waiting indefinitely.',
    blocks: ['S5'],
  },
  {
    id: 'D3',
    question: 'The board design gallery becomes public. Keep, gate, or remove?',
    recommendation: 'Move it behind the same passphrase as the review site.',
    because:
      'Its unguessable URL is currently its only protection, and it is an active board share, so deleting it breaks a live link someone is using. Gating keeps the link working while making it deliberate.',
    blocks: ['S6'],
  },
  {
    id: 'D4',
    question: 'The status page becomes public too. Where should it live?',
    recommendation:
      'Keep it on the review site only, never on the public domain — the same answer this runbook already applies to itself.',
    because:
      'It is an internal working document, and it does not become useful to a visitor by being public. This runbook is already excluded from the public build in code, so half of this decision is settled; the status page is a raw file that still needs the same treatment.',
    blocks: ['S6'],
  },
  {
    id: 'D5',
    question: 'When do we cut over?',
    recommendation:
      'A weekday morning, at least a week after D1 is answered, and not near anything the team is running.',
    because:
      'The switch takes minutes but the confidence window is the rest of the day. A morning leaves working hours to notice and reverse. Cutting over before an event means debugging under time pressure.',
    blocks: ['S7'],
  },
];

/** The committed (or seeded) tick state. */
export function loadCutoverProgress(): CutoverProgress {
  return readSingleton<CutoverProgress>('cutoverProgress.json');
}

/** Whether a step is recorded done. Unknown ids are not done. */
export function isStepDone(progress: CutoverProgress, id: string): boolean {
  return progress.steps.some((s) => s.id === id && s.done);
}

/** Whether a decision is recorded answered. Unknown ids are not answered. */
export function isDecisionAnswered(progress: CutoverProgress, id: string): boolean {
  return progress.decisions.some((d) => d.id === id && d.answered);
}

/**
 * The decisions holding a step up — the ones it needs that are still unanswered.
 *
 * Returned as a list rather than a boolean because the page names them: "waiting
 * on D3 and D4" tells the reader what to go and resolve, where "blocked" only
 * tells them to give up.
 */
export function blockingDecisions(progress: CutoverProgress, step: StepDef): string[] {
  return step.needs.filter((id) => !isDecisionAnswered(progress, id));
}

/**
 * Whether a step can be started right now: every decision it needs is answered
 * and it is not already done.
 */
export function isStepReady(progress: CutoverProgress, step: StepDef): boolean {
  return !isStepDone(progress, step.id) && blockingDecisions(progress, step).length === 0;
}

export interface Rollup {
  stepsDone: number;
  stepsTotal: number;
  decisionsAnswered: number;
  decisionsTotal: number;
  /** Steps that could be started today. */
  ready: number;
  /** Steps waiting on an unanswered decision. */
  blocked: number;
  /** True once every step is done. */
  complete: boolean;
  /** True when nothing at all has been recorded — the production default. */
  untouched: boolean;
}

/** The counts the summary band prints. */
export function rollup(progress: CutoverProgress): Rollup {
  const stepsDone = STEPS.filter((s) => isStepDone(progress, s.id)).length;
  const decisionsAnswered = DECISIONS.filter((d) => isDecisionAnswered(progress, d.id)).length;
  const ready = STEPS.filter((s) => isStepReady(progress, s)).length;
  const blocked = STEPS.filter(
    (s) => !isStepDone(progress, s.id) && blockingDecisions(progress, s).length > 0,
  ).length;

  return {
    stepsDone,
    stepsTotal: STEPS.length,
    decisionsAnswered,
    decisionsTotal: DECISIONS.length,
    ready,
    blocked,
    complete: stepsDone === STEPS.length,
    untouched: stepsDone === 0 && decisionsAnswered === 0,
  };
}

/** Steps grouped into the three timeline buckets, order preserved. */
export function byPhase(phase: Phase): StepDef[] {
  return STEPS.filter((s) => s.phase === phase);
}

/**
 * The decision ids in a step's "Waiting on …" line, as English.
 *
 * Was `ids.join(' and ')` inline in the markup, which reads correctly for the
 * one and two cases the runbook has today and produces "D1 and D2 and D3" for
 * three. No step needs three decisions right now, so the fault was invisible —
 * which is precisely why it is worth a function with a test rather than a line
 * of JSX nobody re-reads. The page NAMES what it is waiting on so the reader
 * knows what to go and resolve; garbling that list undercuts the only reason
 * it is printed.
 */
export function blockedLabel(ids: string[]): string {
  if (ids.length === 0) return '';
  if (ids.length === 1) return ids[0];
  return `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`;
}

/**
 * The sentence under the progress count, in the partway state.
 *
 * Pure so the pluralisation is testable: it was a nested ternary inside the
 * banner's markup, where "1 steps are waiting" is the kind of thing that ships
 * because nobody seeds exactly one blocked step while looking at the page.
 *
 * The two branches say different things on purpose. With something blocked, the
 * useful fact is what is stuck and what could still move; with nothing blocked,
 * the useful fact is that the decisions are all in — which is the sentence that
 * tells the team the ball is no longer in their court.
 */
export function summaryLine(counts: Pick<Rollup, 'ready' | 'blocked'>): string {
  const { ready, blocked } = counts;
  if (blocked > 0) {
    return `${blocked} ${blocked === 1 ? 'step is' : 'steps are'} waiting on a decision, and ${ready} could be started today.`;
  }
  return `${ready} ${ready === 1 ? 'step is' : 'steps are'} ready to start — every decision they need has been answered.`;
}

/** How the page names each owner. */
export const OWNER_LABELS: Record<Owner, string> = {
  jared: 'Jared',
  'login-holder': 'Whoever holds the GoDaddy login',
  team: 'The team',
};

/** How the page names each timeline bucket. */
export const PHASE_LABELS: Record<Phase, string> = {
  before: 'Beforehand',
  day: 'On the day',
  after: 'Afterwards',
};
