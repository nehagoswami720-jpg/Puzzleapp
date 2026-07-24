'use client';

import { useCallback, useState } from 'react';
import ChatInput from '@/components/ChatInput';
import OptionGallery, { SkeletonCards } from '@/components/OptionGallery';
import PlayShell from '@/components/PlayShell';
import { getProceduralMechanic } from '@/lib/mechanics/procedural';
import type { GradeResult, PuzzleInstance, SkillContext } from '@/lib/mechanics/types';

type View = 'home' | 'loading' | 'gallery' | 'play';

/**
 * The core loop (§3, §12): type a skill → (maybe one clarifying question) →
 * option cards → play → grade → try another / make it harder / new skill.
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
  /** true while we're waiting on the answer to a clarifying question */
  const [awaitingClarify, setAwaitingClarify] = useState(false);

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
        setAwaitingClarify(false);
        return;
      }

      setSkill(data.skillContext);

      // A vague prompt comes back with a question and no puzzles (§12.4): ask
      // exactly once, then whatever they say next is treated as the real skill.
      if (
        data.skillContext?.needsClarification &&
        data.skillContext.clarifyingQuestion &&
        (data.instances?.length ?? 0) === 0
      ) {
        setAwaitingClarify(true);
        setView('home');
        return;
      }

      setAwaitingClarify(false);
      setInstances(data.instances ?? []);
      setView(data.instances?.length ? 'gallery' : 'home');
      if (!data.instances?.length) {
        setError('Could not build a set for that. Try naming the skill a little differently.');
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setView('home');
      setAwaitingClarify(false);
    }
  };

  /** Deterministic grading (§11) — procedural mechanics can grade fully offline. */
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
    setAwaitingClarify(false);
    setLastPrompt('');
  };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.12em] text-slate-400 uppercase">
          Skill Puzzles
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
          {view === 'home'
            ? 'What do you want to get better at?'
            : (skill?.canonicalSkill ?? '')}
        </h1>
        {view !== 'home' && skill && (
          <p className="mt-1 text-sm text-slate-500">Practising “{skill.rawPrompt}”</p>
        )}
      </header>

      {view === 'home' && (
        <>
          {awaitingClarify && skill?.clarifyingQuestion && (
            <div className="rounded-3xl rounded-bl-lg border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-sm leading-relaxed text-indigo-950">
                {skill.clarifyingQuestion}
              </p>
            </div>
          )}
          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </p>
          )}
          <ChatInput
            key={awaitingClarify ? 'clarify' : 'fresh'}
            onSubmit={run}
            busy={false}
            placeholder={
              awaitingClarify
                ? 'Answer in a few words…'
                : 'e.g. I want to improve my critical thinking'
            }
          />
          {!awaitingClarify && (
            <p className="text-xs leading-relaxed text-slate-400">
              Every puzzle is checked before you see it — procedural ones are verified
              solvable, and generated ones are schema-validated.
            </p>
          )}
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
        <PlayShell
          key={playing.id}
          instance={playing}
          grade={grade}
          onNewSkill={reset}
          onBackToGallery={
            instances.length > 0
              ? () => {
                  setPlaying(null);
                  setView('gallery');
                }
              : undefined
          }
        />
      )}
    </main>
  );
}
