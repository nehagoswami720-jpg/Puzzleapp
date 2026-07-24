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
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-10 pb-12">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-cyan/70 uppercase">
          Skill Puzzles
        </p>
        <h1 className="mt-2 font-display text-[2rem] leading-[1.1] font-bold tracking-tight text-ink">
          {view === 'home'
            ? 'What do you want to get better at?'
            : (skill?.canonicalSkill ?? '')}
        </h1>
        {view !== 'home' && skill && (
          <p className="mt-1.5 text-sm text-muted">Practising “{skill.rawPrompt}”</p>
        )}
      </header>

      {view === 'home' && (
        <>
          {awaitingClarify && skill?.clarifyingQuestion && (
            <div className="rise rounded-2xl rounded-bl-md border border-cyan/30 bg-cyan/5 p-4">
              <p className="text-sm leading-relaxed text-ink">{skill.clarifyingQuestion}</p>
            </div>
          )}
          {error && (
            <p className="rounded-2xl border border-rose/40 bg-rose/10 p-4 text-sm text-rose">
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
            <p className="text-xs leading-relaxed text-faint">
              Every puzzle is checked before you see it — procedural ones are verified
              solvable, and generated ones are schema-validated.
            </p>
          )}
        </>
      )}

      {view === 'loading' && (
        <>
          <p className="text-sm text-muted">Choosing puzzles for “{lastPrompt}”…</p>
          <SkeletonCards />
        </>
      )}

      {view === 'gallery' && (
        <>
          <p className="text-sm text-muted">
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
            className="min-h-12 rounded-xl border border-line bg-surface px-4 font-semibold text-muted transition hover:text-ink"
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
