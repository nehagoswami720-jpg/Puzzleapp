'use client';

import PlayCard from '@/components/PlayCard';
import { multipleChoiceFixture, zipFixture } from '@/lib/dev/fixtures';
import { gradeMultipleChoice } from '@/lib/mechanics/multipleChoice';
import { gradeZipPath } from '@/lib/mechanics/zip';

/**
 * Dev harness (§7). Phase 0: one hardcoded Zip and one hardcoded
 * MultipleChoice, each rendering and grading. Phase 1 turns this into a
 * mechanic × difficulty picker driven by the registry.
 */
export default function DevPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.12em] text-slate-400 uppercase">
          Dev harness · Phase 0
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
          Mechanics
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Hardcoded instances, no generators wired up yet. Both should render on a
          380px viewport and grade correctly.
        </p>
      </header>

      <PlayCard instance={zipFixture} grade={gradeZipPath} />
      <PlayCard instance={multipleChoiceFixture} grade={gradeMultipleChoice} />
    </main>
  );
}
