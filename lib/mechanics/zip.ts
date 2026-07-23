/**
 * Zip — procedural (Engine A), §9.1.
 *
 * Phase 0 provides the content/solution shapes plus the deterministic rule
 * checker that both the renderer and `grade()` use. The generator (lifted from
 * the verified prototype) lands in Phase 1.
 */
import type { GradeResult, PuzzleInstance } from './types';

export interface ZipCheckpoint {
  /** 1..k, hit in ascending order */
  n: number;
  row: number;
  col: number;
}

export type Cell = [row: number, col: number];

export interface ZipWall {
  /** the blocked edge, as its two orthogonally adjacent cells */
  between: [Cell, Cell];
}

export interface ZipContent {
  rows: number;
  cols: number;
  checkpoints: ZipCheckpoint[];
  walls: ZipWall[];
}

/** Ordered list of cells — the Hamiltonian path. */
export type ZipSolution = Cell[];

/** The player's submitted path, same shape as the solution. */
export type ZipAnswer = Cell[];

// ---------------------------------------------------------------- indexing --

export const toIndex = (cols: number, row: number, col: number) => row * cols + col;
export const toCell = (cols: number, i: number): Cell => [Math.floor(i / cols), i % cols];

/** Undirected edge key over cell indices. */
export const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export function wallSet(content: ZipContent): Set<string> {
  const { cols } = content;
  const out = new Set<string>();
  for (const w of content.walls) {
    const [[r1, c1], [r2, c2]] = w.between;
    out.add(edgeKey(toIndex(cols, r1, c1), toIndex(cols, r2, c2)));
  }
  return out;
}

/** cell index -> checkpoint number */
export function checkpointMap(content: ZipContent): Map<number, number> {
  const out = new Map<number, number>();
  for (const cp of content.checkpoints) {
    out.set(toIndex(content.cols, cp.row, cp.col), cp.n);
  }
  return out;
}

export function isAdjacent(cols: number, a: number, b: number): boolean {
  const ra = Math.floor(a / cols);
  const ca = a % cols;
  const rb = Math.floor(b / cols);
  const cb = b % cols;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

// ------------------------------------------------------------ rule checking --

export interface ZipCheck {
  ok: boolean;
  /** first rule broken, for feedback */
  reason?: string;
}

/**
 * The four app-enforced rules (§9.1): one continuous path, starts at 1, hits
 * numbered checkpoints in ascending order, visits every cell exactly once,
 * orthogonal moves only, never crosses a wall segment.
 */
export function checkZipPath(content: ZipContent, path: ZipAnswer): ZipCheck {
  const { rows, cols } = content;
  const total = rows * cols;
  const walls = wallSet(content);
  const checkpoints = checkpointMap(content);

  if (path.length !== total) {
    return { ok: false, reason: `The path covers ${path.length} of ${total} cells.` };
  }

  const seen = new Set<number>();
  let hits = 0;

  for (let i = 0; i < path.length; i++) {
    const [r, c] = path[i];
    if (r < 0 || c < 0 || r >= rows || c >= cols) {
      return { ok: false, reason: 'The path leaves the board.' };
    }
    const idx = toIndex(cols, r, c);

    if (seen.has(idx)) {
      return { ok: false, reason: 'The path revisits a cell — every cell is used exactly once.' };
    }
    seen.add(idx);

    if (i > 0) {
      const prev = toIndex(cols, path[i - 1][0], path[i - 1][1]);
      if (!isAdjacent(cols, prev, idx)) {
        return { ok: false, reason: 'The path jumps — moves must be up, down, left or right.' };
      }
      if (walls.has(edgeKey(prev, idx))) {
        return { ok: false, reason: 'The path crosses a wall.' };
      }
    }

    const n = checkpoints.get(idx);
    if (n !== undefined) {
      hits += 1;
      if (n !== hits) {
        return {
          ok: false,
          reason: `Number ${n} was reached out of order — they must be visited 1, 2, 3, …`,
        };
      }
    }
  }

  if (hits !== checkpoints.size) {
    return { ok: false, reason: 'Not every numbered cell was reached.' };
  }

  return { ok: true };
}

/** Deterministic grading (§9.1) — reused by the mechanic's `grade()` in Phase 1. */
export async function gradeZipPath(
  instance: PuzzleInstance<ZipContent, ZipSolution>,
  answer: ZipAnswer,
): Promise<GradeResult> {
  const check = checkZipPath(instance.content, answer ?? []);
  return {
    correct: check.ok,
    feedback: check.ok
      ? 'Solved — one line, every cell, numbers in order.'
      : (check.reason ?? 'That path breaks one of the rules.'),
    explanation: instance.explanation,
    revealedSolution: check.ok ? undefined : instance.solution,
  };
}

/**
 * Incremental legality test used by the board while drawing, so an illegal move
 * is simply refused rather than producing an invalid submission.
 */
export function canEnter(content: ZipContent, path: number[], target: number): boolean {
  if (path.includes(target)) return false;
  const end = path[path.length - 1];
  if (!isAdjacent(content.cols, end, target)) return false;
  if (wallSet(content).has(edgeKey(end, target))) return false;

  const checkpoints = checkpointMap(content);
  const n = checkpoints.get(target);
  if (n !== undefined) {
    const hits = path.reduce((acc, cell) => acc + (checkpoints.has(cell) ? 1 : 0), 0);
    if (n !== hits + 1) return false;
  }
  return true;
}
