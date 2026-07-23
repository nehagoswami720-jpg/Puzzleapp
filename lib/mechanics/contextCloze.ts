/**
 * Context Cloze — LLM content-fill (Engine B), §9.4.
 *
 * Same split as Spot the Fallacy: the model returns the §9.4 schema whole, the
 * mechanic keeps the answer key out of client-visible content.
 */
import { z } from 'zod';
import { fillContent } from '../llm/generateInstance';
import { randomSeed } from '../rng';
import {
  gradeMultipleChoice,
  type MultipleChoiceAnswer,
  type MultipleChoiceContent,
  type MultipleChoiceSolution,
} from './multipleChoice';
import { trainsLabel, type SubSkill } from './subskills';
import type { Difficulty, GenerateArgs, Mechanic } from './types';

/** Exactly the §9.4 schema, plus the blank check the app relies on. */
export const clozeSchema = z
  .object({
    /** contains a single "____" blank */
    sentence: z.string().min(30).max(400),
    /** 4 words, one best fit */
    options: z.array(z.string().min(2).max(40)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    targetWord: z.string().min(2).max(40),
    explanation: z.string().min(40).max(900),
  })
  .refine((v) => (v.sentence.match(/_{2,}/g) ?? []).length === 1, {
    message: 'sentence must contain exactly one blank written as ____',
    path: ['sentence'],
  })
  .refine((v) => v.options[v.correctIndex]?.toLowerCase() === v.targetWord.toLowerCase(), {
    message: 'options[correctIndex] must equal targetWord',
    path: ['correctIndex'],
  })
  .refine((v) => new Set(v.options.map((o) => o.toLowerCase())).size === 4, {
    message: 'the four options must be distinct',
    path: ['options'],
  });

export type ClozePayload = z.infer<typeof clozeSchema>;

const LEVEL: Record<Difficulty, string> = {
  easy: 'Target an everyday word most adults already know. Distractors should be clearly wrong in context.',
  medium:
    'Target a moderately uncommon word. Distractors should be the right part of speech and roughly the right meaning, so context has to do the work.',
  hard: 'Target a precise, uncommon word. All three distractors must be near-synonyms that a good writer would reject only because of connotation, register, or collocation — the sentence must still admit exactly one best answer.',
};

const SYSTEM = `You write vocabulary-in-context items for a puzzle app.

Rules you must follow:
- The sentence is natural, self-contained prose with exactly one blank written as four underscores: ____
- The sentence must supply enough context that exactly ONE of the options is the best fit. If two options would both read correctly, the item is broken — rewrite the sentence to disambiguate.
- All four options are the same part of speech and fit grammatically. The test is meaning, never grammar.
- targetWord must be exactly the option at correctIndex.
- Keep the subject matter neutral and workplace-safe.
- The explanation gives the target word's meaning, points at the words in the sentence that select for it, and says why the closest distractor fails.`;

const CLOZE_SUB_SKILLS: SubSkill[] = ['vocabulary', 'word-meaning'];

export const contextClozeMechanic: Mechanic<
  MultipleChoiceContent,
  MultipleChoiceAnswer,
  MultipleChoiceSolution
> = {
  id: 'context-cloze',
  name: 'Context Cloze',
  description:
    'A sentence with one blank and four candidate words; pick the one that fits best. Trains precise word meaning and reading context for shades of sense.',
  subSkills: CLOZE_SUB_SKILLS,
  engine: 'llm',
  matchMode: 'content',
  answerType: 'exact',
  difficulties: ['easy', 'medium', 'hard'],

  async generate({ skill, difficulty }: GenerateArgs) {
    const payload = await fillContent({
      schema: clozeSchema,
      toolName: 'emit_cloze_puzzle',
      toolDescription:
        'Return one natural sentence containing a single ____ blank, four candidate words, the index of the best fit, that word, and an explanation.',
      system: SYSTEM,
      effort: difficulty === 'hard' ? 'high' : 'medium',
      userPrompt: `Write a context-cloze item for someone practising ${skill.canonicalSkill}.

Difficulty: ${difficulty}. ${LEVEL[difficulty]}

Their own words were: "${skill.rawPrompt}" — let that steer the subject matter of the sentence where it sensibly can, but never at the cost of there being exactly one best answer.`,
      screenedFields: (v) => [v.sentence, v.explanation, ...v.options],
    });

    return {
      id: `context-cloze-${randomSeed()}-${difficulty}`,
      mechanicId: 'context-cloze',
      skillContext: skill,
      subSkillsTrained: CLOZE_SUB_SKILLS,
      difficulty,
      title: 'Context Cloze',
      trainsLabel: trainsLabel(CLOZE_SUB_SKILLS),
      prompt: 'Which word best fills the blank?',
      content: { stem: payload.sentence, options: payload.options },
      solution: payload.correctIndex,
      explanation: payload.explanation,
      engine: 'llm' as const,
    };
  },

  grade: gradeMultipleChoice,
};
