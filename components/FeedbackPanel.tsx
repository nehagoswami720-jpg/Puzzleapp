'use client';

import { useState } from 'react';
import { whyThisHelps } from '@/lib/whyThisHelps';
import type { GradeResult, PuzzleInstance } from '@/lib/mechanics/types';

/**
 * §12.3 feedback panel: the verdict, the short specific note, the teaching
 * explanation, the why-it-helps line, and the broken-puzzle thumbs-down.
 *
 * The action buttons (Try another / Make it harder / New skill) live in
 * PlayShell, not here — this component's job is what the user *reads* after
 * submitting, not what they do next.
 */
interface FeedbackPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: PuzzleInstance<any, any>;
  result: GradeResult;
}

export default function FeedbackPanel({ instance, result }: FeedbackPanelProps) {
  const [reported, setReported] = useState(false);

  const report = async () => {
    if (reported) return;
    setReported(true);
    try {
      await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instanceId: instance.id,
          mechanicId: instance.mechanicId,
          difficulty: instance.difficulty,
          reason: 'flagged from play surface',
        }),
      });
    } catch {
      // A failed report is not worth surfacing — the thumbs-down is best-effort.
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'mt-4 flex flex-col gap-3 rounded-2xl border p-4',
        result.correct
          ? 'border-emerald-300 bg-emerald-50'
          : 'border-amber-300 bg-amber-50',
      ].join(' ')}
    >
      <p
        className={`text-base font-bold ${
          result.correct ? 'text-emerald-900' : 'text-amber-900'
        }`}
      >
        {result.correct ? '✓ Correct' : '✗ Not quite'}
      </p>

      <p className={`text-sm ${result.correct ? 'text-emerald-900' : 'text-amber-900'}`}>
        {result.feedback}
      </p>

      {result.explanation && (
        <div className="rounded-xl bg-white/70 p-3">
          <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
            Why
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{result.explanation}</p>
        </div>
      )}

      <div className="rounded-xl bg-white/70 p-3">
        <p className="text-[11px] font-semibold tracking-wide text-indigo-400 uppercase">
          Why this helps
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{whyThisHelps(instance)}</p>
      </div>

      <button
        type="button"
        onClick={report}
        disabled={reported}
        className="self-start text-xs font-medium text-slate-400 underline-offset-2 hover:underline disabled:no-underline"
      >
        {reported ? 'Thanks — flagged for review' : '👎 Report a problem with this puzzle'}
      </button>
    </div>
  );
}
