// Recording the answer to one decision.
//
// Deliberately not just a checkbox. A step is done or it isn't, but a decision
// has a CONTENT — "Nadia has the login, she'll make the edits herself" — and a
// checklist that records only that D1 is "answered" strands the answer in
// whichever meeting produced it. The whole reason D1 is still open is that its
// answer was never written anywhere durable; a control that repeats that mistake
// would be worse than none.
//
// Same commit path, latency and failure handling as StepTick — see the note
// there. The one addition is that the text and the flag save together, so a
// decision can never read as answered with nothing recorded against it.
import { useState } from 'react';
import type { AuthSession } from '@codeyam/cms/lib/authSession';
import type { RepoTarget } from '@codeyam/cms/lib/githubCommit';
import { applyDecisionAnswer, commitTick } from '../../lib/cutoverTicks';
import { shortDate } from '../../lib/cutoverFormat';
import { useAuthSession } from './useAuthSession';

interface Props {
  id: string;
  initialAnswered: boolean;
  initialAnswer?: string;
  initialBy?: string;
  initialAt?: string;
  target: RepoTarget;
  /** Scenario/test seam: render this fixed session instead of the live store. */
  initialSession?: AuthSession;
}

type Save = 'idle' | 'saving' | 'failed';

export default function DecisionTick({
  id,
  initialAnswered,
  initialAnswer,
  initialBy,
  initialAt,
  target,
  initialSession,
}: Props) {
  const [answered, setAnswered] = useState(initialAnswered);
  const [answer, setAnswer] = useState(initialAnswer ?? '');
  const [draft, setDraft] = useState(initialAnswer ?? '');
  const [by, setBy] = useState(initialBy);
  const [at, setAt] = useState(initialAt);
  const [editing, setEditing] = useState(false);
  const [save, setSave] = useState<Save>('idle');
  const [error, setError] = useState<string | null>(null);
  const session = useAuthSession(initialSession);

  const signedIn = session.status === 'signed-in';
  const login = session.user?.login ?? '';

  async function record(nextAnswered: boolean, nextAnswer: string) {
    const prev = { answered, answer, by, at };
    const now = new Date().toISOString();

    setAnswered(nextAnswered);
    setAnswer(nextAnswer);
    setBy(nextAnswered ? login : undefined);
    setAt(nextAnswered ? now : undefined);
    setEditing(false);
    setSave('saving');
    setError(null);

    try {
      await commitTick(
        { target },
        (current) => applyDecisionAnswer(current, id, nextAnswered, nextAnswer, login, now),
        `${nextAnswered ? 'Answer' : 'Reopen'} cutover ${id}`,
      );
      setSave('idle');
    } catch (e) {
      setAnswered(prev.answered);
      setAnswer(prev.answer);
      setBy(prev.by);
      setAt(prev.at);
      setSave('failed');
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Read-only for everyone without repo write. The answer still shows — the
  // point is that the team can see what was decided, not that they can change it.
  if (!signedIn) {
    return answered ? (
      <div className="answer is-set">
        <span className="k">Decided</span>
        <p>{answer}</p>
        <span className="tick-who">
          {by}
          {at ? ` · ${shortDate(at)}` : ''}
        </span>
      </div>
    ) : (
      <div className="answer">
        <span className="k">Not yet answered</span>
        <p className="tick-note">Sign in from /admin to record an answer — anyone can read this.</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="answer is-editing">
        <span className="k">What was decided</span>
        <textarea
          value={draft}
          rows={3}
          onChange={(e) => setDraft(e.currentTarget.value)}
          placeholder="In your own words — the answer, not the reasoning."
        />
        <div className="answer-actions">
          <button
            type="button"
            className="primary"
            disabled={draft.trim() === ''}
            onClick={() => record(true, draft.trim())}
          >
            Record it
          </button>
          <button type="button" onClick={() => { setDraft(answer); setEditing(false); }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={answered ? 'answer is-set' : 'answer'}>
      <span className="k">{answered ? 'Decided' : 'Not yet answered'}</span>
      {answered ? <p>{answer}</p> : null}

      {answered && by ? (
        <span className="tick-who">
          {by}
          {at ? ` · ${shortDate(at)}` : ''}
        </span>
      ) : null}

      <div className="answer-actions">
        <button type="button" disabled={save === 'saving'} onClick={() => { setDraft(answer); setEditing(true); }}>
          {answered ? 'Change the answer' : 'Record an answer'}
        </button>
        {answered ? (
          <button type="button" disabled={save === 'saving'} onClick={() => record(false, '')}>
            Reopen
          </button>
        ) : null}
      </div>

      {save === 'saving' ? (
        <span className="tick-note">Saving — others see this in a minute or two</span>
      ) : null}
      {save === 'failed' ? <span className="tick-error">Not saved — {error}</span> : null}
    </div>
  );
}
