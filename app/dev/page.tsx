'use client';

import { useCallback, useEffect, useState } from 'react';
import PlayCard from '@/components/PlayCard';
import { getProceduralMechanic } from '@/lib/mechanics/procedural';
import type {
  CatalogEntry,
  Difficulty,
  GradeResult,
  PuzzleInstance,
} from '@/lib/mechanics/types';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * Dev harness (§7) — Phase 1: pick any mechanic at any difficulty, generate,
 * play, grade.
 *
 * Procedural mechanics generate in the browser (no network, which is what makes
 * offline play possible later). LLM mechanics go through /api/dev/generate so
 * the key stays server-side.
 */
export default function DevPage() {
  const [mechanics, setMechanics] = useState<CatalogEntry[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [mechanicId, setMechanicId] = useState('zip');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [prompt, setPrompt] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [instance, setInstance] = useState<PuzzleInstance<any, any> | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/dev/catalog')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMechanics(d.mechanics ?? []);
      })
      .catch(() => {
        if (!cancelled) setCatalogError('Could not load the mechanic catalog.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = mechanics?.find((m) => m.id === mechanicId);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    setInstance(null);
    const startedAt = Date.now();

    try {
      const local = getProceduralMechanic(mechanicId);
      if (local) {
        const next = await local.generate({
          skill: {
            rawPrompt: prompt.trim() || 'general practice',
            canonicalSkill: prompt.trim() || 'General Reasoning',
            subSkills: [],
            domain: 'other',
            needsClarification: false,
          },
          difficulty,
        });
        setInstance(next);
        setStatus(`Generated in the browser · ${Date.now() - startedAt}ms`);
      } else {
        const res = await fetch('/api/dev/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mechanicId, difficulty, prompt: prompt.trim() || undefined }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(
            res.status === 422
              ? `Dropped after ${data.attempts} attempts — ${data.error}`
              : (data.error ?? 'Generation failed.'),
          );
        } else {
          setInstance(data.instance);
          setStatus(`Generated server-side · ${data.ms}ms`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setBusy(false);
    }
  };

  /** Deterministic mechanics grade locally; §11's LLM-judge path arrives with open mechanics. */
  const grade = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (inst: PuzzleInstance<any, any>, answer: unknown): Promise<GradeResult> => {
      const local = getProceduralMechanic(inst.mechanicId);
      if (local) return local.grade(inst, answer);
      // Multiple-choice grading is a pure index comparison — no need to round-trip.
      const { gradeMultipleChoice } = await import('@/lib/mechanics/multipleChoice');
      return gradeMultipleChoice(inst, answer as number);
    },
    [],
  );

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.12em] text-slate-400 uppercase">
          Dev harness · Phase 1
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
          Mechanics
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Generate and play any mechanic at any difficulty. The prompt→puzzles
          pipeline is Phase 2 — here each mechanic is driven directly.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Mechanic
          </label>
          {catalogError && <p className="text-sm text-red-700">{catalogError}</p>}
          <div className="flex flex-wrap gap-2">
            {(mechanics ?? []).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMechanicId(m.id)}
                className={[
                  'min-h-11 rounded-xl border px-3 text-sm font-semibold',
                  m.id === mechanicId
                    ? 'border-indigo-500 bg-indigo-50 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600',
                ].join(' ')}
              >
                {m.name}
                <span className="ml-2 font-mono text-[10px] text-slate-400 uppercase">
                  {m.engine === 'llm' ? 'llm' : 'proc'}
                </span>
              </button>
            ))}
            {!mechanics && !catalogError && (
              <p className="text-sm text-slate-400">Loading catalog…</p>
            )}
          </div>
          {selected && <p className="text-xs leading-relaxed text-slate-500">{selected.description}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Difficulty
          </label>
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={[
                  'min-h-11 flex-1 rounded-xl border text-sm font-semibold capitalize',
                  d === difficulty
                    ? 'border-indigo-500 bg-indigo-50 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600',
                ].join(' ')}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="dev-prompt"
            className="text-xs font-semibold tracking-wide text-slate-500 uppercase"
          >
            Skill prompt <span className="normal-case opacity-70">(steers LLM content)</span>
          </label>
          <input
            id="dev-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. improve my critical thinking"
            className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 text-[16px] text-slate-900 outline-none focus:border-indigo-500"
          />
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={busy || !mechanics}
          className="min-h-12 rounded-xl bg-indigo-600 px-4 font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'Generating…' : 'Generate'}
        </button>

        {status && <p className="font-mono text-[11px] text-slate-400">{status}</p>}
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
      </section>

      {instance && <PlayCard key={instance.id} instance={instance} grade={grade} />}
    </main>
  );
}
