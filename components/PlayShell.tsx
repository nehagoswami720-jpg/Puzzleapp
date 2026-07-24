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
 *
 * The renderer is keyed on the instance id so a regenerated puzzle gets a fresh
 * board rather than one carrying the previous answer.
 */
interface PlayShellProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: PuzzleInstance<any, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grade(instance: PuzzleInstance<any, any>, answer: any): Promise<GradeResult>;
  /** navigate up a level — provided by the page, not the shell */
  onNewSkill(): void;
  onBackToGallery?: () => void;
}

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
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">{instance.title}</h2>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 capitalize">
            {instance.difficulty}
          </span>
        </div>
        <p className="mt-1 font-mono text-[11px] tracking-wide text-indigo-500 uppercase">
          {instance.trainsLabel}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{instance.prompt}</p>
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
          className="mt-5 min-h-12 w-full rounded-xl bg-indigo-600 px-4 font-semibold text-white disabled:opacity-40"
        >
          {grading ? 'Checking…' : 'Submit'}
        </button>
      )}

      {result && <FeedbackPanel instance={instance} result={result} />}

      {regenError && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {regenError}
        </p>
      )}

      {/* Actions are always available, so a stuck puzzle is never a dead end. */}
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => regenerate('another')}
            disabled={busy}
            className="min-h-12 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 disabled:opacity-40"
          >
            {regenerating === 'another' ? 'Generating…' : 'Try another'}
          </button>
          <button
            type="button"
            onClick={() => regenerate('harder')}
            disabled={busy || atHardest}
            title={atHardest ? 'Already at the hardest level' : undefined}
            className="min-h-12 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 disabled:opacity-40"
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
              className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 disabled:opacity-40"
            >
              ← Puzzles
            </button>
          )}
          <button
            type="button"
            onClick={onNewSkill}
            disabled={busy}
            className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 disabled:opacity-40"
          >
            New skill
          </button>
        </div>
      </div>
    </section>
  );
}
