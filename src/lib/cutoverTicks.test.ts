import { describe, it, expect } from 'vitest';
import { applyDecisionAnswer, applyStepTick, tickCommitMessage } from './cutoverTicks';
import type { CutoverProgress } from './cutoverProgress';

function progress(): CutoverProgress {
  return {
    steps: [
      { id: 'S1', done: false },
      { id: 'S2', done: true, by: 'nseldeib', at: '2026-08-11T14:20:00Z' },
    ],
    decisions: [
      { id: 'D1', answered: false },
      { id: 'D2', answered: true, answer: 'Split it', by: 'nseldeib', at: '2026-08-11T11:30:00Z' },
    ],
  };
}

describe('applyStepTick', () => {
  // Ticking records who and when. That attribution is the entire argument for
  // committing this file instead of keeping ticks in a browser, so it is the
  // first thing worth pinning down.
  it('records the login and timestamp when a step is ticked', () => {
    const next = applyStepTick(progress(), 'S1', true, 'jaredcosulich', '2026-08-14T09:00:00Z');
    const s1 = next.steps.find((s) => s.id === 'S1');
    expect(s1).toEqual({
      id: 'S1',
      done: true,
      by: 'jaredcosulich',
      at: '2026-08-14T09:00:00Z',
    });
  });

  // Un-ticking drops the attribution with it. A step recorded as not done but
  // still carrying "nseldeib · 11 Aug" would read as a step someone finished
  // and then someone else quietly reversed, which is not what happened.
  it('clears the attribution when a step is un-ticked', () => {
    const next = applyStepTick(progress(), 'S2', false, 'jaredcosulich', '2026-08-14T09:00:00Z');
    expect(next.steps.find((s) => s.id === 'S2')).toEqual({ id: 'S2', done: false });
  });

  // The concurrency rule. Two people ticking DIFFERENT steps are not in
  // conflict, and both ticks must survive — this is why the commit path
  // re-reads and re-applies rather than refusing on drift.
  it('leaves every other step untouched', () => {
    const next = applyStepTick(progress(), 'S1', true, 'jaredcosulich', '2026-08-14T09:00:00Z');
    expect(next.steps.find((s) => s.id === 'S2')).toEqual(progress().steps[1]);
  });

  // Two people ticking the SAME step converge rather than duplicating it.
  it('replaces rather than duplicates an existing step', () => {
    const next = applyStepTick(progress(), 'S2', true, 'jaredcosulich', '2026-08-14T09:00:00Z');
    expect(next.steps.filter((s) => s.id === 'S2')).toHaveLength(2 - 1);
    expect(next.steps.find((s) => s.id === 'S2')?.by).toBe('jaredcosulich');
  });

  // A step added to the runbook after this file was committed still has to be
  // tickable, or adding a step would silently make it unrecordable.
  it('appends a step the file does not yet know about', () => {
    const next = applyStepTick(progress(), 'S9', true, 'nseldeib', '2026-08-14T09:00:00Z');
    expect(next.steps.find((s) => s.id === 'S9')?.done).toBe(true);
    expect(next.steps).toHaveLength(3);
  });

  // Pure: the caller holds an optimistic copy of the old state to revert to
  // when the commit fails, so mutating the input would corrupt that rollback.
  it('does not mutate the progress it was given', () => {
    const before = progress();
    applyStepTick(before, 'S1', true, 'nseldeib', '2026-08-14T09:00:00Z');
    expect(before.steps.find((s) => s.id === 'S1')?.done).toBe(false);
  });
});

describe('applyDecisionAnswer', () => {
  // A decision has content, not just a flag. Recording only "answered" is what
  // left D1's actual answer stranded in whichever meeting produced it.
  it('records the answer text alongside the flag', () => {
    const next = applyDecisionAnswer(
      progress(),
      'D1',
      true,
      'Nadia has the login',
      'nseldeib',
      '2026-08-14T09:00:00Z',
    );
    expect(next.decisions.find((d) => d.id === 'D1')).toEqual({
      id: 'D1',
      answered: true,
      answer: 'Nadia has the login',
      by: 'nseldeib',
      at: '2026-08-14T09:00:00Z',
    });
  });

  // Reopening drops the text. A decision back in the open column must not still
  // display the conclusion it no longer holds.
  it('drops the answer text when a decision is reopened', () => {
    const next = applyDecisionAnswer(progress(), 'D2', false, '', 'nseldeib', '2026-08-14T09:00:00Z');
    expect(next.decisions.find((d) => d.id === 'D2')).toEqual({ id: 'D2', answered: false });
  });

  // Same non-interference rule as steps.
  it('leaves every other decision untouched', () => {
    const next = applyDecisionAnswer(progress(), 'D1', true, 'x', 'nseldeib', '2026-08-14T09:00:00Z');
    expect(next.decisions.find((d) => d.id === 'D2')).toEqual(progress().decisions[1]);
  });

  // A decision absent from the file is appended rather than dropped.
  it('appends a decision the file does not yet know about', () => {
    const next = applyDecisionAnswer(progress(), 'D5', true, 'Aug 25', 'nseldeib', '2026-08-14T09:00:00Z');
    expect(next.decisions.find((d) => d.id === 'D5')?.answer).toBe('Aug 25');
  });

  // Pure, for the same rollback reason as the step tick.
  it('does not mutate the progress it was given', () => {
    const before = progress();
    applyDecisionAnswer(before, 'D1', true, 'x', 'nseldeib', '2026-08-14T09:00:00Z');
    expect(before.decisions.find((d) => d.id === 'D1')?.answered).toBe(false);
  });
});

describe('tickCommitMessage', () => {
  // The repo history is a second, permanent record of this checklist, so a tick
  // should read as progress there rather than as "Update cutoverProgress.json".
  it('names the step and what happened to it', () => {
    expect(tickCommitMessage('S3', true)).toBe('Complete cutover S3');
  });

  // Un-ticking is a distinct event and must not read as completion.
  it('distinguishes reopening from completing', () => {
    expect(tickCommitMessage('S3', false)).toBe('Reopen cutover S3');
  });
});
