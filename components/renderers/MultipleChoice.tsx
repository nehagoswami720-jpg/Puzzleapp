'use client';

import type { MultipleChoiceAnswer, MultipleChoiceContent } from '@/lib/mechanics/multipleChoice';
import type { RendererProps } from '@/lib/mechanics/types';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * The one multiple-choice surface — ~6 LLM mechanics reuse it (§9.5), so it
 * carries the touch targets and states for all of them. Options are radio-like
 * buttons at ≥44px so they're comfortable on a phone.
 */
export default function MultipleChoice({
  instance,
  answer,
  onAnswerChange,
  locked,
}: RendererProps<MultipleChoiceContent, MultipleChoiceAnswer>) {
  const { stem, options } = instance.content;

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-2xl bg-slate-50 p-4 text-[15px] leading-relaxed text-slate-900">
        {stem}
      </p>

      <div role="radiogroup" aria-label={instance.prompt} className="flex flex-col gap-2">
        {options.map((option, i) => {
          const selected = answer === i;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={locked}
              onClick={() => onAnswerChange(selected ? null : i)}
              className={[
                'flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] transition',
                selected
                  ? 'border-indigo-500 bg-indigo-50 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-700',
                locked ? 'opacity-70' : 'active:scale-[0.99]',
              ].join(' ')}
            >
              <span
                className={[
                  'grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold',
                  selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500',
                ].join(' ')}
              >
                {LETTERS[i] ?? i + 1}
              </span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
