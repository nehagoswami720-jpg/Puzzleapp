/**
 * Zip — procedural (Engine A), §9.1.
 *
 * Solvable by construction: build a Hamiltonian path covering every cell, place
 * checkpoints along that path in path order, then add walls only on edges the
 * path never uses. The stored path is a concrete solution, so a board can never
 * be unsolvable. A bounded solver then verifies that independently — and at
 * medium/hard, that the solution is unique.
 *
 * generateHamPath / snakePath / placeCheckpoints / buildWalls are ported from
 * the verified prototype; the solver and the generate-then-verify loop are new.
 */
import { mulberry32, randomSeed, type Rng } from '../rng';
import { trainsLabel, type SubSkill } from './subskills';
import type {
  Difficulty,
  GenerateArgs,
  GradeResult,
  Mechanic,
  PuzzleInstance,
} from './types';

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

// ------------------------------------------------------- path construction --
// Ported from the verified prototype (ZipPrototype.jsx). Behaviour unchanged;
// only types and module boundaries differ.

const neighbours = (rows: number, cols: number, i: number): number[] => {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  if (r > 0) out.push(i - cols);
  if (r < rows - 1) out.push(i + cols);
  if (c > 0) out.push(i - 1);
  if (c < cols - 1) out.push(i + 1);
  return out;
};

/**
 * Random Hamiltonian path via DFS with the Warnsdorff heuristic (always step
 * toward the most-constrained cell first) plus backtracking. Returns null if the
 * node budget runs out — callers fall back to `snakePath`.
 */
export function generateHamPath(rows: number, cols: number, rng: Rng): number[] | null {
  const total = rows * cols;
  const start = Math.floor(rng() * total);
  const path = [start];
  const visited = new Uint8Array(total);
  visited[start] = 1;
  let budget = 300_000;

  const openCount = (i: number) =>
    neighbours(rows, cols, i).reduce((n, x) => n + (visited[x] ? 0 : 1), 0);

  function dfs(): boolean {
    if (budget-- <= 0) return false;
    if (path.length === total) return true;
    const cur = path[path.length - 1];
    const opts = neighbours(rows, cols, cur).filter((x) => !visited[x]);
    for (let k = opts.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [opts[k], opts[j]] = [opts[j], opts[k]];
    }
    opts.sort((a, b) => openCount(a) - openCount(b)); // Warnsdorff
    for (const nx of opts) {
      visited[nx] = 1;
      path.push(nx);
      if (dfs()) return true;
      path.pop();
      visited[nx] = 0;
    }
    return false;
  }

  return dfs() ? path : null;
}

/** Boustrophedon fallback — always exists for any rectangular grid. */
export function snakePath(rows: number, cols: number): number[] {
  const p: number[] = [];
  for (let r = 0; r < rows; r++) {
    if (r % 2 === 0) for (let c = 0; c < cols; c++) p.push(r * cols + c);
    else for (let c = cols - 1; c >= 0; c--) p.push(r * cols + c);
  }
  return p;
}

/** Place k checkpoints along the path in path order — endpoints first. */
export function placeCheckpoints(path: number[], k: number): Map<number, number> {
  const total = path.length;
  k = Math.max(2, Math.min(k, total));
  const posSet = new Set<number>([0, total - 1]);
  for (let m = 1; m < k - 1; m++) {
    let pos = Math.round((m * (total - 1)) / (k - 1));
    while (posSet.has(pos) && pos < total - 1) pos++;
    while (posSet.has(pos) && pos > 0) pos--;
    posSet.add(pos);
  }
  const positions = [...posSet].sort((a, b) => a - b);
  const map = new Map<number, number>();
  positions.forEach((pos, i) => map.set(path[pos], i + 1));
  return map;
}

/** Walls only on edges the solution path never traverses. */
export function buildWalls(
  path: number[],
  rows: number,
  cols: number,
  density: number,
  rng: Rng,
): Set<string> {
  const used = new Set<string>();
  for (let i = 0; i < path.length - 1; i++) used.add(edgeKey(path[i], path[i + 1]));

  const cand: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c < cols - 1) {
        const k = edgeKey(i, i + 1);
        if (!used.has(k)) cand.push(k);
      }
      if (r < rows - 1) {
        const k = edgeKey(i, i + cols);
        if (!used.has(k)) cand.push(k);
      }
    }
  }
  for (let k = cand.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [cand[k], cand[j]] = [cand[j], cand[k]];
  }
  return new Set(cand.slice(0, Math.floor(cand.length * density)));
}

// -------------------------------------------------------------- the solver --

export interface SolveReport {
  /** capped at `limit` — we only ever need to know "0", "1", or "more than 1" */
  count: number;
  /** true if the node budget ran out, so `count` is a lower bound */
  exhausted: boolean;
}

/**
 * Counts distinct valid solutions, stopping at `limit`. Used for
 * generate-then-verify: ≥1 proves solvable, exactly 1 proves unique.
 *
 * Pruning is what makes 7×7 tractable: after every move, flood-fill the
 * unvisited region through non-wall edges from the current cell. If any
 * unvisited cell is unreachable, the branch is dead — no Hamiltonian path can
 * come back for it.
 */
export function countSolutions(
  content: ZipContent,
  limit = 2,
  budget = 400_000,
): SolveReport {
  const { rows, cols } = content;
  const total = rows * cols;
  const walls = wallSet(content);
  const checkpoints = checkpointMap(content);

  const start = content.checkpoints.find((c) => c.n === 1);
  if (!start) return { count: 0, exhausted: false };
  const startIdx = toIndex(cols, start.row, start.col);

  const visited = new Uint8Array(total);
  const passable = (a: number, b: number) => !walls.has(edgeKey(a, b));

  let count = 0;
  let nodes = 0;
  let exhausted = false;

  /** Every unvisited cell must still be reachable from `from`. */
  function connected(from: number, remaining: number): boolean {
    const seen = new Uint8Array(total);
    const stack = [from];
    seen[from] = 1;
    let reached = 0;
    while (stack.length) {
      const cur = stack.pop()!;
      for (const nx of neighbours(rows, cols, cur)) {
        if (seen[nx] || visited[nx] || !passable(cur, nx)) continue;
        seen[nx] = 1;
        reached++;
        stack.push(nx);
      }
    }
    return reached === remaining;
  }

  function dfs(cur: number, depth: number, hits: number): void {
    if (count >= limit || exhausted) return;
    if (++nodes > budget) {
      exhausted = true;
      return;
    }
    if (depth === total) {
      if (hits === checkpoints.size) count++;
      return;
    }
    if (!connected(cur, total - depth)) return;

    for (const nx of neighbours(rows, cols, cur)) {
      if (visited[nx] || !passable(cur, nx)) continue;
      const n = checkpoints.get(nx);
      if (n !== undefined && n !== hits + 1) continue; // out of order
      visited[nx] = 1;
      dfs(nx, depth + 1, n !== undefined ? hits + 1 : hits);
      visited[nx] = 0;
      if (count >= limit || exhausted) return;
    }
  }

  visited[startIdx] = 1;
  const startN = checkpoints.get(startIdx);
  dfs(startIdx, 1, startN !== undefined ? 1 : 0);

  return { count, exhausted };
}

// ----------------------------------------------------------- the generator --

interface ZipParams {
  size: number;
  density: number;
  /** require a unique solution, not merely a solvable board */
  requireUnique: boolean;
}

const ZIP_PARAMS: Record<Difficulty, ZipParams> = {
  easy: { size: 5, density: 0.12, requireUnique: false },
  medium: { size: 6, density: 0.22, requireUnique: true },
  hard: { size: 7, density: 0.34, requireUnique: true },
};

function toContent(
  rows: number,
  cols: number,
  checkpoints: Map<number, number>,
  walls: Set<string>,
): ZipContent {
  return {
    rows,
    cols,
    checkpoints: [...checkpoints.entries()]
      .map(([cell, n]) => {
        const [row, col] = toCell(cols, cell);
        return { n, row, col };
      })
      .sort((a, b) => a.n - b.n),
    walls: [...walls].map((key) => {
      const [a, b] = key.split('-').map(Number);
      return { between: [toCell(cols, a), toCell(cols, b)] as [Cell, Cell] };
    }),
  };
}

export interface ZipBuildResult {
  content: ZipContent;
  solution: ZipSolution;
  seed: number;
  attempts: number;
  /** false when uniqueness was wanted but couldn't be confirmed within budget */
  unique: boolean;
}

/**
 * Generate-then-verify (§14). Each attempt raises wall density, which prunes
 * alternative routes and pushes the board toward a unique solution.
 *
 * The board is *always* solvable — that invariant comes from construction and
 * is confirmed by the solver. Uniqueness is best-effort: if no attempt confirms
 * it within budget we return the last solvable board rather than failing, and
 * flag `unique: false` so callers can see it happened.
 */
export function buildZip(difficulty: Difficulty, seed: number, maxAttempts = 6): ZipBuildResult {
  const { size, density, requireUnique } = ZIP_PARAMS[difficulty];
  const rows = size;
  const cols = size;
  const total = rows * cols;

  let fallback: ZipBuildResult | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptSeed = (seed + attempt * 0x9e3779b9) >>> 0;
    const rng = mulberry32(attemptSeed);

    const path = generateHamPath(rows, cols, rng) ?? snakePath(rows, cols);
    const k = Math.max(5, Math.min(14, Math.round(total / 4)));
    const checkpoints = placeCheckpoints(path, k);
    // Escalate density on each retry to squeeze out alternative solutions.
    const walls = buildWalls(path, rows, cols, Math.min(0.85, density + attempt * 0.12), rng);

    const content = toContent(rows, cols, checkpoints, walls);
    const solution = path.map((i) => toCell(cols, i));

    // The construction guarantees this, but verify rather than assume.
    if (!checkZipPath(content, solution).ok) continue;

    const report = countSolutions(content, 2);
    if (report.count === 0 && !report.exhausted) continue; // solver disagrees — discard

    const result: ZipBuildResult = {
      content,
      solution,
      seed: attemptSeed,
      attempts: attempt + 1,
      unique: report.count === 1 && !report.exhausted,
    };
    if (!requireUnique || result.unique) return result;
    fallback ??= result;
  }

  if (fallback) return fallback;

  // Last resort: the snake path always exists and always solves.
  const rng = mulberry32(seed);
  const path = snakePath(rows, cols);
  const checkpoints = placeCheckpoints(path, Math.max(5, Math.round(total / 4)));
  const walls = buildWalls(path, rows, cols, density, rng);
  return {
    content: toContent(rows, cols, checkpoints, walls),
    solution: path.map((i) => toCell(cols, i)),
    seed,
    attempts: maxAttempts,
    unique: false,
  };
}

// -------------------------------------------------------------- the mechanic --

const ZIP_SUB_SKILLS: SubSkill[] = [
  'planning',
  'sequential-reasoning',
  'spatial-reasoning',
  'systematic-search',
];

export const zipMechanic: Mechanic<ZipContent, ZipAnswer, ZipSolution> = {
  id: 'zip',
  name: 'Zip',
  description:
    'Draw one continuous line that fills every cell of a small grid, passing through numbered checkpoints in order and never crossing a wall. Trains route planning and holding a sequence in mind.',
  subSkills: ZIP_SUB_SKILLS,
  engine: 'procedural',
  matchMode: 'cognitive',
  answerType: 'path',
  difficulties: ['easy', 'medium', 'hard'],

  async generate({ skill, difficulty, seed }: GenerateArgs) {
    const built = buildZip(difficulty, seed ?? randomSeed());
    const grid = `${built.content.rows}×${built.content.cols}`;
    return {
      id: `zip-${built.seed}-${difficulty}`,
      mechanicId: 'zip',
      skillContext: skill,
      subSkillsTrained: ZIP_SUB_SKILLS,
      difficulty,
      title: 'Zip',
      trainsLabel: trainsLabel(['planning', 'spatial-reasoning']),
      prompt: `Start on 1 and draw one continuous line that fills all ${built.content.rows * built.content.cols} cells of the ${grid} grid, reaching the numbers in order. Move up, down, left or right — never through a wall.`,
      content: built.content,
      solution: built.solution,
      explanation:
        'Every board is built from a real path that covers every cell, so a solution always exists. Walls sit only on edges that solution never uses, which makes them information rather than obstacles: a wall tells you where the line cannot go, so the cells around it usually have only one way in and one way out. Working outward from the most boxed-in cells is faster than guessing from the middle.',
      engine: 'procedural' as const,
    };
  },

  grade: gradeZipPath,
};
