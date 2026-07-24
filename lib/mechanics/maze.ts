/**
 * Maze — procedural (Engine A). A perfect maze (exactly one simple path between
 * any two cells), so the route from start to end is unique by construction and
 * always exists. Client-safe; grades offline.
 */
import { mulberry32, randomSeed, shuffle, type Rng } from '../rng';
import { trainsLabel, type SubSkill } from './subskills';
import type { Difficulty, GenerateArgs, GradeResult, Mechanic, PuzzleInstance } from './types';

export type Cell = [row: number, col: number];
export interface MazeWall {
  between: [Cell, Cell];
}
export interface MazeContent {
  rows: number;
  cols: number;
  walls: MazeWall[];
  start: Cell;
  end: Cell;
}
export type MazeSolution = Cell[];
export type MazeAnswer = Cell[];

export const idx = (cols: number, r: number, c: number) => r * cols + c;
export const cell = (cols: number, i: number): Cell => [Math.floor(i / cols), i % cols];
export const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

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

export function wallSet(content: MazeContent): Set<string> {
  const { cols } = content;
  const out = new Set<string>();
  for (const w of content.walls) {
    const [[r1, c1], [r2, c2]] = w.between;
    out.add(edgeKey(idx(cols, r1, c1), idx(cols, r2, c2)));
  }
  return out;
}

const SIZES: Record<Difficulty, number> = { easy: 6, medium: 7, hard: 8 };

export interface MazeBuildResult {
  content: MazeContent;
  solution: MazeSolution;
  seed: number;
}

export function buildMaze(difficulty: Difficulty, seed: number): MazeBuildResult {
  const n = SIZES[difficulty];
  const rows = n;
  const cols = n;
  const total = rows * cols;
  const rng: Rng = mulberry32(seed >>> 0);

  // Recursive-backtracker carve: passages are the edges we open.
  const passages = new Set<string>();
  const visited = new Uint8Array(total);
  const stack = [0];
  visited[0] = 1;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const unvisited = shuffle(
      neighbours(rows, cols, cur).filter((x) => !visited[x]),
      rng,
    );
    if (unvisited.length === 0) {
      stack.pop();
      continue;
    }
    const nx = unvisited[0];
    passages.add(edgeKey(cur, nx));
    visited[nx] = 1;
    stack.push(nx);
  }

  // Walls = every adjacent edge that is NOT a passage.
  const walls: MazeWall[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = idx(cols, r, c);
      if (c < cols - 1 && !passages.has(edgeKey(i, i + 1))) {
        walls.push({ between: [[r, c], [r, c + 1]] });
      }
      if (r < rows - 1 && !passages.has(edgeKey(i, i + cols))) {
        walls.push({ between: [[r, c], [r + 1, c]] });
      }
    }
  }

  const startIdx = 0;
  const endIdx = total - 1;

  // BFS shortest path (unique in a perfect maze) for the reveal.
  const prev = new Int32Array(total).fill(-1);
  const seen = new Uint8Array(total);
  const queue = [startIdx];
  seen[startIdx] = 1;
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === endIdx) break;
    for (const nx of neighbours(rows, cols, cur)) {
      if (!seen[nx] && passages.has(edgeKey(cur, nx))) {
        seen[nx] = 1;
        prev[nx] = cur;
        queue.push(nx);
      }
    }
  }
  const path: number[] = [];
  for (let at = endIdx; at !== -1; at = prev[at]) path.unshift(at);

  return {
    content: {
      rows,
      cols,
      walls,
      start: cell(cols, startIdx),
      end: cell(cols, endIdx),
    },
    solution: path.map((i) => cell(cols, i)),
    seed,
  };
}

export interface MazeCheck {
  ok: boolean;
  reason?: string;
}

export function checkMazePath(content: MazeContent, path: MazeAnswer): MazeCheck {
  const { rows, cols, start, end } = content;
  const walls = wallSet(content);
  if (!path || path.length === 0) return { ok: false, reason: 'Draw a path from Start to End.' };
  if (path[0][0] !== start[0] || path[0][1] !== start[1]) {
    return { ok: false, reason: 'The path must begin at Start.' };
  }
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    const [r, c] = path[i];
    if (r < 0 || c < 0 || r >= rows || c >= cols) return { ok: false, reason: 'The path leaves the maze.' };
    const id = idx(cols, r, c);
    if (seen.has(id)) return { ok: false, reason: 'The path crosses itself.' };
    seen.add(id);
    if (i > 0) {
      const prevId = idx(cols, path[i - 1][0], path[i - 1][1]);
      const rp = Math.floor(prevId / cols);
      const cp = prevId % cols;
      if (Math.abs(rp - r) + Math.abs(cp - c) !== 1) {
        return { ok: false, reason: 'The path jumps — move to a neighbouring cell.' };
      }
      if (walls.has(edgeKey(prevId, id))) return { ok: false, reason: 'The path goes through a wall.' };
    }
  }
  const last = path[path.length - 1];
  if (last[0] !== end[0] || last[1] !== end[1]) {
    return { ok: false, reason: 'The path must reach End.' };
  }
  return { ok: true };
}

export async function gradeMaze(
  instance: PuzzleInstance<MazeContent, MazeSolution>,
  answer: MazeAnswer,
): Promise<GradeResult> {
  const check = checkMazePath(instance.content, answer ?? []);
  return {
    correct: check.ok,
    feedback: check.ok ? 'Solved — you reached the end.' : (check.reason ?? 'That path is not valid.'),
    explanation: instance.explanation,
    revealedSolution: check.ok ? undefined : instance.solution,
  };
}

/** Legality test used while drawing, so illegal moves are refused. */
export function canEnter(content: MazeContent, path: number[], target: number): boolean {
  if (path.includes(target)) return false;
  const end = path[path.length - 1];
  const cols = content.cols;
  const re = Math.floor(end / cols);
  const ce = end % cols;
  const rt = Math.floor(target / cols);
  const ct = target % cols;
  if (Math.abs(re - rt) + Math.abs(ce - ct) !== 1) return false;
  return !wallSet(content).has(edgeKey(end, target));
}

const MAZE_SUB_SKILLS: SubSkill[] = ['spatial-reasoning', 'planning', 'systematic-search'];

export const mazeMechanic: Mechanic<MazeContent, MazeAnswer, MazeSolution> = {
  id: 'maze',
  name: 'Maze',
  description:
    'Trace a path from Start to End through the maze without crossing a wall. Trains spatial reasoning and route-finding.',
  subSkills: MAZE_SUB_SKILLS,
  engine: 'procedural',
  matchMode: 'cognitive',
  answerType: 'path',
  difficulties: ['easy', 'medium', 'hard'],

  async generate({ skill, difficulty, seed }: GenerateArgs) {
    const built = buildMaze(difficulty, seed ?? randomSeed());
    return {
      id: `maze-${built.seed}-${difficulty}`,
      mechanicId: 'maze',
      skillContext: skill,
      subSkillsTrained: MAZE_SUB_SKILLS,
      difficulty,
      title: 'Maze',
      trainsLabel: trainsLabel(MAZE_SUB_SKILLS),
      prompt: 'Drag from Start (top-left) to End (bottom-right) without crossing a wall.',
      content: built.content,
      solution: built.solution,
      explanation:
        'In a perfect maze there is exactly one route between any two points, so every dead end you rule out narrows the search. Working backward from the end sometimes reveals the one corridor that must connect.',
      engine: 'procedural' as const,
    };
  },

  grade: gradeMaze,
};
