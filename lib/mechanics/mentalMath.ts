/**
 * Mental Math — procedural (Engine A). One arithmetic expression to evaluate in
 * your head. Uses only + − × so the answer is always a clean integer.
 * Client-safe; grades offline.
 */
import { mulberry32, pick, randInt, randomSeed, type Rng } from '../rng';
import { evaluate } from './arithmetic';
import { trainsLabel, type SubSkill } from './subskills';
import type { TextInputAnswer, TextInputContent } from './textInput';
import type { Difficulty, GenerateArgs, GradeResult, Mechanic } from './types';

const PARAMS: Record<Difficulty, { terms: number; max: number }> = {
  easy: { terms: 2, max: 25 },
  medium: { terms: 3, max: 30 },
  hard: { terms: 4, max: 40 },
};

function buildExpression(difficulty: Difficulty, rng: Rng): { display: string; value: number } {
  const { terms, max } = PARAMS[difficulty];
  for (let attempt = 0; attempt < 40; attempt++) {
    const parts: string[] = [String(randInt(rng, 2, max))];
    for (let i = 1; i < terms; i++) {
      const op = pick(['+', '−', '×'], rng);
      // Keep multiplication operands small so it stays mental-arithmetic-sized.
      const n = op === '×' ? randInt(rng, 2, 9) : randInt(rng, 2, max);
      parts.push(op, String(n));
    }
    const display = parts.join(' ');
    const { value } = evaluate(display.replace(/−/g, '-').replace(/×/g, '*'));
    if (Number.isInteger(value) && value > 0 && value < 100000) return { display, value };
  }
  const a = randInt(rng, 10, max);
  const b = randInt(rng, 10, max);
  return { display: `${a} + ${b}`, value: a + b };
}

const MM_SUB_SKILLS: SubSkill[] = ['mental-arithmetic', 'numerical-pattern'];

export const mentalMathMechanic: Mechanic<TextInputContent, TextInputAnswer, number> = {
  id: 'mental-math',
  name: 'Mental Math',
  description:
    'Work out one arithmetic expression in your head. Trains fast, accurate mental arithmetic.',
  subSkills: MM_SUB_SKILLS,
  engine: 'procedural',
  matchMode: 'cognitive',
  answerType: 'exact',
  difficulties: ['easy', 'medium', 'hard'],

  async generate({ skill, difficulty, seed }: GenerateArgs) {
    const s = (seed ?? randomSeed()) >>> 0;
    const { display, value } = buildExpression(difficulty, mulberry32(s));
    return {
      id: `mental-math-${s}-${difficulty}`,
      mechanicId: 'mental-math',
      skillContext: skill,
      subSkillsTrained: MM_SUB_SKILLS,
      difficulty,
      title: 'Mental Math',
      trainsLabel: trainsLabel(MM_SUB_SKILLS),
      prompt: 'Work it out in your head and type the answer.',
      content: { display: `${display} = ?`, placeholder: 'answer', numeric: true },
      solution: value,
      explanation:
        'Chunk it: handle the multiplication first, then run the additions and subtractions left to right. Rounding to a friendly number and correcting is often faster than exact steps.',
      engine: 'procedural' as const,
    };
  },

  async grade(instance, answer): Promise<GradeResult> {
    const n = Number(String(answer ?? '').trim());
    const correct = Number.isFinite(n) && n === instance.solution;
    return {
      correct,
      feedback: correct ? 'Correct!' : `Not quite — it was ${instance.solution}.`,
      explanation: instance.explanation,
      revealedSolution: instance.solution,
    };
  },
};
