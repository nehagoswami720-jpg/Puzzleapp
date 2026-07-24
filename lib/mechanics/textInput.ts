/**
 * Shared, client-safe pieces for single-answer text/number-input puzzles
 * (anagram, mental math, make-the-target). Types + graders only — no generators,
 * no LLM — so the client can import it for grading and for the renderer.
 */
import type { GradeResult, PuzzleInstance } from './types';

export interface TextInputContent {
  /** the big thing to show above the input — scrambled letters, an expression… */
  display: string;
  placeholder: string;
  /** numeric keypad + integer-only input */
  numeric?: boolean;
}

export type TextInputAnswer = string;

const normalizeWord = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/** Anagram grading: case/space-insensitive match against the intended word. */
export async function gradeAnagram(
  instance: PuzzleInstance<TextInputContent, string>,
  answer: TextInputAnswer,
): Promise<GradeResult> {
  const correct = normalizeWord(answer ?? '') === normalizeWord(instance.solution);
  return {
    correct,
    feedback: correct ? 'Correct!' : `Not the word we had — it was "${instance.solution}".`,
    explanation: instance.explanation,
    revealedSolution: instance.solution,
  };
}
