import Link from 'next/link';

/**
 * Placeholder home. The chat input, option gallery and play surface (§12) are
 * built in Phase 2 once the generation pipeline exists.
 */
export default function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
      <p className="font-mono text-[11px] tracking-[0.12em] text-slate-400 uppercase">
        Phase 0 · scaffold
      </p>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
        Skill Puzzles
      </h1>
      <p className="text-sm leading-relaxed text-slate-600">
        Type a skill you want to improve and get a few tailored, verified puzzles to
        practise it. The chat input and option gallery land in Phase 2.
      </p>
      <Link
        href="/dev"
        className="grid min-h-12 place-items-center rounded-xl bg-indigo-600 px-4 font-semibold text-white"
      >
        Open the dev harness
      </Link>
    </main>
  );
}
