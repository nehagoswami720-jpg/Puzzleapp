/**
 * Hardcoded Phase 0 instances for the /dev harness — one per engine shape, so
 * the renderers and graders can be exercised before any generator exists.
 *
 * The Zip fixture is built from an explicit boustrophedon Hamiltonian path with
 * checkpoints placed along it in path order and walls only on edges that path
 * never uses, so it is solvable by construction (the same invariant the Phase 1
 * generator enforces).
 */
import type { MultipleChoiceContent, MultipleChoiceSolution } from '@/lib/mechanics/multipleChoice';
import { trainsLabel } from '@/lib/mechanics/subskills';
import type { PuzzleInstance, SkillContext } from '@/lib/mechanics/types';
import type { ZipContent, ZipSolution } from '@/lib/mechanics/zip';

const devSkill = (canonicalSkill: string, domain: SkillContext['domain']): SkillContext => ({
  rawPrompt: '(dev harness — hardcoded fixture)',
  canonicalSkill,
  subSkills: [],
  domain,
  needsClarification: false,
});

// ------------------------------------------------------------------- Zip ----

const ZIP_ROWS = 5;
const ZIP_COLS = 5;

/** Row-major snake: →→→→ ↓ ←←←← ↓ →→→→ … Covers all 25 cells exactly once. */
const zipSolution: ZipSolution = (() => {
  const cells: ZipSolution = [];
  for (let r = 0; r < ZIP_ROWS; r++) {
    if (r % 2 === 0) for (let c = 0; c < ZIP_COLS; c++) cells.push([r, c]);
    else for (let c = ZIP_COLS - 1; c >= 0; c--) cells.push([r, c]);
  }
  return cells;
})();

const zipContent: ZipContent = {
  rows: ZIP_ROWS,
  cols: ZIP_COLS,
  // Path positions 0, 6, 12, 18, 24 — endpoints first, evenly spaced between.
  checkpoints: [0, 6, 12, 18, 24].map((pos, i) => ({
    n: i + 1,
    row: zipSolution[pos][0],
    col: zipSolution[pos][1],
  })),
  // Vertical edges the snake never traverses (it only descends at the ends).
  walls: [
    { between: [[0, 0], [1, 0]] },
    { between: [[1, 2], [2, 2]] },
    { between: [[2, 1], [3, 1]] },
    { between: [[3, 3], [4, 3]] },
  ],
};

export const zipFixture: PuzzleInstance<ZipContent, ZipSolution> = {
  id: 'dev-zip-1',
  mechanicId: 'zip',
  skillContext: devSkill('Planning', 'spatial'),
  subSkillsTrained: ['planning', 'sequential-reasoning', 'spatial-reasoning'],
  difficulty: 'easy',
  title: 'Zip',
  trainsLabel: trainsLabel(['planning', 'spatial-reasoning']),
  prompt:
    'Start on 1 and draw one continuous line that fills every cell and reaches the numbers in order. Move up, down, left or right — never through a wall.',
  content: zipContent,
  solution: zipSolution,
  explanation:
    'Every Zip board is built from a real Hamiltonian path, so a valid solution always exists. Walls sit only on edges the solution never uses — which means a wall is a hint about where the line cannot go, not a dead end you have to gamble on.',
  engine: 'procedural',
};

// -------------------------------------------------------- Multiple choice ----

export const multipleChoiceFixture: PuzzleInstance<
  MultipleChoiceContent,
  MultipleChoiceSolution
> = {
  id: 'dev-mc-1',
  mechanicId: 'spot-the-fallacy',
  skillContext: devSkill('Critical Thinking', 'reasoning'),
  subSkillsTrained: ['fallacy-detection', 'argument-evaluation'],
  difficulty: 'medium',
  title: 'Spot the Fallacy',
  trainsLabel: trainsLabel(['fallacy-detection', 'argument-evaluation']),
  prompt: 'This short argument commits exactly one logical fallacy. Which one?',
  content: {
    stem: "Every doctor I've asked recommends this supplement, so it must actually work. And honestly, anyone who doubts it clearly hasn't done their research.",
    options: [
      'Appeal to authority',
      'False dilemma',
      'Slippery slope',
      'Circular reasoning',
    ],
  },
  solution: 0,
  explanation:
    "The argument's only support is that doctors endorse it — expertise is treated as proof rather than as evidence to be weighed. That's an appeal to authority. (The jab at doubters is rude, but it isn't what carries the argument, so it isn't the fallacy being tested.)",
  engine: 'llm',
};
