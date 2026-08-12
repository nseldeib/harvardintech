import { describe, it, expect } from 'vitest';
import {
  DEPLOY_STAGES,
  deployChipLabel,
  deployDotColor,
  deployStateFromBuild,
  deploySteps,
  deploySubhead,
  isTerminalStage,
} from '@codeyam/cms/lib/githubPages';

// The stage rules behind the publish lockout.
//
// `DeployStatus` renders in a fixed full-screen scrim and enables its close
// button only on a TERMINAL stage. `pollDeploy` used to return whichever
// in-flight stage it happened to be sitting on when its budget ran out — a
// value nothing could ever move off — so on a site where the deploy could not
// be verified the scrim stayed up for the rest of the session and the only way
// back to work was a page reload.
//
// `unconfirmed` is the stage that fixes it: an honest terminal outcome meaning
// "the commit landed, nothing ever proved the deploy finished". Everything here
// guards that it stays terminal, stays distinguishable from success and from
// failure, and never claims something that was not observed.
describe('deploy stages', () => {
  const TARGET = { owner: 'nseldeib', repo: 'harvardintech', branch: 'staging' };

  describe('isTerminalStage', () => {
    // The whole bug in one assertion. If `unconfirmed` is not terminal, the
    // panel's close button never enables and the admin is unusable after a
    // publish that could not be verified.
    it('treats unconfirmed as terminal so the status view can rest', () => {
      expect(isTerminalStage('unconfirmed')).toBe(true);
    });

    // The two original terminal stages keep their meaning.
    it('keeps live and failed terminal', () => {
      expect(isTerminalStage('live')).toBe(true);
      expect(isTerminalStage('failed')).toBe(true);
    });

    // In-flight stages must stay non-terminal, or the poll would stop early and
    // report a deploy as finished while it is still building.
    it('leaves every in-flight stage non-terminal', () => {
      expect(isTerminalStage('committed')).toBe(false);
      expect(isTerminalStage('queued')).toBe(false);
      expect(isTerminalStage('building')).toBe(false);
      expect(isTerminalStage('verifying')).toBe(false);
    });
  });

  describe('deploySteps', () => {
    // The stepper must not change shape between stages — a row appearing or
    // vanishing mid-deploy reads as something having gone wrong.
    it('renders one row per pipeline stage for every stage', () => {
      for (const stage of ['committed', 'building', 'live', 'failed', 'unconfirmed'] as const) {
        expect(deploySteps(stage)).toHaveLength(DEPLOY_STAGES.length);
      }
    });

    // `unconfirmed` is the literal truth of the state: everything up to and
    // including the wait is done, and only "Live" is unproven.
    it('marks everything before Live done and leaves Live pending when unconfirmed', () => {
      const steps = deploySteps('unconfirmed');
      const live = steps[steps.length - 1];

      expect(live.stage).toBe('live');
      expect(live.visual).toBe('pending');
      expect(steps.slice(0, -1).every((step) => step.visual === 'done')).toBe(true);
    });

    // It must not borrow the failure marker. Nothing failed — the deploy was
    // simply never observed finishing — and a red step would say otherwise.
    it('shows no failed step when unconfirmed', () => {
      expect(deploySteps('unconfirmed').some((step) => step.visual === 'failed')).toBe(false);
    });

    // A real failure still reads as one, pinned to the step where a build works.
    it('still marks the building row failed on a failed build', () => {
      const steps = deploySteps('failed');

      expect(steps.find((step) => step.stage === 'building')?.visual).toBe('failed');
    });

    // Success completes every row, including Live.
    it('marks every row done when live', () => {
      expect(deploySteps('live').every((step) => step.visual === 'done')).toBe(true);
    });
  });

  describe('deploySubhead', () => {
    // States the commit as fact and the deploy as unknown — it promises nothing
    // and blames nothing.
    it('says the change is committed and the site is still updating', () => {
      const subhead = deploySubhead('unconfirmed', TARGET);

      expect(subhead).toContain('committed');
      expect(subhead).toContain('still updating');
    });

    // The unconfirmed copy must not be the generic in-flight line, which claims
    // GitHub Pages is actively rebuilding — by then nothing is watching.
    it('does not reuse the in-flight rebuilding copy', () => {
      expect(deploySubhead('unconfirmed', TARGET)).not.toBe(deploySubhead('queued', TARGET));
    });

    // Success names where it published, which on a two-track repo is the part
    // an editor actually needs to know.
    it('names the repo and branch on success', () => {
      const subhead = deploySubhead('live', TARGET);

      expect(subhead).toContain('nseldeib/harvardintech');
      expect(subhead).toContain('staging');
    });
  });

  describe('deployChipLabel', () => {
    // Each outcome reads differently in the compact chip, so the colour dot is
    // never the only thing carrying the result.
    it('gives each terminal outcome its own wording', () => {
      expect(deployChipLabel('live')).toBe('Your change is live');
      expect(deployChipLabel('failed')).toBe('Publish failed');
      expect(deployChipLabel('unconfirmed')).toBe('Published — still updating');
    });

    // In-flight stages say which step they are on, so a long build still looks
    // like progress rather than a stall.
    it('names the current step while publishing', () => {
      expect(deployChipLabel('building')).toContain('Publishing');
      expect(deployChipLabel('building')).toContain('Building site');
      expect(deployChipLabel('queued')).toContain('Build queued');
    });
  });

  describe('deployDotColor', () => {
    // Green, red and amber have to differ or the chip's one glanceable signal
    // collapses.
    it('gives live, failed and unconfirmed distinct colours', () => {
      const colors = [deployDotColor('live'), deployDotColor('failed'), deployDotColor('unconfirmed')];

      expect(new Set(colors).size).toBe(3);
    });

    // Every in-flight stage shares one colour: the chip reports that work is
    // happening, not which step it reached.
    it('shares one colour across the in-flight stages', () => {
      expect(deployDotColor('queued')).toBe(deployDotColor('building'));
      expect(deployDotColor('committed')).toBe(deployDotColor('verifying'));
    });
  });

  describe('deployStateFromBuild', () => {
    // `unconfirmed` is produced only by the poll giving up — never by a build
    // record, which always says something definite.
    it('never derives unconfirmed from a build status', () => {
      for (const status of ['queued', 'building', 'built', 'errored', 'something-new']) {
        expect(deployStateFromBuild({ status }).stage).not.toBe('unconfirmed');
      }
    });

    // An errored build keeps GitHub's own message, which is the only thing that
    // says why.
    it('carries the build error message through on failure', () => {
      const state = deployStateFromBuild({ status: 'errored', error: { message: 'boom' } });

      expect(state.stage).toBe('failed');
      expect(state.error).toBe('boom');
    });
  });
});
