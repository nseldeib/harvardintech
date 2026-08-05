import { describe, expect, it } from 'vitest';
import gate from './reviewGate.js';

const { passphraseAccepted } = gate;

const PASS = 'crimson2026';

describe('passphraseAccepted', () => {
  // The ordinary case: the passphrase the reviewer was given opens the page.
  it('accepts the exact passphrase', () => {
    expect(passphraseAccepted(PASS, PASS)).toBe(true);
  });

  // The passphrase is shared out of band and arrives pasted out of an email or
  // a chat message, which carries surrounding whitespace more often than not.
  // Refusing that would read to the reviewer as a wrong passphrase.
  it('forgives whitespace around a pasted passphrase', () => {
    expect(passphraseAccepted(`  ${PASS}`, PASS)).toBe(true);
    expect(passphraseAccepted(`${PASS}  `, PASS)).toBe(true);
    expect(passphraseAccepted(`\n\t ${PASS} \t\n`, PASS)).toBe(true);
  });

  // The whole point of the gate.
  it('refuses a wrong passphrase', () => {
    expect(passphraseAccepted('crimson2025', PASS)).toBe(false);
    expect(passphraseAccepted('harvard', PASS)).toBe(false);
  });

  // Case-insensitivity would make the passphrase materially weaker, and nothing
  // about pasting a shared string makes case a likely transcription error — so
  // this strictness is deliberate rather than incidental.
  it('stays case-sensitive', () => {
    expect(passphraseAccepted('CRIMSON2026', PASS)).toBe(false);
    expect(passphraseAccepted('Crimson2026', PASS)).toBe(false);
  });

  // Neither half of a partial match counts: the comparison is whole-string, so a
  // prefix, a suffix and a superstring are all refused.
  it('refuses a partial or padded match', () => {
    expect(passphraseAccepted('crimson', PASS)).toBe(false);
    expect(passphraseAccepted('2026', PASS)).toBe(false);
    expect(passphraseAccepted('crimson2026!', PASS)).toBe(false);
  });

  // An empty box never opens the gate, which is unremarkable on its own.
  it('refuses an empty input against a real passphrase', () => {
    expect(passphraseAccepted('', PASS)).toBe(false);
    expect(passphraseAccepted('   ', PASS)).toBe(false);
  });

  // THE case this function exists for. Trimming an empty string still equals an
  // empty string, so the bare comparison this replaced would have opened the
  // page for anyone who simply
  // clicked the button, had the build ever substituted an empty passphrase.
  // build.py refuses to emit one; this is the same guard at the point the
  // decision is actually made, because a published page outlives its build.
  it('refuses an empty input even when the expected passphrase is empty', () => {
    expect(passphraseAccepted('', '')).toBe(false);
    expect(passphraseAccepted('   ', '')).toBe(false);
    expect(passphraseAccepted('anything', '')).toBe(false);
  });

  // Same hole one step along: a whitespace-only expected value is as absent as
  // an empty one, and must not be satisfiable by typing whitespace.
  it('refuses everything when the expected passphrase is only whitespace', () => {
    expect(passphraseAccepted(' ', ' ')).toBe(false);
    expect(passphraseAccepted('\t', '\t')).toBe(false);
    expect(passphraseAccepted('anything', '   ')).toBe(false);
  });

  // A missing input element yields null rather than a string. Reading .value off
  // it would already have thrown, but the rule must not be the thing that turns
  // a missing element into an open page.
  it('refuses a non-string input', () => {
    expect(passphraseAccepted(null, PASS)).toBe(false);
    expect(passphraseAccepted(undefined, PASS)).toBe(false);
    expect(passphraseAccepted(0, PASS)).toBe(false);
    expect(passphraseAccepted(PASS, null)).toBe(false);
    expect(passphraseAccepted(PASS, undefined)).toBe(false);
  });

  // Fail closed rather than forgiving: if the build ever substituted a passphrase
  // carrying its own stray whitespace, nobody gets in and the reviewer reports a
  // passphrase that does not work — louder, and safer, than silently trimming the
  // expected value and letting a malformed config look healthy.
  it('fails closed when the expected passphrase carries stray whitespace', () => {
    expect(passphraseAccepted(PASS, ` ${PASS} `)).toBe(false);
    expect(passphraseAccepted(` ${PASS} `, ` ${PASS} `)).toBe(false);
  });
});
