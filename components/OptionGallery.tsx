'use client';

import type { PuzzleInstance } from '@/lib/mechanics/types';

/**
 * §12.2 — the option cards. Every card carries its `trainsLabel`, which is what
 * makes a cognitive match (Zip for "planning") read as deliberate rather than
 * random. Difficulty is colour-coded: lime → cyan → amber as it climbs.
 */
interface OptionGalleryProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instances: PuzzleInstance<any, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPlay(instance: PuzzleInstance<any, any>): void;
}

const DIFFICULTY: Record<string, { dot: string; text: string }> = {
  easy: { dot: 'bg-lime', text: 'text-lime' },
  medium: { dot: 'bg-cyan', text: 'text-cyan' },
  hard: { dot: 'bg-amber', text: 'text-amber' },
};

export default function OptionGallery({ instances, onPlay }: OptionGalleryProps) {
  return (
    <ul className="flex flex-col gap-3">
      {instances.map((instance, i) => {
        const d = DIFFICULTY[instance.difficulty] ?? DIFFICULTY.medium;
        return (
          <li key={instance.id} className="rise" style={{ animationDelay: `${i * 60}ms` }}>
            <button
              type="button"
              onClick={() => onPlay(instance)}
              className="group flex w-full flex-col gap-2.5 rounded-2xl border border-line bg-surface p-5 text-left transition hover:border-line-strong active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-semibold tracking-tight text-ink">
                  {instance.title}
                </h3>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold capitalize">
                  <span className={`size-1.5 rounded-full ${d.dot}`} />
                  <span className={d.text}>{instance.difficulty}</span>
                </span>
              </div>

              <p className="font-mono text-[11px] tracking-wide text-cyan/80 uppercase">
                {instance.trainsLabel}
              </p>

              <p className="text-sm leading-relaxed text-muted">{instance.prompt}</p>

              <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-lime">
                Play
                <span className="transition group-hover:translate-x-0.5">→</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Shown while the pipeline runs, so submitting never lands on a blank screen. */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Building your puzzles">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="shimmer h-5 w-32 rounded" />
            <div className="shimmer h-5 w-16 rounded-full" />
          </div>
          <div className="shimmer mt-3 h-3 w-40 rounded" />
          <div className="shimmer mt-3 h-3 w-full rounded" />
          <div className="shimmer mt-2 h-3 w-3/4 rounded" />
        </li>
      ))}
    </ul>
  );
}
