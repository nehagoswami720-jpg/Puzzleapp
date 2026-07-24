/**
 * Memory Match — procedural (Engine A).
 *
 * A grid of face-down cards; flip two at a time to find matching pairs. Pure
 * content (emoji symbols), no LLM, generates in the browser. The match logic
 * lives in the renderer; the "answer" is simply whether every pair was found,
 * so grading just confirms completion.
 */
import { mulberry32, randomSeed, shuffle } from '../rng';
import { trainsLabel, type SubSkill } from './subskills';
import type { Difficulty, GenerateArgs, GradeResult, Mechanic, PuzzleInstance } from './types';

export interface MemoryContent {
  /** the shuffled deck — each symbol appears exactly twice */
  cards: string[];
  cols: number;
}

/** true once every pair has been matched */
export type MemorySolution = true;
export type MemoryAnswer = boolean;

/** A neutral, widely-recognisable symbol set. */
const SYMBOLS = [
  '🍎','🚀','🎸','⚽','🌙','🐙','🔑','🎲','🍄','⚡','🌵','🦋',
  '🍕','🎩','🧭','🔔','🍩','🪐','🎯','🧩','🌸','🐘','🍋','🎁',
];

const PAIRS: Record<Difficulty, { pairs: number; cols: number }> = {
  easy: { pairs: 6, cols: 4 }, // 12 cards, 3×4
  medium: { pairs: 8, cols: 4 }, // 16 cards, 4×4
  hard: { pairs: 10, cols: 4 }, // 20 cards, 5×4
};

export interface MemoryBuildResult {
  content: MemoryContent;
  seed: number;
}

export function buildMemory(difficulty: Difficulty, seed: number): MemoryBuildResult {
  const { pairs, cols } = PAIRS[difficulty];
  const rng = mulberry32(seed >>> 0);
  const chosen = shuffle(SYMBOLS, rng).slice(0, pairs);
  const cards = shuffle([...chosen, ...chosen], rng);
  return { content: { cards, cols }, seed };
}

export async function gradeMemory(
  instance: PuzzleInstance<MemoryContent, MemorySolution>,
  answer: MemoryAnswer,
): Promise<GradeResult> {
  const done = answer === true;
  return {
    correct: done,
    feedback: done ? 'Cleared — every pair matched.' : 'Match every pair to finish.',
    explanation: instance.explanation,
  };
}

const MEMORY_SUB_SKILLS: SubSkill[] = ['working-memory', 'recall', 'visual-pattern'];

export const memoryMechanic: Mechanic<MemoryContent, MemoryAnswer, MemorySolution> = {
  id: 'memory',
  name: 'Memory Match',
  description:
    'Flip cards two at a time to find every matching pair, holding their positions in mind. Trains working memory and recall.',
  subSkills: MEMORY_SUB_SKILLS,
  engine: 'procedural',
  matchMode: 'cognitive',
  answerType: 'set',
  difficulties: ['easy', 'medium', 'hard'],

  async generate({ skill, difficulty, seed }: GenerateArgs) {
    const built = buildMemory(difficulty, seed ?? randomSeed());
    const pairs = built.content.cards.length / 2;
    return {
      id: `memory-${built.seed}-${difficulty}`,
      mechanicId: 'memory',
      skillContext: skill,
      subSkillsTrained: MEMORY_SUB_SKILLS,
      difficulty,
      title: 'Memory Match',
      trainsLabel: trainsLabel(MEMORY_SUB_SKILLS),
      prompt: `Flip cards two at a time and find all ${pairs} matching pairs. Remember where each symbol is.`,
      content: built.content,
      solution: true,
      explanation:
        'Working memory improves with exactly this: hold a few positions in mind, act, and refresh. Flipping systematically — say, revealing new cards in reading order — turns luck into method.',
      engine: 'procedural' as const,
    };
  },

  grade: gradeMemory,
};
