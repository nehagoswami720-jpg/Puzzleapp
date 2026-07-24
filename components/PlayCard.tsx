'use client';

import { useCallback, useState } from 'react';
import MechanicRenderer from '@/components/renderers';
import type { GradeResult, PuzzleInstance } from '@/lib/mechanics/types';

interface PlayCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: PuzzleInstance<any, any>;
  /** Deterministic mechanics grade here; open ones will go through /api/grade. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grade(instance: PuzzleInstance<any, any>, answer: any): Promise<GradeResult>;
}

/**
 * Minimal play surface for the /dev harness: renderer + Submit + feedback.
 * The full PlayShell / FeedbackPanel (try another, make it harder, new skill)
 * arrives in Phase 3.
 *
 * Mount this with `key={instance.id}` so a new puzzle gets a fresh renderer
 * rather than one carrying the previous puzzle's in-progress answer.
 */
export default function PlayCard({ instance, grade }: PlayCardProps) {
  const [answer, setAnswer] = useState<unknown>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [grading, setGrading] = useState(false);
  /** Bumped to remount the renderer on "Try again". */
  const [attempt, setAttempt] = useState(0);

  const onAnswerChange = useCallback((next: unknown) => {
    setAnswer(next);
    setResult(null);
  }, []);

  const submit = async () => {
    if (answer === null) return;
    setGrading(true);
    try {
      setResult(await grade(instance, answer));
    } finally {
      setGrading(false);
    }
  };

  const retry = () => {
    setAnswer(null);
    setResult(null);
    setAttempt((n) => n + 1);
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink">{instance.title}</h2>
          <span className="shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted capitalize">
            {instance.difficulty}
          </span>
        </div>
        <p className="mt-1 font-mono text-[11px] tracking-wide text-cyan/80 uppercase">
          {instance.trainsLabel}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">{instance.prompt}</p>
      </header>

      <MechanicRenderer
        key={`${instance.id}:${attempt}`}
        instance={instance}
        answer={answer}
        onAnswerChange={onAnswerChange}
        locked={result !== null}
      />

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={answer === null || grading || result !== null}
          className="min-h-12 flex-1 rounded-xl bg-lime px-4 font-display font-semibold text-canvas disabled:bg-surface-2 disabled:text-faint"
        >
          {grading ? 'Checking…' : 'Submit'}
        </button>
        {result && (
          <button
            type="button"
            onClick={retry}
            className="min-h-12 rounded-xl border border-line bg-surface-2 px-4 font-semibold text-ink"
          >
            Try again
          </button>
        )}
      </div>

      {result && (
        <div
          role="status"
          className={[
            'mt-4 rounded-2xl border p-4 text-sm leading-relaxed',
            result.correct
              ? 'border-lime/40 bg-lime/5 text-lime'
              : 'border-amber/40 bg-amber/5 text-amber',
          ].join(' ')}
        >
          <p className="font-semibold">{result.correct ? '✓ Correct' : '✗ Not yet'}</p>
          <p className="mt-1">{result.feedback}</p>
          <p className="mt-3 text-muted">{result.explanation}</p>
        </div>
      )}
    </section>
  );
}
