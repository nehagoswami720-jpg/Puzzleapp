/**
 * Make the Target — procedural (Engine A), a 24-game-style puzzle. Combine the
 * given numbers with + − × ÷ (each number once) to hit the target. Built by
 * construction so a solution always exists; graded by evaluating whatever
 * expression the player writes. Client-safe; grades offline.
 */
import { mulberry32, pick, randInt, randomSeed, shuffle, type Rng } from '../rng';
import { checkTarget } from './arithmetic';
import { trainsLabel, type SubSkill } from './subskills';
import type { TextInputAnswer, TextInputContent } from './textInput';
import type { Difficulty, GenerateArgs, GradeResult, Mechanic } from './types';

export interface MakeTargetSolution {
  numbers: number[];
  target: number;
  example: string;
}

const PARAMS: Record<Difficulty, { count: number; ops: string[]; maxTarget: number }> = {
  easy: { count: 3, ops: ['+', '-'], maxTarget: 30 },
  medium: { count: 4, ops: ['+', '-', '*'], maxTarget: 40 },
  hard: { count: 4, ops: ['+', '-', '*', '/'], maxTarget: 60 },
};

function build(difficulty: Difficulty, rng: Rng): MakeTargetSolution {
  const { count, ops, maxTarget } = PARAMS[difficulty];
  for (let attempt = 0; attempt < 200; attempt++) {
    const numbers = Array.from({ length: count }, () => randInt(rng, 1, 9));
    // Fold left with random ops; require clean integer intermediates so the
    // example (and mental play) stays tidy.
    let value = numbers[0];
    // Build a fully left-parenthesised expression so the string evaluates to the
    // same value as this left fold — without parens, precedence would disagree
    // (e.g. "10 - 2 * 3" is 4, not the folded 24).
    let expr = String(numbers[0]);
    let ok = true;
    for (let i = 1; i < count; i++) {
      const op = pick(ops, rng);
      const n = numbers[i];
      if (op === '/' && (n === 0 || value % n !== 0)) {
        ok = false;
        break;
      }
      value = op === '+' ? value + n : op === '-' ? value - n : op === '*' ? value * n : value / n;
      expr = `(${expr} ${op} ${n})`;
    }
    if (!ok) continue;
    if (Number.isInteger(value) && value >= 1 && value <= maxTarget) {
      // Present the numbers in a shuffled order so the fold isn't given away.
      const display = shuffle(numbers, rng);
      return { numbers: display, target: value, example: expr };
    }
  }
  // Fallback: pure addition always works.
  const numbers = Array.from({ length: count }, () => randInt(rng, 1, 9));
  return {
    numbers,
    target: numbers.reduce((a, b) => a + b, 0),
    example: numbers.join(' + '),
  };
}

const MT_SUB_SKILLS: SubSkill[] = ['mental-arithmetic', 'systematic-search', 'numerical-pattern'];

export const makeTargetMechanic: Mechanic<TextInputContent, TextInputAnswer, MakeTargetSolution> = {
  id: 'make-target',
  name: 'Make the Target',
  description:
    'Combine the given numbers with + − × ÷, using each once, to hit the target. Trains flexible arithmetic and search.',
  subSkills: MT_SUB_SKILLS,
  engine: 'procedural',
  matchMode: 'cognitive',
  answerType: 'open',
  difficulties: ['easy', 'medium', 'hard'],

  async generate({ skill, difficulty, seed }: GenerateArgs) {
    const s = (seed ?? randomSeed()) >>> 0;
    const sol = build(difficulty, mulberry32(s));
    return {
      id: `make-target-${s}-${difficulty}`,
      mechanicId: 'make-target',
      skillContext: skill,
      subSkillsTrained: MT_SUB_SKILLS,
      difficulty,
      title: 'Make the Target',
      trainsLabel: trainsLabel(MT_SUB_SKILLS),
      prompt: `Use each number once with + − × ÷ to make ${sol.target}. Type your expression.`,
      content: {
        display: `${sol.numbers.join('   ')}  →  ${sol.target}`,
        placeholder: 'e.g. (9 - 7) × 3',
      },
      solution: sol,
      explanation: `One way: ${sol.example} = ${sol.target}. There are often several.`,
      engine: 'procedural' as const,
    };
  },

  async grade(instance, answer): Promise<GradeResult> {
    const { numbers, target } = instance.solution;
    const check = checkTarget(String(answer ?? ''), numbers, target);
    return {
      correct: check.ok,
      feedback: check.ok ? `Correct — that makes ${target}!` : (check.reason ?? 'Not quite.'),
      explanation: instance.explanation,
      revealedSolution: check.ok ? undefined : instance.solution,
    };
  },
};
