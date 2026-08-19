import { describe, it, expect } from 'vitest';
import {
  shouldPlayActivation,
  soundEnabledByDefault,
  soundToggleLabel,
  ACTIVATION_MIN_INTERVAL_MS,
  ACTIVATION_TONE,
} from './networkSound';

describe('shouldPlayActivation', () => {
  // The one a visitor actually came for: entering a node with sound on plays.
  it('plays the first activation', () => {
    expect(shouldPlayActivation({ enabled: true, lastPlayedAt: 0 }, 1000)).toBe(true);
  });

  // The overlap guard, tested without a browser or a clock because the caller
  // passes the time in. Sweeping a pointer across a dense network crosses a
  // dozen nodes in under a second; without a floor that is a dozen overlapping
  // tones — the "loud chime / arcade effect" the direction rules out, produced
  // by a sound that is individually correct.
  it('refuses a second activation inside the overlap window', () => {
    const state = { enabled: true, lastPlayedAt: 1000 };
    expect(shouldPlayActivation(state, 1000 + ACTIVATION_MIN_INTERVAL_MS - 1)).toBe(false);
  });

  // The guard has to open again, or the sound plays once per page load and the
  // feature is silently dead after the first node.
  it('allows the next activation once the window has passed', () => {
    const state = { enabled: true, lastPlayedAt: 1000 };
    expect(shouldPlayActivation(state, 1000 + ACTIVATION_MIN_INTERVAL_MS)).toBe(true);
  });

  // The visitor's switch wins over everything else.
  it('never plays while sound is switched off', () => {
    expect(shouldPlayActivation({ enabled: false, lastPlayedAt: 0 }, 10_000)).toBe(false);
  });

  // The elapsed-time branch must not be able to re-enable a muted page: the
  // interval check and the enabled check are AND, not OR.
  it('keeps sound off even long after the last activation', () => {
    expect(shouldPlayActivation({ enabled: false, lastPlayedAt: 1000 }, 999_000)).toBe(false);
  });
});

describe('soundEnabledByDefault', () => {
  // The sound is part of the feature, so the ordinary visitor gets it — the
  // control exists to turn it off, not to opt in.
  it('starts on for a visitor with no motion preference', () => {
    expect(soundEnabledByDefault(false)).toBe(true);
  });

  // `prefers-reduced-motion` is nominally about movement, but it is the closest
  // thing the platform gives to "this page should not do things at me", and
  // someone who has set it is not expecting a page to make noise.
  it('starts off for a visitor who asked for reduced motion', () => {
    expect(soundEnabledByDefault(true)).toBe(false);
  });
});

describe('soundToggleLabel', () => {
  // The label names what is TRUE, not what a click would do — a button reading
  // "Sound off" is ambiguous about which of those two things it means, and the
  // direction asks for a visible control rather than a guessable one.
  it('reports the current state rather than the action', () => {
    expect(soundToggleLabel(true)).toBe('Sound on');
    expect(soundToggleLabel(false)).toBe('Sound off');
  });
});

describe('ACTIVATION_TONE', () => {
  // The brief asks for a quiet pulse, explicitly not a loud chime. Gain is the
  // number that decides which of those a visitor gets, so it is pinned rather
  // than left to drift on a later tweak.
  it('stays quiet', () => {
    expect(ACTIVATION_TONE.gain).toBeLessThan(0.1);
  });

  // "Like a light switching on" is a shape: fast attack, short decay, no
  // sustain. A long envelope would be a swell, which is a different sound.
  it('is over quickly, with a fast attack', () => {
    expect(ACTIVATION_TONE.attack).toBeLessThan(0.02);
    expect(ACTIVATION_TONE.decay).toBeLessThan(0.25);
  });

  // Too low reads as a thud, too high as a beep; the brief asks for neither.
  it('sits in a register that reads as digital without being piercing', () => {
    expect(ACTIVATION_TONE.frequency).toBeGreaterThan(300);
    expect(ACTIVATION_TONE.frequency).toBeLessThan(1200);
  });
});
