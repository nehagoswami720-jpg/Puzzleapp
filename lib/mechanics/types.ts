import type { SubSkill } from './subskills';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Engine = 'procedural' | 'llm';
export type MatchMode = 'content' | 'cognitive';
export type AnswerType = 'exact' | 'set' | 'range' | 'path' | 'grid' | 'open';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** "Make it harder" bumps one level; hard is the ceiling. */
export function harder(d: Difficulty): Difficulty {
  return d === 'easy' ? 'medium' : 'hard';
}

export interface SkillContext {
  rawPrompt: string;
  /** e.g. "Critical Thinking" */
  canonicalSkill: string;
  /** from the controlled vocab in subskills.ts */
  subSkills: SubSkill[];
  domain:
    | 'reasoning'
    | 'language'
    | 'numeracy'
    | 'memory'
    | 'spatial'
    | 'knowledge'
    | 'other';
  needsClarification: boolean;
  /** asked in chat when the prompt is too vague */
  clarifyingQuestion?: string;
}

export interface PuzzleInstance<Content = unknown, Solution = unknown> {
  id: string;
  mechanicId: string;
  skillContext: SkillContext;
  subSkillsTrained: SubSkill[];
  difficulty: Difficulty;
  /** card title, e.g. "Spot the Fallacy" */
  title: string;
  /** e.g. "Trains: spotting hidden assumptions" */
  trainsLabel: string;
  /** instructions shown to the user */
  prompt: string;
  /** mechanic-specific, schema-validated */
  content: Content;
  /** grade against this */
  solution: Solution;
  /** shown after grading */
  explanation: string;
  engine: Engine;
}

export interface GradeResult {
  correct: boolean;
  /** 0..1 for open/rubric grading */
  score?: number;
  /** short, encouraging, specific */
  feedback: string;
  /** the teaching moment */
  explanation: string;
  revealedSolution?: unknown;
}

export interface GenerateArgs {
  skill: SkillContext;
  difficulty: Difficulty;
  seed?: number;
}

/** The common contract every mechanic module implements. */
export interface Mechanic<Content = unknown, Answer = unknown, Solution = unknown> {
  id: string;
  name: string;
  description: string;
  /** tags used for selection */
  subSkills: SubSkill[];
  engine: Engine;
  matchMode: MatchMode;
  answerType: AnswerType;
  difficulties: Difficulty[];
  generate(args: GenerateArgs): Promise<PuzzleInstance<Content, Solution>>;
  grade(
    instance: PuzzleInstance<Content, Solution>,
    answer: Answer,
  ): Promise<GradeResult>;
  // React renderer is registered separately by mechanic id (see components/renderers)
}

/** What the planner LLM sees — never the generator internals (§10 invariant). */
export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  subSkills: SubSkill[];
  engine: Engine;
  matchMode: MatchMode;
  /** how the puzzle is answered — selection uses this to enforce variety */
  answerType: AnswerType;
  difficulties: Difficulty[];
}

/** Props every mechanic renderer receives. */
export interface RendererProps<Content = unknown, Answer = unknown> {
  instance: PuzzleInstance<Content, unknown>;
  /** null until the player has produced a submittable answer */
  answer: Answer | null;
  onAnswerChange(answer: Answer | null): void;
  /** true once graded — renderers should go read-only */
  locked: boolean;
}
