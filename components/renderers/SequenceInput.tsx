'use client';

import { useState } from 'react';
import type { SequenceAnswer, SequenceContent } from '@/lib/mechanics/sequence';
import type { RendererProps } from '@/lib/mechanics/types';

/**
 * Shows the run with an input box at each hidden position. The answer only
 * becomes submittable once every blank holds a valid integer, so grading never
 * has to deal with partial input.
 */
export default function SequenceInput({
  instance,
  onAnswerChange,
  locked,
}: RendererProps<SequenceContent, SequenceAnswer>) {
  const { terms, blanks } = instance.content;
  const [values, setValues] = useState<string[]>(() => blanks.map(() => ''));

  const update = (blankIndex: number, raw: string) => {
    // Allow a leading minus while typing, but nothing else non-numeric.
    if (raw !== '' && raw !== '-' && !/^-?\d+$/.test(raw)) return;
    const next = [...values];
    next[blankIndex] = raw;
    setValues(next);

    const parsed = next.map((v) => Number(v));
    const complete = next.every((v) => v !== '' && v !== '-') && parsed.every(Number.isInteger);
    onAnswerChange(complete ? parsed : null);
  };

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-wrap items-center gap-2" aria-label="Number sequence">
        {terms.map((term, i) => {
          const blankIndex = blanks.indexOf(i);
          const isBlank = blankIndex >= 0;
          return (
            <li key={i} className="contents">
              {isBlank ? (
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="-?[0-9]*"
                  autoComplete="off"
                  disabled={locked}
                  value={values[blankIndex]}
                  onChange={(e) => update(blankIndex, e.target.value)}
                  aria-label={`Missing term ${blankIndex + 1} of ${blanks.length}`}
                  placeholder="?"
                  className="h-14 w-20 rounded-xl border-2 border-indigo-400 bg-indigo-50 text-center text-lg font-bold tabular-nums text-slate-900 outline-none focus:border-indigo-600 disabled:opacity-70"
                />
              ) : (
                <span className="grid h-14 min-w-20 place-items-center rounded-xl border border-slate-200 bg-white px-3 text-lg font-semibold tabular-nums text-slate-900">
                  {term}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-slate-500">
        {blanks.length === 1
          ? 'Enter the missing number.'
          : `Enter all ${blanks.length} missing numbers, left to right.`}
      </p>
    </div>
  );
}
