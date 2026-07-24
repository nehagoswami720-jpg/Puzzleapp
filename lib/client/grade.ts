/**
 * Client-safe grading dispatch.
 *
 * Every mechanic's `grade()` is a pure function that needs no LLM, so grading
 * can happen in the browser (§11 permits it for exact/set/grid answers). But the
 * mechanic *modules* import lib/llm for their generators, so the client can't
 * import them — instead it reaches the graders through their client-safe format
 * modules, dispatched here by mechanic id.
 */
import { gradeConnections } from '@/lib/mechanics/connections';
import { gradeMatch } from '@/lib/mechanics/matching';
import { gradeMultipleChoice } from '@/lib/mechanics/multipleChoice';
import { getProceduralMechanic } from '@/lib/mechanics/procedural';
import { gradeAnagram } from '@/lib/mechanics/textInput';
import type { GradeResult, PuzzleInstance } from '@/lib/mechanics/types';

export async function gradeInstance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: PuzzleInstance<any, any>,
  answer: unknown,
): Promise<GradeResult> {
  const local = getProceduralMechanic(instance.mechanicId);
  if (local) return local.grade(instance, answer);

  switch (instance.mechanicId) {
    case 'connections':
      return gradeConnections(instance, answer as string[][]);
    case 'anagram':
      return gradeAnagram(instance, answer as string);
    case 'synonym-match':
      return gradeMatch(instance, answer as Record<number, number>);
    // Every other LLM mechanic renders as multiple choice.
    default:
      return gradeMultipleChoice(instance, answer as number);
  }
}
