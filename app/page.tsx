'use client';

import { useCallback, useState } from 'react';
import ChatInput from '@/components/ChatInput';
import OptionGallery, { SkeletonCards } from '@/components/OptionGallery';
import PlayCard from '@/components/PlayCard';
import { getProceduralMechanic } from '@/lib/mechanics/procedural';
import type { GradeResult, PuzzleInstance, SkillContext } from '@/lib/mechanics/types';

type View = 'home' | 'loading' | 'gallery' | 'play';

/**
 * The core loop (§3, §12): type a skill → option cards → play → grade.
 *
 * "Try another / Make it harder" and the full feedback panel are Phase 3; this
 * phase is about the loop existing end to end.
 */
export default function Home() {
  const [view, setView] = useState<View>('home');
  const [skill, setSkill] = useState<SkillContext | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [instances, setInstances] = useState<PuzzleInstance<any, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [playing, setPlaying] = useState<PuzzleInstance<any, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState('');

  const run = async (prompt: string) => {
    setView('loading');
    setError(null);
    setLastPrompt(prompt);
    setInstances([]);
    setPlaying(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.');
        setView('home');
        return;
      }

      setSkill(data.skillContext);
      setInstances(data.instances ?? []);
      // A clarifying question comes back with no puzzles — ask, then re-run.
      setView(data.instances?.length ? 'gallery' : 'home');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setView('home');
    }
  };

  /** Deterministic grading (§11). Procedural mechanics can grade fully offline. */
  const grade = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (inst: PuzzleInstance<any, any>, answer: unknown): Promise<GradeResult> => {
      const local = getProceduralMechanic(inst.mechanicId);
      if (local) return local.grade(inst, answer);
      const { gradeMultipleChoice } = await import('@/lib/mechanics/multipleChoice');
      return gradeMultipleChoice(inst, answer as number);
    },
    [],
  );

  const reset = () => {
    setView('home');
    setInstances([]);
    setPlaying(null);
    setSkill(null);
    setError(null);
  };

  const clarifying = view === 'home' && skill?.needsClarification && skill.clarifyingQuestion;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.12em] text-slate-400 uppercase">
          Skill Puzzles
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
          {view === 'home' ? 'What do you want to get better at?' : (skill?.canonicalSkill ?? '')}
        </h1>
        {view !== 'home' && (
          <p className="mt-1 text-sm text-slate-500">
            Practising what you asked for: “{skill?.rawPrompt}”
          </p>
        )}
      </header>

      {view === 'home' && (
        <>
          {clarifying && (
            <div className="rounded-3xl rounded-bl-lg border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-sm leading-relaxed text-indigo-950">
                {skill!.clarifyingQuestion}
              </p>
            </div>
          )}
          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </p>
          )}
          <ChatInput
            onSubmit={run}
            busy={false}
            initialValue={clarifying ? lastPrompt : ''}
            placeholder={
              clarifying
                ? 'Add a bit more detail…'
                : 'e.g. I want to improve my critical thinking'
            }
          />
          <p className="text-xs leading-relaxed text-slate-400">
            Every puzzle is checked before you see it — procedural ones are verified
            solvable, and generated ones are schema-validated.
          </p>
        </>
      )}

      {view === 'loading' && (
        <>
          <p className="text-sm text-slate-500">Choosing puzzles for “{lastPrompt}”…</p>
          <SkeletonCards />
        </>
      )}

      {view === 'gallery' && (
        <>
          <p className="text-sm text-slate-600">
            {instances.length} puzzles for this. Pick one to play.
          </p>
          <OptionGallery
            instances={instances}
            onPlay={(inst) => {
              setPlaying(inst);
              setView('play');
            }}
          />
          <button
            type="button"
            onClick={reset}
            className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-700"
          >
            New skill
          </button>
        </>
      )}

      {view === 'play' && playing && (
        <>
          <PlayCard key={playing.id} instance={playing} grade={grade} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPlaying(null);
                setView('gallery');
              }}
              className="min-h-12 flex-1 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-700"
            >
              ← Back to puzzles
            </button>
            <button
              type="button"
              onClick={reset}
              className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-700"
            >
              New skill
            </button>
          </div>
        </>
      )}
    </main>
  );
}
