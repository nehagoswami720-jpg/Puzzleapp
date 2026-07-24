/**
 * Connections — LLM content-fill (Engine B). The marquee "arcade" puzzle.
 *
 * Sixteen items belong to four hidden groups of four; the player selects a group
 * of four at a time. This file is CLIENT-SAFE — it holds the content/answer/
 * solution types and the deterministic grader only. The generator (which imports
 * lib/llm) lives in `connectionsMechanic.ts` so the client never pulls in the SDK.
 */
import type { GradeResult, PuzzleInstance } from './types';

export interface ConnectionsGroup {
  /** the theme, e.g. "Types of pasta" — shown only after solving */
  label: string;
  /** the four members */
  members: string[];
}

export interface ConnectionsContent {
  /** all 16 items, shuffled — no grouping revealed */
  items: string[];
}

/** The four correct groups (the answer key — kept off the client-visible content). */
export type ConnectionsSolution = ConnectionsGroup[];

/**
 * The player's answer: their four groups, each a set of four items. Order of
 * groups and order within a group don't matter.
 */
export type ConnectionsAnswer = string[][];

const key = (members: string[]) => [...members].map((m) => m.toLowerCase().trim()).sort().join('|');

export async function gradeConnections(
  instance: PuzzleInstance<ConnectionsContent, ConnectionsSolution>,
  answer: ConnectionsAnswer,
): Promise<GradeResult> {
  const solutionKeys = new Set(instance.solution.map((g) => key(g.members)));
  const answerKeys = (answer ?? []).map(key);
  const correctGroups = answerKeys.filter((k) => solutionKeys.has(k)).length;
  const allRight = correctGroups === 4 && answerKeys.length === 4;

  const reveal = instance.solution.map((g) => `${g.label}: ${g.members.join(', ')}`).join('\n');

  return {
    correct: allRight,
    score: correctGroups / 4,
    feedback: allRight
      ? 'Solved — all four groups correct.'
      : `${correctGroups} of 4 groups correct.`,
    explanation: allRight ? instance.explanation : `The groups were —\n${reveal}`,
    revealedSolution: instance.solution,
  };
}
