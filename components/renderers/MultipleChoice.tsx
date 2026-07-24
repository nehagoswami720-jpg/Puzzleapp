'use client';

import type { MultipleChoiceAnswer, MultipleChoiceContent } from '@/lib/mechanics/multipleChoice';
import type { RendererProps } from '@/lib/mechanics/types';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * The one multiple-choice surface — ~6 LLM mechanics reuse it (§9.5). Dark rows,
 * ≥44px targets, lime selection state.
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
      <p className="rounded-xl border border-line bg-surface-2 p-4 text-[15px] leading-relaxed text-ink">
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
                  ? 'border-lime bg-lime/10 text-ink'
                  : 'border-line bg-surface text-muted hover:border-line-strong',
                locked ? 'opacity-80' : 'active:scale-[0.99]',
              ].join(' ')}
            >
              <span
                className={[
                  'grid size-7 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold',
                  selected ? 'bg-lime text-canvas' : 'bg-surface-2 text-faint',
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
