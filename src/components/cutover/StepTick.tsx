// The tick control on one step.
//
// Three states, and the distinction between them is the point of the component:
//
//   - Signed out — the box renders, disabled, showing whatever the branch says.
//     Everyone can read the checklist; only repo-write holders can change it.
//   - Signed in — a real checkbox. Ticking commits.
//   - Saving — the tick shows immediately (optimistically) while the commit is
//     in flight, with the latency stated rather than hidden. A tick is a commit
//     and then a rebuild, so other people see it in a minute or two, not now.
//     Pretending otherwise is how a shared checklist loses trust the first time
//     two people compare screens.
//
// A failed commit reverts the box and says why. A tick that looks saved but was
// not is worse than an error, because the whole value of this page is that what
// it shows is what everyone else sees.
import { useState } from 'react';
import type { AuthSession } from '@codeyam/cms/lib/authSession';
import type { RepoTarget } from '@codeyam/cms/lib/githubCommit';
import { applyStepTick, commitTick, tickCommitMessage } from '../../lib/cutoverTicks';
import { shortDate } from '../../lib/cutoverFormat';
import { useAuthSession } from './useAuthSession';

interface Props {
  /** Step id, e.g. `S3`. */
  id: string;
  /** State as the branch had it when this page was built. */
  initialDone: boolean;
  /** GitHub login recorded against the tick, when there is one. */
  initialBy?: string;
  /** ISO timestamp of the tick, when there is one. */
  initialAt?: string;
  /** Repo the tick commits to, from `src/data/cms.json`. */
  target: RepoTarget;
  /** Scenario/test seam: render this fixed session instead of the live store. */
  initialSession?: AuthSession;
}

type Save = 'idle' | 'saving' | 'failed';

export default function StepTick({
  id,
  initialDone,
  initialBy,
  initialAt,
  target,
  initialSession,
}: Props) {
  const [done, setDone] = useState(initialDone);
  const [by, setBy] = useState(initialBy);
  const [at, setAt] = useState(initialAt);
  const [save, setSave] = useState<Save>('idle');
  const [error, setError] = useState<string | null>(null);
  const session = useAuthSession(initialSession);

  const signedIn = session.status === 'signed-in';
  const login = session.user?.login ?? '';

  async function toggle(next: boolean) {
    const prev = { done, by, at };
    const now = new Date().toISOString();

    // Optimistic: the person who ticked sees it immediately. Everyone else waits
    // for the rebuild, which the caption says.
    setDone(next);
    setBy(next ? login : undefined);
    setAt(next ? now : undefined);
    setSave('saving');
    setError(null);

    try {
      await commitTick(
        { target },
        (current) => applyStepTick(current, id, next, login, now),
        tickCommitMessage(id, next),
      );
      setSave('idle');
    } catch (e) {
      // Put it back. A box that stays ticked after a failed commit is a lie the
      // next reader has no way to detect.
      setDone(prev.done);
      setBy(prev.by);
      setAt(prev.at);
      setSave('failed');
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="tick">
      <label className="tick-box">
        <input
          type="checkbox"
          checked={done}
          disabled={!signedIn || save === 'saving'}
          onChange={(e) => toggle(e.currentTarget.checked)}
          aria-label={`Mark ${id} done`}
        />
        <span className="tick-label">{done ? 'Done' : 'Not started'}</span>
      </label>

      {done && by ? (
        <span className="tick-who">
          {by}
          {at ? ` · ${shortDate(at)}` : ''}
        </span>
      ) : null}

      {save === 'saving' ? (
        <span className="tick-note">Saving — others see this in a minute or two</span>
      ) : null}

      {save === 'failed' ? <span className="tick-error">Not saved — {error}</span> : null}

      {!signedIn ? (
        <span className="tick-note">Sign in from /admin to tick — anyone can read this</span>
      ) : null}
    </div>
  );
}
