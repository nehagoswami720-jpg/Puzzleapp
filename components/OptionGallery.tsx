'use client';

import type { PuzzleInstance } from '@/lib/mechanics/types';

/**
 * §12.2 — the option cards. Every card carries its `trainsLabel`, which is what
 * makes a cognitive match (Zip for "planning") read as deliberate rather than
 * random.
 */
interface OptionGalleryProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instances: PuzzleInstance<any, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPlay(instance: PuzzleInstance<any, any>): void;
}

const DIFFICULTY_STYLE: Record<string, string> = {
  easy: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  hard: 'bg-rose-100 text-rose-800',
};

export default function OptionGallery({ instances, onPlay }: OptionGalleryProps) {
  return (
    <ul className="flex flex-col gap-3">
      {instances.map((instance) => (
        <li key={instance.id}>
          <button
            type="button"
            onClick={() => onPlay(instance)}
            className="flex w-full flex-col gap-2 rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold tracking-tight text-slate-900">
                {instance.title}
              </h3>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                  DIFFICULTY_STYLE[instance.difficulty] ?? 'bg-slate-100 text-slate-600'
                }`}
              >
                {instance.difficulty}
              </span>
            </div>

            <p className="font-mono text-[11px] tracking-wide text-indigo-500 uppercase">
              {instance.trainsLabel}
            </p>

            <p className="text-sm leading-relaxed text-slate-600">{instance.prompt}</p>

            <span className="mt-1 text-sm font-semibold text-indigo-600">Play →</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Shown while the pipeline runs, so submitting never lands on a blank screen. */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Building your puzzles">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="h-5 w-32 rounded bg-slate-200" />
            <div className="h-5 w-14 rounded-full bg-slate-100" />
          </div>
          <div className="mt-3 h-3 w-40 rounded bg-slate-100" />
          <div className="mt-3 h-3 w-full rounded bg-slate-100" />
          <div className="mt-2 h-3 w-3/4 rounded bg-slate-100" />
        </li>
      ))}
    </ul>
  );
}
