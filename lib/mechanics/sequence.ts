/**
 * Sequence — procedural (Engine A), §9.2.
 *
 * Pick a rule with seeded parameters, emit the terms, hide the tail.
 *
 * The verify step here is about *ambiguity* rather than solvability: a run of
 * numbers can legitimately continue more than one way, and a puzzle with two
 * defensible answers is as broken as an unsolvable board. So every candidate is
 * re-fitted with every rule family we know; if a different family also fits the
 * visible terms but predicts a different continuation, the candidate is thrown
 * away and we try another seed.
 */
import { mulberry32, pick, randInt, randomSeed } from '../rng';
import { trainsLabel, type SubSkill } from './subskills';
import type {
  Difficulty,
  GenerateArgs,
  GradeResult,
  Mechanic,
  PuzzleInstance,
} from './types';

export interface SequenceContent {
  /**
   * The full run, with `null` at each hidden position. (§9.2 types this as
   * `number[]`; nulls keep the answer out of client-visible content, the same
   * split the multiple-choice mechanics make.)
   */
  terms: (number | null)[];
  /** indices into `terms` that are hidden */
  blanks: number[];
}

/** The hidden values, in blank order. */
export type SequenceSolution = number[];
export type SequenceAnswer = number[];

// ------------------------------------------------------------ rule families --

type RuleKind = 'arithmetic' | 'geometric' | 'alternating' | 'quadratic' | 'fibonacci';

/** A fitted rule: does it match the visible terms, and what comes next? */
interface Fit {
  fits: boolean;
  predict(count: number): number[];
}

const NO_FIT: Fit = { fits: false, predict: () => [] };

function fitArithmetic(v: number[]): Fit {
  if (v.length < 2) return NO_FIT;
  const d = v[1] - v[0];
  for (let i = 2; i < v.length; i++) if (v[i] - v[i - 1] !== d) return NO_FIT;
  return {
    fits: true,
    predict: (n) => Array.from({ length: n }, (_, k) => v[v.length - 1] + d * (k + 1)),
  };
}

function fitGeometric(v: number[]): Fit {
  if (v.length < 3 || v[0] === 0) return NO_FIT;
  const r = v[1] / v[0];
  if (!Number.isFinite(r) || r === 0) return NO_FIT;
  for (let i = 1; i < v.length; i++) if (v[i] !== v[i - 1] * r) return NO_FIT;
  return {
    fits: true,
    predict: (n) => {
      const out: number[] = [];
      let cur = v[v.length - 1];
      for (let k = 0; k < n; k++) out.push((cur *= r));
      return out;
    },
  };
}

/** Two interleaved arithmetic runs. */
function fitAlternating(v: number[]): Fit {
  if (v.length < 4) return NO_FIT;
  const evens = v.filter((_, i) => i % 2 === 0);
  const odds = v.filter((_, i) => i % 2 === 1);
  if (evens.length < 2 || odds.length < 2) return NO_FIT;
  const de = evens[1] - evens[0];
  const dd = odds[1] - odds[0];
  for (let i = 2; i < evens.length; i++) if (evens[i] - evens[i - 1] !== de) return NO_FIT;
  for (let i = 2; i < odds.length; i++) if (odds[i] - odds[i - 1] !== dd) return NO_FIT;
  return {
    fits: true,
    predict: (n) => {
      const out: number[] = [];
      const e = [...evens];
      const o = [...odds];
      for (let k = 0; k < n; k++) {
        const idx = v.length + k;
        if (idx % 2 === 0) {
          e.push(e[e.length - 1] + de);
          out.push(e[e.length - 1]);
        } else {
          o.push(o[o.length - 1] + dd);
          out.push(o[o.length - 1]);
        }
      }
      return out;
    },
  };
}

/** Constant second difference. */
function fitQuadratic(v: number[]): Fit {
  if (v.length < 4) return NO_FIT;
  const d1 = v.slice(1).map((x, i) => x - v[i]);
  const dd = d1[1] - d1[0];
  for (let i = 2; i < d1.length; i++) if (d1[i] - d1[i - 1] !== dd) return NO_FIT;
  return {
    fits: true,
    predict: (n) => {
      const out: number[] = [];
      let last = v[v.length - 1];
      let step = d1[d1.length - 1];
      for (let k = 0; k < n; k++) {
        step += dd;
        out.push((last += step));
      }
      return out;
    },
  };
}

function fitFibonacci(v: number[]): Fit {
  if (v.length < 4) return NO_FIT;
  for (let i = 2; i < v.length; i++) if (v[i] !== v[i - 1] + v[i - 2]) return NO_FIT;
  return {
    fits: true,
    predict: (n) => {
      const out: number[] = [];
      let a = v[v.length - 2];
      let b = v[v.length - 1];
      for (let k = 0; k < n; k++) {
        const next = a + b;
        out.push(next);
        a = b;
        b = next;
      }
      return out;
    },
  };
}

const FITTERS: Record<RuleKind, (v: number[]) => Fit> = {
  arithmetic: fitArithmetic,
  geometric: fitGeometric,
  alternating: fitAlternating,
  quadratic: fitQuadratic,
  fibonacci: fitFibonacci,
};

// --------------------------------------------------------------- generation --

interface SequenceParams {
  kinds: RuleKind[];
  length: number;
  hidden: number;
}

const SEQ_PARAMS: Record<Difficulty, SequenceParams> = {
  easy: { kinds: ['arithmetic', 'geometric'], length: 6, hidden: 1 },
  medium: { kinds: ['arithmetic', 'geometric', 'alternating', 'quadratic'], length: 7, hidden: 1 },
  hard: { kinds: ['alternating', 'quadratic', 'fibonacci'], length: 7, hidden: 2 },
};

const MAX_TERM = 100_000;

function emit(kind: RuleKind, length: number, rng: () => number): number[] {
  switch (kind) {
    case 'arithmetic': {
      const start = randInt(rng, -20, 40);
      let d = randInt(rng, 2, 12);
      if (rng() < 0.3) d = -d;
      return Array.from({ length }, (_, i) => start + d * i);
    }
    case 'geometric': {
      const start = randInt(rng, 1, 6);
      const r = pick([2, 3, 2, 2, 4], rng);
      return Array.from({ length }, (_, i) => start * r ** i);
    }
    case 'alternating': {
      const a0 = randInt(rng, 1, 20);
      const b0 = randInt(rng, 1, 20);
      const da = randInt(rng, 2, 10);
      const db = randInt(rng, 2, 10) * (rng() < 0.4 ? -1 : 1);
      return Array.from({ length }, (_, i) =>
        i % 2 === 0 ? a0 + da * (i / 2) : b0 + db * ((i - 1) / 2),
      );
    }
    case 'quadratic': {
      const start = randInt(rng, 1, 15);
      const d0 = randInt(rng, 1, 8);
      const dd = randInt(rng, 1, 5);
      const out = [start];
      let step = d0;
      for (let i = 1; i < length; i++) {
        out.push(out[i - 1] + step);
        step += dd;
      }
      return out;
    }
    case 'fibonacci': {
      const a = randInt(rng, 1, 8);
      const b = randInt(rng, 2, 12);
      const out = [a, b];
      for (let i = 2; i < length; i++) out.push(out[i - 1] + out[i - 2]);
      return out;
    }
  }
}

/** Is every visible-term continuation agreed on by every rule that fits? */
export function isUnambiguous(visible: number[], answer: number[]): boolean {
  for (const fitter of Object.values(FITTERS)) {
    const fit = fitter(visible);
    if (!fit.fits) continue;
    const predicted = fit.predict(answer.length);
    if (predicted.some((p, i) => p !== answer[i])) return false;
  }
  return true;
}

export interface SequenceBuildResult {
  content: SequenceContent;
  solution: SequenceSolution;
  kind: RuleKind;
  seed: number;
  attempts: number;
}

export function buildSequence(
  difficulty: Difficulty,
  seed: number,
  maxAttempts = 40,
): SequenceBuildResult {
  const { kinds, length, hidden } = SEQ_PARAMS[difficulty];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptSeed = (seed + attempt * 0x9e3779b9) >>> 0;
    const rng = mulberry32(attemptSeed);
    const kind = pick(kinds, rng);
    const full = emit(kind, length, rng);

    // Reject anything unreadable or degenerate before checking ambiguity.
    if (full.some((t) => !Number.isSafeInteger(t) || Math.abs(t) > MAX_TERM)) continue;
    if (new Set(full).size < 3) continue;

    const visible = full.slice(0, length - hidden);
    const answer = full.slice(length - hidden);
    if (!isUnambiguous(visible, answer)) continue;

    const blanks = Array.from({ length: hidden }, (_, i) => length - hidden + i);
    return {
      content: {
        terms: full.map((t, i) => (blanks.includes(i) ? null : t)),
        blanks,
      },
      solution: answer,
      kind,
      seed: attemptSeed,
      attempts: attempt + 1,
    };
  }

  // Deterministic last resort: a plain arithmetic run is never ambiguous.
  const start = 3;
  const d = 4;
  const full = Array.from({ length }, (_, i) => start + d * i);
  const blanks = Array.from({ length: hidden }, (_, i) => length - hidden + i);
  return {
    content: { terms: full.map((t, i) => (blanks.includes(i) ? null : t)), blanks },
    solution: full.slice(length - hidden),
    kind: 'arithmetic',
    seed,
    attempts: maxAttempts,
  };
}

// -------------------------------------------------------------- the mechanic --

const SEQ_SUB_SKILLS: SubSkill[] = [
  'pattern-recognition',
  'numerical-pattern',
  'abstract-reasoning',
];

const RULE_HINT: Record<RuleKind, string> = {
  arithmetic: 'the same amount is added each time',
  geometric: 'each term is multiplied by a fixed number',
  alternating: 'two separate runs are interleaved — look at every other term',
  quadratic: 'the gaps themselves grow by a steady amount',
  fibonacci: 'each term is the sum of the two before it',
};

export async function gradeSequence(
  instance: PuzzleInstance<SequenceContent, SequenceSolution>,
  answer: SequenceAnswer,
): Promise<GradeResult> {
  const expected = instance.solution;
  const given = answer ?? [];
  const correct =
    given.length === expected.length && expected.every((v, i) => given[i] === v);

  return {
    correct,
    feedback: correct
      ? 'Correct — that continues the pattern.'
      : `Not quite. The run continues ${expected.join(', ')}.`,
    explanation: instance.explanation,
    revealedSolution: expected,
  };
}

export const sequenceMechanic: Mechanic<SequenceContent, SequenceAnswer, SequenceSolution> = {
  id: 'sequence',
  name: 'Number Sequence',
  description:
    'A run of numbers follows one hidden rule; work out the rule and supply the missing term(s). Trains pattern recognition over numbers.',
  subSkills: SEQ_SUB_SKILLS,
  engine: 'procedural',
  matchMode: 'cognitive',
  answerType: 'exact',
  difficulties: ['easy', 'medium', 'hard'],

  async generate({ skill, difficulty, seed }: GenerateArgs) {
    const built = buildSequence(difficulty, seed ?? randomSeed());
    const n = built.solution.length;
    return {
      id: `sequence-${built.seed}-${difficulty}`,
      mechanicId: 'sequence',
      skillContext: skill,
      subSkillsTrained: SEQ_SUB_SKILLS,
      difficulty,
      title: 'Number Sequence',
      trainsLabel: trainsLabel(['pattern-recognition', 'numerical-pattern']),
      prompt:
        n === 1
          ? 'Work out the rule behind this run of numbers and fill in the missing term.'
          : `Work out the rule behind this run of numbers and fill in the ${n} missing terms.`,
      content: built.content,
      solution: built.solution,
      explanation: `The rule here is that ${RULE_HINT[built.kind]}. When a run isn't obvious, write the gaps between consecutive terms underneath — if those gaps are constant you have an added step, if they grow steadily the rule is quadratic, and if neither works try reading every other term as its own run.`,
      engine: 'procedural' as const,
    };
  },

  grade: gradeSequence,
};
