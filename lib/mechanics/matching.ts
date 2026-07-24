/**
 * Shared client-safe pieces for matching-pairs puzzles (synonym match, and
 * later capital↔country, term↔definition, etc.). Types + grader only.
 */
import type { GradeResult, PuzzleInstance } from './types';

export interface MatchContent {
  /** left column, fixed order */
  left: string[];
  /** right column, shuffled */
  right: string[];
  leftLabel?: string;
  rightLabel?: string;
}

/** leftIndex → rightIndex */
export type MatchAnswer = Record<number, number>;

/** correct pairing keyed by the left value → its correct right value */
export type MatchSolution = Record<string, string>;

export async function gradeMatch(
  instance: PuzzleInstance<MatchContent, MatchSolution>,
  answer: MatchAnswer,
): Promise<GradeResult> {
  const { left, right } = instance.content;
  const sol = instance.solution;
  let correctCount = 0;
  for (let i = 0; i < left.length; i++) {
    const ri = answer?.[i];
    if (ri == null) continue;
    if (right[ri] === sol[left[i]]) correctCount++;
  }
  const allRight = correctCount === left.length;
  const reveal = left.map((l) => `${l} — ${sol[l]}`).join('\n');
  return {
    correct: allRight,
    score: correctCount / left.length,
    feedback: allRight
      ? 'All pairs matched.'
      : `${correctCount} of ${left.length} pairs correct.`,
    explanation: allRight ? instance.explanation : `The pairs were —\n${reveal}`,
    revealedSolution: sol,
  };
}
