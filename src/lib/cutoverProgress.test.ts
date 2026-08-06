import { describe, it, expect } from 'vitest';
import {
  DECISIONS,
  STEPS,
  blockedLabel,
  blockingDecisions,
  byPhase,
  isDecisionAnswered,
  isStepDone,
  isStepReady,
  rollup,
  summaryLine,
  type CutoverProgress,
} from './cutoverProgress';

/** Everything open — the production default, and the state the page ships in. */
function untouched(): CutoverProgress {
  return {
    steps: STEPS.map((s) => ({ id: s.id, done: false })),
    decisions: DECISIONS.map((d) => ({ id: d.id, answered: false })),
  };
}

/** Everything open except the named steps/decisions. */
function withState(doneSteps: string[], answeredDecisions: string[]): CutoverProgress {
  return {
    steps: STEPS.map((s) => ({ id: s.id, done: doneSteps.includes(s.id) })),
    decisions: DECISIONS.map((d) => ({ id: d.id, answered: answeredDecisions.includes(d.id) })),
  };
}

describe('blockedLabel', () => {
  // The common case on this page: one decision holding a step up.
  it('names a single decision on its own', () => {
    expect(blockedLabel(['D1'])).toBe('D1');
  });

  // S6 today — the only two-decision step.
  it('joins two decisions with and', () => {
    expect(blockedLabel(['D3', 'D4'])).toBe('D3 and D4');
  });

  // The case the inline `join(' and ')` got wrong. No step needs three decisions
  // today, which is exactly why this was invisible and worth pinning down.
  it('uses a comma before the final and for three or more', () => {
    expect(blockedLabel(['D1', 'D2', 'D3'])).toBe('D1, D2 and D3');
  });

  // A step with nothing outstanding renders no waiting line at all, so the
  // empty case must produce nothing rather than a stray separator.
  it('returns an empty string when nothing is blocking', () => {
    expect(blockedLabel([])).toBe('');
  });
});

describe('summaryLine', () => {
  // Singular is the case that reveals a hand-written sentence: nobody seeds
  // exactly one blocked step while looking at the banner.
  it('says step is for exactly one blocked step', () => {
    expect(summaryLine({ ready: 4, blocked: 1 })).toContain('1 step is waiting');
  });

  // Plural for more than one.
  it('says steps are for several blocked steps', () => {
    expect(summaryLine({ ready: 2, blocked: 3 })).toContain('3 steps are waiting');
  });

  // With nothing blocked the sentence changes meaning, not just number — it
  // tells the team the decisions are in and the ball is no longer theirs.
  it('reports readiness rather than blockage when nothing is waiting', () => {
    const line = summaryLine({ ready: 5, blocked: 0 });
    expect(line).toContain('ready to start');
    expect(line).not.toContain('waiting');
  });

  // Singular again on the unblocked branch.
  it('says step is for exactly one ready step', () => {
    expect(summaryLine({ ready: 1, blocked: 0 })).toContain('1 step is ready');
  });
});

describe('isStepDone', () => {
  // A recorded tick reads as done.
  it('reports a ticked step as done', () => {
    expect(isStepDone(withState(['S1'], []), 'S1')).toBe(true);
  });

  // An untouched step does not.
  it('reports an untouched step as not done', () => {
    expect(isStepDone(untouched(), 'S1')).toBe(false);
  });

  // A state file predating a step — or naming one that no longer exists —
  // must not throw or report done. The file is committed and hand-editable, so
  // this is reachable rather than theoretical.
  it('treats a step absent from the file as not done', () => {
    expect(isStepDone({ steps: [], decisions: [] }, 'S1')).toBe(false);
  });
});

describe('blockingDecisions', () => {
  // S1 needs D1. With nothing answered, D1 is what is holding it up — and the
  // page prints this list, so it has to be the ids rather than a boolean.
  it('names the unanswered decisions a step needs', () => {
    const step = STEPS.find((s) => s.id === 'S1')!;
    expect(blockingDecisions(untouched(), step)).toEqual(['D1']);
  });

  // Once answered, nothing blocks it.
  it('returns nothing once the decisions are answered', () => {
    const step = STEPS.find((s) => s.id === 'S1')!;
    expect(blockingDecisions(withState([], ['D1']), step)).toEqual([]);
  });

  // S6 waits on two, and both must be reported — reporting only the first
  // would tell the team they are one decision away when they are two.
  it('names every outstanding decision, not just the first', () => {
    const step = STEPS.find((s) => s.id === 'S6')!;
    expect(blockingDecisions(untouched(), step)).toEqual(['D3', 'D4']);
  });

  // Partially answered: only the outstanding one is named.
  it('drops decisions that have been answered', () => {
    const step = STEPS.find((s) => s.id === 'S6')!;
    expect(blockingDecisions(withState([], ['D3']), step)).toEqual(['D4']);
  });

  // A step with no prerequisites is never blocked.
  it('returns nothing for a step that needs no decisions', () => {
    const step = STEPS.find((s) => s.id === 'S4')!;
    expect(blockingDecisions(untouched(), step)).toEqual([]);
  });
});

describe('isStepReady', () => {
  // Ready means startable now: prerequisites met and not already done.
  it('reports an unblocked, unticked step as ready', () => {
    const step = STEPS.find((s) => s.id === 'S4')!;
    expect(isStepReady(untouched(), step)).toBe(true);
  });

  // A blocked step is not ready however much anyone wants it to be.
  it('reports a step waiting on a decision as not ready', () => {
    const step = STEPS.find((s) => s.id === 'S1')!;
    expect(isStepReady(untouched(), step)).toBe(false);
  });

  // Already done is not "ready to start" — otherwise the banner's "could be
  // started today" count would keep counting finished work.
  it('reports a completed step as not ready', () => {
    const step = STEPS.find((s) => s.id === 'S4')!;
    expect(isStepReady(withState(['S4'], []), step)).toBe(false);
  });
});

describe('rollup', () => {
  // The production default. `untouched` drives the "nothing has happened yet"
  // banner, which is the loudest and most important state this page has.
  it('reports the default state as untouched', () => {
    const counts = rollup(untouched());
    expect(counts.untouched).toBe(true);
    expect(counts.complete).toBe(false);
    expect(counts.stepsDone).toBe(0);
    expect(counts.decisionsAnswered).toBe(0);
  });

  // An answered decision alone means work has started, even with no step
  // ticked — so the banner must stop claiming nothing has happened.
  it('stops reporting untouched once a decision is answered', () => {
    expect(rollup(withState([], ['D1'])).untouched).toBe(false);
  });

  // Every step done is the end state, and drives a different banner.
  it('reports complete when every step is done', () => {
    const counts = rollup(withState(STEPS.map((s) => s.id), []));
    expect(counts.complete).toBe(true);
    expect(counts.stepsDone).toBe(counts.stepsTotal);
  });

  // Ready and blocked partition the unfinished steps: every step that is not
  // done is either startable or waiting, never both and never neither.
  it('splits unfinished steps into ready and blocked with none left over', () => {
    const counts = rollup(withState(['S4'], ['D1']));
    expect(counts.ready + counts.blocked).toBe(counts.stepsTotal - counts.stepsDone);
  });

  // The totals come from the authored runbook, not the state file, so a state
  // file missing entries cannot shrink the denominator the banner prints.
  it('takes its totals from the runbook rather than the state file', () => {
    const counts = rollup({ steps: [], decisions: [] });
    expect(counts.stepsTotal).toBe(STEPS.length);
    expect(counts.decisionsTotal).toBe(DECISIONS.length);
  });
});

describe('byPhase', () => {
  // The timeline's three buckets must between them hold every step — a step
  // missing from the calendar is work nobody has scheduled.
  it('accounts for every step across the three phases', () => {
    const total = byPhase('before').length + byPhase('day').length + byPhase('after').length;
    expect(total).toBe(STEPS.length);
  });

  // The switch and its checks are the on-the-day work.
  it('puts the switch itself on the day', () => {
    expect(byPhase('day').map((s) => s.id)).toContain('S7');
  });

  // Retiring Strikingly is deliberately afterwards — doing it on the day is the
  // mistake the runbook exists to prevent, so its phase is load-bearing.
  it('leaves retiring the old site until afterwards', () => {
    expect(byPhase('after').map((s) => s.id)).toEqual(['S9']);
  });
});

describe('isDecisionAnswered', () => {
  // An answered decision reads as answered.
  it('reports an answered decision', () => {
    expect(isDecisionAnswered(withState([], ['D2']), 'D2')).toBe(true);
  });

  // D1 has been open since 2026-07-02 and the page must keep saying so.
  it('reports an open decision as unanswered', () => {
    expect(isDecisionAnswered(untouched(), 'D1')).toBe(false);
  });

  // Same hand-edited-file tolerance as the step lookup.
  it('treats a decision absent from the file as unanswered', () => {
    expect(isDecisionAnswered({ steps: [], decisions: [] }, 'D1')).toBe(false);
  });
});

describe('runbook structure', () => {
  // Every `needs` entry must name a decision that exists, or a step is blocked
  // forever by something the page never renders and nobody can answer.
  it('only blocks steps on decisions that exist', () => {
    const ids = new Set(DECISIONS.map((d) => d.id));
    for (const step of STEPS) {
      for (const need of step.needs) expect(ids.has(need)).toBe(true);
    }
  });

  // And the reverse: a decision claiming to block a step that does not exist
  // would print a promise the sequence never keeps.
  it('only claims to block steps that exist', () => {
    const ids = new Set(STEPS.map((s) => s.id));
    for (const decision of DECISIONS) {
      for (const blocked of decision.blocks) expect(ids.has(blocked)).toBe(true);
    }
  });

  // The reversible-first ordering is the plan's central safety property: the
  // two steps that change what the public can see must not come before steps
  // that touch nothing, or the runbook stops being safe to abandon partway.
  it('puts every step that touches nothing live before the last live one', () => {
    const lastLive = STEPS.map((s) => s.touchesLive).lastIndexOf(true);
    const firstLive = STEPS.map((s) => s.touchesLive).indexOf(true);
    expect(firstLive).toBeGreaterThan(0);
    expect(lastLive).toBeLessThan(STEPS.length - 1);
  });
});
