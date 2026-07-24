'use client';

import { useCallback, useState } from 'react';
import FeedbackPanel from '@/components/FeedbackPanel';
import MechanicRenderer from '@/components/renderers';
import { regeneratePuzzle } from '@/lib/client/regenerate';
import { harder } from '@/lib/mechanics/types';
import type { GradeResult, PuzzleInstance } from '@/lib/mechanics/types';

/**
 * §12.3 play surface: the mechanic, Submit → FeedbackPanel, then the three
 * actions — Try another, Make it harder, New skill.
 */
interface PlayShellProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: PuzzleInstance<any, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grade(instance: PuzzleInstance<any, any>, answer: any): Promise<GradeResult>;
  onNewSkill(): void;
  onBackToGallery?: () => void;
}

const DIFF_TEXT: Record<string, string> = {
  easy: 'text-lime',
  medium: 'text-cyan',
  hard: 'text-amber',
};

export default function PlayShell({
  instance: initial,
  grade,
  onNewSkill,
  onBackToGallery,
}: PlayShellProps) {
  const [instance, setInstance] = useState(initial);
  const [answer, setAnswer] = useState<unknown>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [grading, setGrading] = useState(false);
  const [regenerating, setRegenerating] = useState<'another' | 'harder' | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);

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

  const regenerate = async (mode: 'another' | 'harder') => {
    setRegenerating(mode);
    setRegenError(null);
    try {
      const difficulty = mode === 'harder' ? harder(instance.difficulty) : instance.difficulty;
      const next = await regeneratePuzzle(instance.mechanicId, difficulty, instance.skillContext);
      setInstance(next);
      setAnswer(null);
      setResult(null);
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : 'Could not generate another.');
    } finally {
      setRegenerating(null);
    }
  };

  const atHardest = instance.difficulty === 'hard';
  const busy = grading || regenerating !== null;

  return (
    <section
      className={`rise rounded-2xl border border-line bg-surface p-5 ${result?.correct ? 'pop' : ''}`}
    >
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
            {instance.title}
          </h2>
          <span
            className={`shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold capitalize ${DIFF_TEXT[instance.difficulty] ?? 'text-muted'}`}
          >
            {instance.difficulty}
          </span>
        </div>
        <p className="mt-1 font-mono text-[11px] tracking-wide text-cyan/80 uppercase">
          {instance.trainsLabel}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">{instance.prompt}</p>
      </header>

      <MechanicRenderer
        key={instance.id}
        instance={instance}
        answer={answer}
        onAnswerChange={onAnswerChange}
        locked={result !== null || busy}
      />

      {!result && (
        <button
          type="button"
          onClick={submit}
          disabled={answer === null || busy}
          className="mt-5 min-h-13 w-full rounded-xl bg-lime px-4 font-display font-semibold text-canvas transition active:scale-[0.99] disabled:bg-surface-2 disabled:text-faint"
        >
          {grading ? 'Checking…' : 'Submit'}
        </button>
      )}

      {result && <FeedbackPanel instance={instance} result={result} />}

      {regenError && (
        <p className="mt-3 rounded-xl border border-rose/40 bg-rose/10 p-3 text-sm text-rose">
          {regenError}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => regenerate('another')}
            disabled={busy}
            className="min-h-12 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm font-semibold text-ink transition hover:border-line-strong disabled:opacity-40"
          >
            {regenerating === 'another' ? 'Generating…' : 'Try another'}
          </button>
          <button
            type="button"
            onClick={() => regenerate('harder')}
            disabled={busy || atHardest}
            title={atHardest ? 'Already at the hardest level' : undefined}
            className="min-h-12 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm font-semibold text-ink transition hover:border-line-strong disabled:opacity-40"
          >
            {regenerating === 'harder'
              ? 'Generating…'
              : atHardest
                ? 'Hardest level'
                : 'Make it harder'}
          </button>
        </div>
        <div className="flex gap-2">
          {onBackToGallery && (
            <button
              type="button"
              onClick={onBackToGallery}
              disabled={busy}
              className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-muted transition hover:text-ink disabled:opacity-40"
            >
              ← Puzzles
            </button>
          )}
          <button
            type="button"
            onClick={onNewSkill}
            disabled={busy}
            className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-muted transition hover:text-ink disabled:opacity-40"
          >
            New skill
          </button>
        </div>
      </div>
    </section>
  );
}
