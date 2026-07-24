/**
 * Client-side "generate one puzzle" — the shared path behind Try another and
 * Make it harder.
 *
 * Procedural mechanics run in the browser (instant, no network, works offline).
 * LLM mechanics can't — the key is server-side — so they go through /api/puzzle.
 */
import { getProceduralMechanic } from '@/lib/mechanics/procedural';
import type { Difficulty, PuzzleInstance, SkillContext } from '@/lib/mechanics/types';

export async function regeneratePuzzle(
  mechanicId: string,
  difficulty: Difficulty,
  skill: SkillContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<PuzzleInstance<any, any>> {
  const local = getProceduralMechanic(mechanicId);
  if (local) {
    const usable = local.difficulties.includes(difficulty)
      ? difficulty
      : local.difficulties[local.difficulties.length - 1];
    return local.generate({ skill, difficulty: usable });
  }

  const res = await fetch('/api/puzzle', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mechanicId, difficulty, skillContext: skill }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Could not generate another puzzle.');
  return data.instance;
}
