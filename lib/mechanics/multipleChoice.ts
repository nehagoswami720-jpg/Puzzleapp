/**
 * Shared pieces for the ~6 LLM mechanics that render as multiple choice
 * (fallacy, hidden assumption, what-follows, cloze, odd-one-out, analogy).
 *
 * Note the split: the LLM returns the full schema from §9.3/§9.4 including
 * `correctIndex` and `explanation`, but the mechanic maps those onto
 * `PuzzleInstance.solution` / `.explanation` so the client-visible `content`
 * carries no answer key.
 */
import type { GradeResult, PuzzleInstance } from './types';

export interface MultipleChoiceContent {
  /** the sentence/argument/analogy the options answer */
  stem: string;
  options: string[];
}

/** Index into `content.options`. */
export type MultipleChoiceAnswer = number;

export type MultipleChoiceSolution = number;

export async function gradeMultipleChoice(
  instance: PuzzleInstance<MultipleChoiceContent, MultipleChoiceSolution>,
  answer: MultipleChoiceAnswer,
): Promise<GradeResult> {
  const correct = answer === instance.solution;
  return {
    correct,
    feedback: correct
      ? 'Correct — that is the best fit.'
      : `Not quite. The answer is "${instance.content.options[instance.solution]}".`,
    explanation: instance.explanation,
    revealedSolution: instance.solution,
  };
}
