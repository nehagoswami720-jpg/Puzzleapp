'use client';

import { useState } from 'react';
import type { MatchAnswer, MatchContent } from '@/lib/mechanics/matching';
import type { RendererProps } from '@/lib/mechanics/types';

/**
 * Matching pairs: two columns. Tap a left item, then a right item, to pair them
 * (both take a shared colour). Re-tap to change. Once every left item is paired
 * the answer becomes submittable.
 */
const COLORS = [
  { on: 'border-lime bg-lime/15 text-lime', dot: 'bg-lime' },
  { on: 'border-cyan bg-cyan/15 text-cyan', dot: 'bg-cyan' },
  { on: 'border-amber bg-amber/15 text-amber', dot: 'bg-amber' },
  { on: 'border-rose bg-rose/15 text-rose', dot: 'bg-rose' },
  { on: 'border-[#a78bfa] bg-[#a78bfa]/15 text-[#a78bfa]', dot: 'bg-[#a78bfa]' },
];

export default function MatchPairs({
  instance,
  onAnswerChange,
  locked,
}: RendererProps<MatchContent, MatchAnswer>) {
  const { left, right, leftLabel, rightLabel } = instance.content;
  const [pairs, setPairs] = useState<MatchAnswer>({});
  const [selLeft, setSelLeft] = useState<number | null>(null);

  // rightIndex → the leftIndex it's paired with (for colouring / uniqueness)
  const rightToLeft: Record<number, number> = {};
  for (const [l, r] of Object.entries(pairs)) rightToLeft[r] = Number(l);

  const colorFor = (leftIdx: number) => COLORS[leftIdx % COLORS.length];

  const commit = (next: MatchAnswer) => {
    setPairs(next);
    const done = left.every((_, i) => next[i] != null);
    onAnswerChange(done ? next : null);
  };

  const tapLeft = (i: number) => {
    if (locked) return;
    setSelLeft((cur) => (cur === i ? null : i));
  };

  const tapRight = (ri: number) => {
    if (locked || selLeft == null) return;
    const next: MatchAnswer = { ...pairs };
    // free this right from any other left, and this left from any other right
    for (const [l, r] of Object.entries(next)) if (r === ri) delete next[Number(l)];
    next[selLeft] = ri;
    setSelLeft(null);
    commit(next);
  };

  const Item = ({
    label,
    active,
    paired,
    onClick,
  }: {
    label: string;
    active: boolean;
    paired?: (typeof COLORS)[number];
    onClick: () => void;
  }) => (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      className={[
        'min-h-13 w-full rounded-xl border px-2 py-2 text-center text-[14px] font-semibold transition',
        active
          ? 'border-ink bg-surface-2 text-ink'
          : paired
            ? paired.on
            : 'border-line bg-surface-2 text-muted hover:border-line-strong',
      ].join(' ')}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          {leftLabel && (
            <p className="font-mono text-[10px] tracking-wider text-faint uppercase">{leftLabel}</p>
          )}
          {left.map((l, i) => (
            <Item
              key={l}
              label={l}
              active={selLeft === i}
              paired={pairs[i] != null ? colorFor(i) : undefined}
              onClick={() => tapLeft(i)}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {rightLabel && (
            <p className="font-mono text-[10px] tracking-wider text-faint uppercase">{rightLabel}</p>
          )}
          {right.map((r, ri) => (
            <Item
              key={r}
              label={r}
              active={false}
              paired={rightToLeft[ri] != null ? colorFor(rightToLeft[ri]) : undefined}
              onClick={() => tapRight(ri)}
            />
          ))}
        </div>
      </div>
      <p className="font-mono text-xs text-faint">
        <b className="text-ink">{Object.keys(pairs).length}</b>/{left.length} paired
      </p>
    </div>
  );
}
