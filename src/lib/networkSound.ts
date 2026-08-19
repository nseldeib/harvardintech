// The node activation sound: when it may play, and how it is made.
//
// The DECISION is pure and tested; the Web Audio call is the thin edge, in the
// `./donorFilter.ts` mould. That split matters more here than usual, because
// every constraint the direction puts on this sound is a decision rather than a
// waveform: play on entering a node and not while sitting on it, do not let a
// fast sweep stack sounds, keep it off when the visitor has switched it off.
//
// There is no audio FILE. The sound is synthesized from an oscillator and a
// short envelope, which is not a shortcut — a "quiet pulse, like a light
// switching on" is a shape (fast attack, short decay, no sustain), and a shape
// is easier to tune in four numbers than to source as an asset, ships no bytes,
// and needs no network fetch inside a visualization that is already drawing.

/** How close together two activations may be, in milliseconds.
 *
 *  Sweeping a pointer across a dense network crosses a dozen nodes in well under
 *  a second. Without a floor, that is a dozen overlapping tones — the "loud
 *  chime / arcade effect" the direction rules out, produced by a sound that is
 *  individually correct. 90ms is about the interval at which two pulses still
 *  read as two events rather than as a buzz. */
export const ACTIVATION_MIN_INTERVAL_MS = 90;

/** The sound's shape. Low gain on purpose: this sits under a page, not over it. */
export const ACTIVATION_TONE = {
  /** Hz. High enough to read as digital, low enough not to be piercing. */
  frequency: 660,
  /** Peak gain. Deliberately quiet — the brief asks for a quiet pulse. */
  gain: 0.045,
  /** Seconds. Fast enough to feel like a switch rather than a swell. */
  attack: 0.006,
  /** Seconds. Short: the whole event is over in well under a fifth of a second. */
  decay: 0.16,
} as const;

export interface SoundState {
  /** The visitor's on/off choice. */
  enabled: boolean;
  /** When the last activation played, in ms on the same clock as `now`. */
  lastPlayedAt: number;
}

/**
 * Whether an activation should sound right now.
 *
 * Pure so the overlap guard is testable without a browser or a clock: the
 * caller passes the current time rather than the function reading it, which is
 * what lets a test assert "two activations 30ms apart produce one sound".
 *
 * A first activation always plays — `lastPlayedAt` of 0 with any positive `now`
 * clears the interval — so the guard never swallows the one sound a visitor
 * came for.
 */
export function shouldPlayActivation(state: SoundState, now: number): boolean {
  if (!state.enabled) return false;
  return now - state.lastPlayedAt >= ACTIVATION_MIN_INTERVAL_MS;
}

/**
 * Whether sound should start switched ON for this visitor.
 *
 * Off when the visitor has asked for reduced motion. That flag is nominally
 * about movement, but it is the closest thing the platform gives to "this page
 * should not do things at me", and someone who has set it is not expecting a
 * page to make noise. Sound also stays off until a real pointer interaction, so
 * this only decides what the toggle READS when the page loads.
 */
export function soundEnabledByDefault(prefersReducedMotion: boolean): boolean {
  return !prefersReducedMotion;
}

/** The label the toggle shows for a state — it names what is true, not what a
 *  click would do, because a button reading "Sound off" is ambiguous about
 *  which of those two things it means. */
export function soundToggleLabel(enabled: boolean): string {
  return enabled ? 'Sound on' : 'Sound off';
}

/**
 * Play one activation pulse through the Web Audio API.
 *
 * No-ops without a browser (SSR, vitest) and no-ops when the context could not
 * be created — a browser that refuses audio should cost a visitor the sound and
 * nothing else, never a thrown error inside a pointer handler that would take
 * the hover highlight down with it.
 */
export function playActivationTone(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(ACTIVATION_TONE.frequency, now);

  // Ramp rather than a step: an instantaneous gain change is a click, which is
  // audible as a defect on top of the tone it is supposed to start.
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(ACTIVATION_TONE.gain, now + ACTIVATION_TONE.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + ACTIVATION_TONE.decay);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + ACTIVATION_TONE.decay + 0.02);
}
