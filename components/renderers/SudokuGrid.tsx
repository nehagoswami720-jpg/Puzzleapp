'use client';

import { useState } from 'react';
import type { SudokuAnswer, SudokuContent } from '@/lib/mechanics/sudoku';
import type { RendererProps } from '@/lib/mechanics/types';

/**
 * Mini-Sudoku grid. Givens are fixed; tap an empty cell to select it, then tap a
 * number from the pad to fill it (or ⌫ to clear). The answer becomes
 * submittable once every cell holds a number.
 */
export default function SudokuGrid({
  instance,
  onAnswerChange,
  locked,
}: RendererProps<SudokuContent, SudokuAnswer>) {
  const { rows: n, boxRows, boxCols, givens } = instance.content;
  const [grid, setGrid] = useState<number[][]>(() => givens.map((r) => [...r]));
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);

  const commit = (next: number[][]) => {
    setGrid(next);
    const full = next.every((row) => row.every((v) => v !== 0));
    onAnswerChange(full ? next : null);
  };

  const setNumber = (val: number) => {
    if (locked || !sel) return;
    if (givens[sel.r][sel.c] !== 0) return;
    const next = grid.map((r) => [...r]);
    next[sel.r][sel.c] = next[sel.r][sel.c] === val ? 0 : val;
    commit(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className="mx-auto grid w-full max-w-[320px] overflow-hidden rounded-xl border-2 border-line-strong"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {grid.map((row, r) =>
          row.map((v, c) => {
            const isGiven = givens[r][c] !== 0;
            const selected = sel?.r === r && sel?.c === c;
            const thickR = (c + 1) % boxCols === 0 && c !== n - 1;
            const thickB = (r + 1) % boxRows === 0 && r !== n - 1;
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                disabled={locked || isGiven}
                onClick={() => setSel({ r, c })}
                style={{ aspectRatio: '1 / 1' }}
                className={[
                  'grid place-items-center border-line font-mono text-lg font-semibold transition',
                  'border-r border-b',
                  thickR ? 'border-r-2 border-r-line-strong' : '',
                  thickB ? 'border-b-2 border-b-line-strong' : '',
                  isGiven
                    ? 'bg-surface-2 text-ink'
                    : selected
                      ? 'bg-lime/15 text-lime'
                      : v !== 0
                        ? 'bg-surface text-cyan'
                        : 'bg-surface text-faint',
                ].join(' ')}
              >
                {v !== 0 ? v : ''}
              </button>
            );
          }),
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {Array.from({ length: n }, (_, i) => i + 1).map((val) => (
          <button
            key={val}
            type="button"
            disabled={locked || !sel}
            onClick={() => setNumber(val)}
            className="grid size-12 place-items-center rounded-xl border border-line bg-surface-2 font-mono text-lg font-bold text-ink transition hover:border-line-strong disabled:opacity-40"
          >
            {val}
          </button>
        ))}
        <button
          type="button"
          disabled={locked || !sel}
          onClick={() => sel && setNumber(grid[sel.r][sel.c])}
          className="grid size-12 place-items-center rounded-xl border border-line bg-surface text-muted transition hover:border-line-strong disabled:opacity-40"
          aria-label="Clear cell"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
