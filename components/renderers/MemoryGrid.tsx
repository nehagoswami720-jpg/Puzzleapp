'use client';

import { useEffect, useRef, useState } from 'react';
import type { MemoryAnswer, MemoryContent } from '@/lib/mechanics/memory';
import type { RendererProps } from '@/lib/mechanics/types';

/**
 * Memory Match. Tap a card to flip it; flip two, and if they match they stay up,
 * otherwise both flip back after a beat. When every pair is matched the answer
 * becomes `true` and PlayShell's Submit confirms the clear.
 */
export default function MemoryGrid({
  instance,
  onAnswerChange,
  locked,
}: RendererProps<MemoryContent, MemoryAnswer>) {
  const { cards, cols } = instance.content;
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flip = (i: number) => {
    if (locked || matched.has(i) || flipped.includes(i) || flipped.length === 2 || timer.current) {
      return;
    }
    const next = [...flipped, i];
    setFlipped(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next;
      if (cards[a] === cards[b]) {
        const nm = new Set(matched);
        nm.add(a);
        nm.add(b);
        setMatched(nm);
        setFlipped([]);
        if (nm.size === cards.length) onAnswerChange(true);
      } else {
        timer.current = setTimeout(() => {
          setFlipped([]);
          timer.current = null;
        }, 800);
      }
    }
  };

  const remaining = (cards.length - matched.size) / 2;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="mx-auto grid w-full max-w-[340px] gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cards.map((sym, i) => {
          const up = matched.has(i) || flipped.includes(i);
          return (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => flip(i)}
              style={{ aspectRatio: '1 / 1' }}
              className={[
                'grid place-items-center rounded-xl border text-2xl transition',
                matched.has(i)
                  ? 'border-lime/50 bg-lime/10'
                  : up
                    ? 'border-cyan bg-surface-2'
                    : 'border-line bg-surface-2 hover:border-line-strong',
              ].join(' ')}
              aria-label={up ? sym : 'face-down card'}
            >
              <span className={up ? '' : 'opacity-0'}>{up ? sym : '•'}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 font-mono text-xs text-faint">
        <span>
          <b className="text-ink">{remaining}</b> pairs left
        </span>
        <span>
          <b className="text-ink">{moves}</b> moves
        </span>
      </div>
    </div>
  );
}
