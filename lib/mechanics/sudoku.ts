/**
 * Mini-Sudoku — procedural (Engine A).
 *
 * Solvable-and-unique by construction: build a full valid grid, then dig holes
 * one at a time, keeping a hole only while the puzzle still has exactly one
 * solution (checked by a bounded solver). Difficulty controls the grid size and
 * how many holes we aim for.
 *
 * Client-safe: pure TypeScript, no network — generates in the browser.
 */
import { mulberry32, randomSeed, shuffle, type Rng } from '../rng';
import { trainsLabel, type SubSkill } from './subskills';
import type { Difficulty, GenerateArgs, GradeResult, Mechanic, PuzzleInstance } from './types';

export interface SudokuContent {
  rows: number;
  cols: number;
  /** sub-box dimensions; boxRows*boxCols === rows === cols */
  boxRows: number;
  boxCols: number;
  /** the clue grid; 0 = empty */
  givens: number[][];
}

export type SudokuSolution = number[][];
export type SudokuAnswer = number[][];

// ------------------------------------------------------------- core helpers --

const clone = (g: number[][]) => g.map((r) => [...r]);

function canPlace(
  g: number[][],
  r: number,
  c: number,
  val: number,
  n: number,
  boxR: number,
  boxC: number,
): boolean {
  for (let i = 0; i < n; i++) {
    if (g[r][i] === val || g[i][c] === val) return false;
  }
  const br = Math.floor(r / boxR) * boxR;
  const bc = Math.floor(c / boxC) * boxC;
  for (let i = 0; i < boxR; i++) {
    for (let j = 0; j < boxC; j++) {
      if (g[br + i][bc + j] === val) return false;
    }
  }
  return true;
}

/** Fill a grid of zeros with a random valid solution. */
function fillFull(n: number, boxR: number, boxC: number, rng: Rng): number[][] {
  const g = Array.from({ length: n }, () => Array(n).fill(0));
  const nums = Array.from({ length: n }, (_, i) => i + 1);

  function solve(pos: number): boolean {
    if (pos === n * n) return true;
    const r = Math.floor(pos / n);
    const c = pos % n;
    for (const val of shuffle(nums, rng)) {
      if (canPlace(g, r, c, val, n, boxR, boxC)) {
        g[r][c] = val;
        if (solve(pos + 1)) return true;
        g[r][c] = 0;
      }
    }
    return false;
  }
  solve(0);
  return g;
}

/** Count solutions up to `limit` (we only care about 0 / 1 / >1). */
export function countSolutions(
  grid: number[][],
  n: number,
  boxR: number,
  boxC: number,
  limit = 2,
): number {
  const g = clone(grid);
  let count = 0;

  function solve(pos: number): void {
    if (count >= limit) return;
    if (pos === n * n) {
      count++;
      return;
    }
    const r = Math.floor(pos / n);
    const c = pos % n;
    if (g[r][c] !== 0) {
      solve(pos + 1);
      return;
    }
    for (let val = 1; val <= n; val++) {
      if (canPlace(g, r, c, val, n, boxR, boxC)) {
        g[r][c] = val;
        solve(pos + 1);
        g[r][c] = 0;
        if (count >= limit) return;
      }
    }
  }
  solve(0);
  return count;
}

// --------------------------------------------------------------- generation --

interface SudokuParams {
  boxRows: number;
  boxCols: number;
  /** how many cells to try to blank out */
  targetHoles: number;
}

const SUDOKU_PARAMS: Record<Difficulty, SudokuParams> = {
  easy: { boxRows: 2, boxCols: 2, targetHoles: 8 }, // 4×4
  medium: { boxRows: 2, boxCols: 3, targetHoles: 20 }, // 6×6
  hard: { boxRows: 2, boxCols: 3, targetHoles: 24 }, // 6×6, sparser
};

export interface SudokuBuildResult {
  content: SudokuContent;
  solution: SudokuSolution;
  seed: number;
}

export function buildSudoku(difficulty: Difficulty, seed: number): SudokuBuildResult {
  const { boxRows, boxCols, targetHoles } = SUDOKU_PARAMS[difficulty];
  const n = boxRows * boxCols;
  const rng = mulberry32(seed >>> 0);

  const solution = fillFull(n, boxRows, boxCols, rng);
  const givens = clone(solution);

  // Dig holes in random order, keeping each only if the puzzle stays unique.
  const positions = shuffle(
    Array.from({ length: n * n }, (_, i) => i),
    rng,
  );
  let holes = 0;
  for (const pos of positions) {
    if (holes >= targetHoles) break;
    const r = Math.floor(pos / n);
    const c = pos % n;
    const backup = givens[r][c];
    givens[r][c] = 0;
    if (countSolutions(givens, n, boxRows, boxCols, 2) !== 1) {
      givens[r][c] = backup; // removing it broke uniqueness — put it back
    } else {
      holes++;
    }
  }

  return {
    content: { rows: n, cols: n, boxRows, boxCols, givens },
    solution,
    seed,
  };
}

// -------------------------------------------------------------- rule checking --

export interface SudokuCheck {
  ok: boolean;
  reason?: string;
}

/** A completed grid is correct iff every row, column and box is a 1..n permutation. */
export function checkSudoku(content: SudokuContent, answer: SudokuAnswer): SudokuCheck {
  const { rows: n, boxRows, boxCols, givens } = content;
  if (!answer || answer.length !== n || answer.some((row) => row.length !== n)) {
    return { ok: false, reason: 'The grid is not fully filled in.' };
  }
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = answer[r][c];
      if (!Number.isInteger(v) || v < 1 || v > n) {
        return { ok: false, reason: 'Every cell needs a number.' };
      }
      if (givens[r][c] !== 0 && givens[r][c] !== v) {
        return { ok: false, reason: 'A starting number was changed.' };
      }
    }
  }
  const seen = () => new Set<number>();
  for (let i = 0; i < n; i++) {
    const row = seen();
    const col = seen();
    for (let j = 0; j < n; j++) {
      if (row.has(answer[i][j])) return { ok: false, reason: `Row ${i + 1} repeats a number.` };
      row.add(answer[i][j]);
      if (col.has(answer[j][i])) return { ok: false, reason: `Column ${i + 1} repeats a number.` };
      col.add(answer[j][i]);
    }
  }
  for (let br = 0; br < n; br += boxRows) {
    for (let bc = 0; bc < n; bc += boxCols) {
      const box = seen();
      for (let i = 0; i < boxRows; i++) {
        for (let j = 0; j < boxCols; j++) {
          const v = answer[br + i][bc + j];
          if (box.has(v)) return { ok: false, reason: 'A box repeats a number.' };
          box.add(v);
        }
      }
    }
  }
  return { ok: true };
}

export async function gradeSudoku(
  instance: PuzzleInstance<SudokuContent, SudokuSolution>,
  answer: SudokuAnswer,
): Promise<GradeResult> {
  const check = checkSudoku(instance.content, answer);
  return {
    correct: check.ok,
    feedback: check.ok
      ? 'Solved — every row, column and box holds each number once.'
      : (check.reason ?? 'That grid breaks a Sudoku rule.'),
    explanation: instance.explanation,
    revealedSolution: check.ok ? undefined : instance.solution,
  };
}

// -------------------------------------------------------------- the mechanic --

const SUDOKU_SUB_SKILLS: SubSkill[] = ['logical-consistency', 'systematic-search', 'deductive-reasoning'];

export const sudokuMechanic: Mechanic<SudokuContent, SudokuAnswer, SudokuSolution> = {
  id: 'sudoku',
  name: 'Mini Sudoku',
  description:
    'Fill the grid so every row, column and box contains each number exactly once. Trains systematic deduction and logical consistency.',
  subSkills: SUDOKU_SUB_SKILLS,
  engine: 'procedural',
  matchMode: 'cognitive',
  answerType: 'grid',
  difficulties: ['easy', 'medium', 'hard'],

  async generate({ skill, difficulty, seed }: GenerateArgs) {
    const built = buildSudoku(difficulty, seed ?? randomSeed());
    const n = built.content.rows;
    return {
      id: `sudoku-${built.seed}-${difficulty}`,
      mechanicId: 'sudoku',
      skillContext: skill,
      subSkillsTrained: SUDOKU_SUB_SKILLS,
      difficulty,
      title: 'Mini Sudoku',
      trainsLabel: trainsLabel(SUDOKU_SUB_SKILLS),
      prompt: `Fill the ${n}×${n} grid so every row, every column and every box contains the numbers 1–${n} exactly once.`,
      content: built.content,
      solution: built.solution,
      explanation:
        'Work from the most-constrained cells: find a row, column or box that already has most of its numbers, and the missing ones almost place themselves. When a cell has only one number that doesn’t clash, fill it in and repeat — no guessing required.',
      engine: 'procedural' as const,
    };
  },

  grade: gradeSudoku,
};
