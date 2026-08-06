// Writing a tick back to the repo.
//
// The runbook's state is a committed file, not browser storage, so a tick is a
// commit. That is the whole reason the checklist is worth having: everyone loads
// the same state, and each tick carries a real GitHub identity rather than a
// self-reported name. The cost is latency — a commit, then a rebuild — which the
// page states rather than hides.
//
// This module is the client half. It reuses the CMS's existing commit path
// (`commitAll`) and its existing session (`authSession` / `githubAuth`), so
// there is one token model on this site rather than two, and ticking requires
// exactly the repo-write access that editing content already requires.
//
// Read-modify-write, deliberately, instead of `commitAll`'s staged-change drift
// check. That check refuses the whole commit when a path moved underneath the
// editor, which is right for a batch of content edits reviewed as a unit and
// wrong for a single boolean: two people ticking two different steps are not in
// conflict, and telling them they are would train them to ignore the warning.
// Instead every tick re-reads the file from the branch first and applies itself
// to whatever it finds, so concurrent ticks on different steps both survive and
// concurrent ticks on the SAME step converge on the same answer.
import { commitAll, fetchPathContent, type FetchFn, type RepoTarget } from '@codeyam/cms/lib/githubCommit';
import { cachedToken } from '@codeyam/cms/lib/githubAuth';
import type { CutoverProgress, DecisionState, StepState } from './cutoverProgress';

/** Repo-relative path of the state file. The one place it is spelled. */
export const PROGRESS_PATH = 'src/data/cutoverProgress.json';

/** What the page needs from `src/data/cms.json` to address the repo. */
export interface TickConfig {
  target: RepoTarget;
}

/**
 * Apply one step toggle to a progress object, returning a new object.
 *
 * Pure, and separated from the network so the merge rule is testable on its own:
 * this is the function that decides what "two people ticked at once" resolves
 * to. An unknown id is appended rather than dropped, so a step added to the
 * runbook after this file was committed can still be ticked.
 */
export function applyStepTick(
  progress: CutoverProgress,
  id: string,
  done: boolean,
  by: string,
  at: string,
): CutoverProgress {
  const next: StepState = done ? { id, done, by, at } : { id, done };
  const found = progress.steps.some((s) => s.id === id);
  return {
    ...progress,
    steps: found ? progress.steps.map((s) => (s.id === id ? next : s)) : [...progress.steps, next],
  };
}

/**
 * Apply one decision answer to a progress object, returning a new object.
 *
 * `answer` is the team's own words, kept when present so the page can show what
 * was decided rather than only that something was. Clearing an answer drops the
 * text along with the flag — a decision reopened should not still display the
 * conclusion it no longer holds.
 */
export function applyDecisionAnswer(
  progress: CutoverProgress,
  id: string,
  answered: boolean,
  answer: string,
  by: string,
  at: string,
): CutoverProgress {
  const next: DecisionState = answered ? { id, answered, answer, by, at } : { id, answered: false };
  const found = progress.decisions.some((d) => d.id === id);
  return {
    ...progress,
    decisions: found
      ? progress.decisions.map((d) => (d.id === id ? next : d))
      : [...progress.decisions, next],
  };
}

/** The commit subject a tick lands under, so the repo history reads as progress. */
export function tickCommitMessage(id: string, done: boolean): string {
  return `${done ? 'Complete' : 'Reopen'} cutover ${id}`;
}

/** Whether this browser holds a token that could commit at all. */
export function canTick(): boolean {
  return cachedToken() !== null;
}

/**
 * Re-read the state file from the branch, apply `mutate` to it, and commit the
 * result. Returns the state that was committed, so the caller can replace its
 * optimistic copy with the authoritative one.
 *
 * Throws when there is no token (the caller should not have offered the control)
 * or when the file is missing on the branch — an absent state file means the
 * page is deployed from a commit that predates it, and inventing one here would
 * quietly commit a checklist with every step reset.
 */
export async function commitTick(
  config: TickConfig,
  mutate: (current: CutoverProgress) => CutoverProgress,
  message: string,
  fetchFn: FetchFn = globalThis.fetch as unknown as FetchFn,
): Promise<CutoverProgress> {
  const token = cachedToken();
  if (!token) throw new Error('Sign in with a GitHub token before ticking a step.');

  const raw = await fetchPathContent(config.target, token, PROGRESS_PATH, false, fetchFn);
  if (raw === null) {
    throw new Error(
      `${PROGRESS_PATH} does not exist on ${config.target.branch} — this page is newer than the branch it commits to.`,
    );
  }

  const next = mutate(JSON.parse(raw) as CutoverProgress);
  await commitAll(
    [{ path: PROGRESS_PATH, content: `${JSON.stringify(next, null, 2)}\n` }],
    message,
    config.target,
    token,
    fetchFn,
  );
  return next;
}
