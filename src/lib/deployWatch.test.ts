import { describe, it, expect } from 'vitest';
import {
  DEPLOY_WATCH_TTL_MS,
  buildDeployRecord,
  deployWatchKey,
  isDeployRecord,
  isWatchExpired,
  remainingWatchMs,
} from '@codeyam/cms/lib/deployWatch';

// The rules that keep a publish from locking the CMS.
//
// Publishing used to be a phase the admin sat in until GitHub Pages finished:
// a full-screen panel whose close button stayed disabled until the deploy
// reached a terminal stage. On this site it never did — the watch polled the
// marker on nseldeib.github.io/harvardintech while commits deploy to
// harvardintech-staging — so the panel never became closable and an editor had
// to reload the page to do anything else after every publish.
//
// The fix makes the watch outlive the page and run beside the editing rather
// than in front of it, which puts real weight on these small pure rules: they
// decide whether a watch is resumed after a navigation, whether "Check again"
// restarts the poll, and how much budget a resumed watch gets. Asserted from
// this repo rather than assumed, the same way `deployMarker.test.ts` guards the
// marker contract this site depends on.
describe('deployWatch', () => {
  const BASELINE = {
    markerUrl: 'https://nseldeib.github.io/harvardintech-staging/deploy-status.json',
    markerBaseline: { commit: 'a0dec62' },
  };

  describe('buildDeployRecord', () => {
    // Both publish surfaces build their record here so the watch behaves
    // identically wherever Publish was pressed.
    it('carries the commit url, marker url and sampled baseline', () => {
      const record = buildDeployRecord('https://github.com/o/r/commit/abc', BASELINE, 1000);

      expect(record.commitUrl).toBe('https://github.com/o/r/commit/abc');
      expect(record.markerUrl).toBe(BASELINE.markerUrl);
      expect(record.markerBaseline).toEqual({ commit: 'a0dec62' });
    });

    // A new record always starts at the moment the commit landed — nothing has
    // been observed about the deploy yet.
    it('starts at the committed stage stamped with the supplied clock', () => {
      const record = buildDeployRecord('https://github.com/o/r/commit/abc', BASELINE, 4242);

      expect(record.stage).toBe('committed');
      expect(record.startedAt).toBe(4242);
    });

    // A null baseline is a real answer, not a missing one: the site served no
    // marker before the commit, so propagation cannot be verified and the poll
    // must be told that rather than left to guess.
    it('preserves a null marker baseline rather than dropping the field', () => {
      const record = buildDeployRecord('https://github.com/o/r/commit/abc', { markerUrl: '', markerBaseline: null }, 1);

      expect(record.markerBaseline).toBeNull();
      expect('markerBaseline' in record).toBe(true);
    });
  });

  describe('deployWatchKey', () => {
    // The key drives the poll effect. Two different commits are two different
    // watches — publishing again mid-deploy must move the watch to the new one.
    it('distinguishes two different commits', () => {
      const a = buildDeployRecord('https://github.com/o/r/commit/aaa', BASELINE, 1000);
      const b = buildDeployRecord('https://github.com/o/r/commit/bbb', BASELINE, 1000);

      expect(deployWatchKey(a)).not.toBe(deployWatchKey(b));
    });

    // This is what makes "Check again" work. It re-watches the SAME commit with
    // a fresh start time, and unless that reads as a new watch the poll effect
    // never re-runs and the button does nothing.
    it('distinguishes two watches of the same commit started at different times', () => {
      const first = buildDeployRecord('https://github.com/o/r/commit/aaa', BASELINE, 1000);
      const recheck = { ...first, startedAt: 90000 };

      expect(deployWatchKey(recheck)).not.toBe(deployWatchKey(first));
    });

    // Re-reading the same stored record across a navigation must not look like a
    // new watch, or every page load would restart the poll from scratch.
    it('is stable for the same commit and start time', () => {
      const record = buildDeployRecord('https://github.com/o/r/commit/aaa', BASELINE, 1000);

      expect(deployWatchKey({ ...record })).toBe(deployWatchKey(record));
    });
  });

  describe('remainingWatchMs', () => {
    // Budget runs from when the deploy STARTED, not from when the current page
    // mounted — otherwise an editor moving between entries would keep renewing a
    // hopeless watch indefinitely.
    it('counts down from the start time rather than from now', () => {
      const record = buildDeployRecord('https://github.com/o/r/commit/aaa', BASELINE, 1000);

      expect(remainingWatchMs(record, 1000)).toBe(DEPLOY_WATCH_TTL_MS);
      expect(remainingWatchMs(record, 61000)).toBe(DEPLOY_WATCH_TTL_MS - 60000);
    });

    // Never negative: the value is handed straight to a poll timeout, and a
    // negative budget would be a nonsense argument.
    it('floors at zero once the budget is spent', () => {
      const record = buildDeployRecord('https://github.com/o/r/commit/aaa', BASELINE, 1000);

      expect(remainingWatchMs(record, 1000 + DEPLOY_WATCH_TTL_MS + 999999)).toBe(0);
    });
  });

  describe('isWatchExpired', () => {
    // A fresh record is resumable — this is the ordinary re-attach after the
    // editor opens another entry mid-deploy.
    it('treats a just-started watch as resumable', () => {
      const record = buildDeployRecord('https://github.com/o/r/commit/aaa', BASELINE, 1000);

      expect(isWatchExpired(record, 1500)).toBe(false);
    });

    // An exhausted record is dropped rather than resumed: restarting a watch
    // with no budget would report "still updating" instantly and read as a fresh
    // failure of a deploy that finished long ago.
    it('expires a watch whose budget is exactly spent', () => {
      const record = buildDeployRecord('https://github.com/o/r/commit/aaa', BASELINE, 1000);

      expect(isWatchExpired(record, 1000 + DEPLOY_WATCH_TTL_MS)).toBe(true);
    });

    // A record left behind by a tab closed yesterday must not resurrect.
    it('expires a watch left over from a much earlier session', () => {
      const record = buildDeployRecord('https://github.com/o/r/commit/aaa', BASELINE, 0);

      expect(isWatchExpired(record, 86400000)).toBe(true);
    });
  });

  describe('isDeployRecord', () => {
    // The happy path: what the store round-trips through JSON.
    it('accepts a record built by buildDeployRecord', () => {
      const record = buildDeployRecord('https://github.com/o/r/commit/aaa', BASELINE, 1000);

      expect(isDeployRecord(JSON.parse(JSON.stringify(record)))).toBe(true);
    });

    // Storage is a string under a key anything on the origin can write, so a
    // half-written or hand-edited value must not resurrect as a watch that polls
    // a garbage URL for ten minutes.
    it('rejects a record missing the fields the poll depends on', () => {
      expect(isDeployRecord({ startedAt: 1000 })).toBe(false);
      expect(isDeployRecord({ commitUrl: 'https://example.com' })).toBe(false);
      expect(isDeployRecord({ commitUrl: 'https://example.com', startedAt: 'soon' })).toBe(false);
    });

    // Null and primitives reach here whenever JSON.parse succeeds on junk.
    it('rejects null and non-object values', () => {
      expect(isDeployRecord(null)).toBe(false);
      expect(isDeployRecord(undefined)).toBe(false);
      expect(isDeployRecord('committed')).toBe(false);
      expect(isDeployRecord(7)).toBe(false);
    });
  });
});
