// The CMS sign-in session, as a hook, for the runbook's two tick controls.
//
// Both islands need the same three things and got them wrong in the same way
// first: the session must START signed-out on every render, adopt the real one
// after mount, and then track it. Seeding state from `getSession()` directly is
// what produced the original hydration failure — the store answers signed-out on
// the server (no window) and, inside the codeyam preview, signed-in in the
// browser, so React rendered two different trees and discarded the subtree.
//
// `AuthGate` in the CMS package starts from the same constant for the same
// reason. This hook is that pattern named once rather than pasted twice.
import { useEffect, useState } from 'react';
import { getSession, subscribe, type AuthSession } from '@codeyam/cms/lib/authSession';

/**
 * The session every render starts from — never `getSession()`.
 *
 * Exported so a test or scenario can express "signed out" without restating the
 * shape, and so the reason lives next to the value rather than in two comments.
 */
export const SIGNED_OUT: AuthSession = { status: 'signed-out', user: null };

/**
 * Track the CMS sign-in session, hydration-safely.
 *
 * Pass `initialSession` to pin a fixed session — the scenario/test seam
 * `AuthGate` uses, so an isolated-component scenario can capture the signed-out
 * and signed-in states without a token or a network call. When pinned, the live
 * store is never consulted, so a capture cannot drift into whatever session the
 * preview happens to hold.
 *
 * Otherwise the real session arrives in an effect after mount and then updates
 * on every store mutation — including from another tab, since the store writes
 * localStorage and dispatches. Signing in at /admin therefore lights up these
 * controls without a reload.
 */
export function useAuthSession(initialSession?: AuthSession): AuthSession {
  const pinned = initialSession !== undefined;
  const [session, setSession] = useState<AuthSession>(initialSession ?? SIGNED_OUT);

  useEffect(() => {
    if (pinned) return;
    const sync = () => setSession(getSession());
    sync();
    return subscribe(sync);
  }, [pinned]);

  return session;
}
