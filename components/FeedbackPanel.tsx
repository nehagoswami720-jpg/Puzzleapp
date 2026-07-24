'use client';

import { useState } from 'react';
import { whyThisHelps } from '@/lib/whyThisHelps';
import type { GradeResult, PuzzleInstance } from '@/lib/mechanics/types';

/**
 * §12.3 feedback panel: the verdict, the short specific note, the teaching
 * explanation, the why-it-helps line, and the broken-puzzle thumbs-down.
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
      // Best-effort — a failed report is not worth surfacing.
    }
  };

  const ok = result.correct;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'rise mt-4 flex flex-col gap-3 rounded-2xl border p-4',
        ok ? 'border-lime/40 bg-lime/5' : 'border-amber/40 bg-amber/5',
      ].join(' ')}
    >
      <p
        className={`font-display text-base font-semibold ${ok ? 'text-lime' : 'text-amber'}`}
      >
        {ok ? '✓ Correct' : '✗ Not quite'}
      </p>

      <p className="text-sm text-ink">{result.feedback}</p>

      {result.explanation && (
        <div className="rounded-xl border border-line bg-surface-2 p-3">
          <p className="font-mono text-[10px] tracking-wider text-faint uppercase">Why</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{result.explanation}</p>
        </div>
      )}

      <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-3">
        <p className="font-mono text-[10px] tracking-wider text-cyan/70 uppercase">
          Why this helps
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{whyThisHelps(instance)}</p>
      </div>

      <button
        type="button"
        onClick={report}
        disabled={reported}
        className="self-start text-xs font-medium text-faint underline-offset-2 hover:text-muted hover:underline disabled:no-underline"
      >
        {reported ? 'Thanks — flagged for review' : '👎 Report a problem with this puzzle'}
      </button>
    </div>
  );
}
