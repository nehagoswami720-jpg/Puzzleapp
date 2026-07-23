/**
 * Spot the Fallacy — LLM content-fill (Engine B), §9.3.
 *
 * The model returns the §9.3 schema in full, including `correctIndex` and
 * `explanation`; the mechanic then splits those onto `solution` / `explanation`
 * so the client-visible content carries no answer key.
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

/** Exactly the §9.3 schema. */
export const fallacySchema = z.object({
  /** 1–3 sentence everyday argument containing one fallacy */
  argument: z.string().min(30).max(600),
  /** 4 fallacy names, one correct */
  options: z.array(z.string().min(3).max(60)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  /** why it's that fallacy */
  explanation: z.string().min(40).max(900),
});

export type FallacyPayload = z.infer<typeof fallacySchema>;

const SUBTLETY: Record<Difficulty, string> = {
  easy: 'The fallacy should be clear once pointed at — a textbook shape in everyday clothing.',
  medium:
    'The fallacy should take a moment to see. At least two distractors must be tempting to someone who is skimming.',
  hard: 'The fallacy should be genuinely subtle — the argument should sound reasonable on first read, and every distractor should name a fallacy that a careful person might plausibly argue for.',
};

const SYSTEM = `You write single-item logic exercises for a puzzle app.

Rules you must follow:
- The argument is 1-3 sentences of ordinary, everyday reasoning — a conversation, a review, a workplace exchange. Not academic examples, not "Socrates is a man".
- It commits exactly ONE identifiable logical fallacy. Do not stack several.
- The four options are all real, standard fallacy names. Exactly one is correct.
- The distractors must be mutually exclusive with the answer — never include a fallacy that is also arguably present in the argument.
- Keep the subject matter neutral and workplace-safe. No politics, religion, real named people, or anything distressing.
- The explanation names the fallacy, points at the specific move in the argument that commits it, and says in one sentence why the closest distractor is wrong.
- Vary the fallacy across generations; do not default to ad hominem or slippery slope.`;

const FALLACY_SUB_SKILLS: SubSkill[] = ['fallacy-detection', 'argument-evaluation'];

export const spotTheFallacyMechanic: Mechanic<
  MultipleChoiceContent,
  MultipleChoiceAnswer,
  MultipleChoiceSolution
> = {
  id: 'spot-the-fallacy',
  name: 'Spot the Fallacy',
  description:
    'A short everyday argument contains exactly one logical fallacy; identify which one from four named options. Trains noticing where reasoning goes wrong.',
  subSkills: FALLACY_SUB_SKILLS,
  engine: 'llm',
  matchMode: 'content',
  answerType: 'exact',
  difficulties: ['easy', 'medium', 'hard'],

  async generate({ skill, difficulty }: GenerateArgs) {
    const payload = await fillContent({
      schema: fallacySchema,
      toolName: 'emit_fallacy_puzzle',
      toolDescription:
        'Return one everyday argument that commits exactly one logical fallacy, four candidate fallacy names, the index of the correct one, and an explanation.',
      system: SYSTEM,
      effort: difficulty === 'hard' ? 'high' : 'medium',
      userPrompt: `Write a "spot the fallacy" item for someone practising ${skill.canonicalSkill}.

Difficulty: ${difficulty}. ${SUBTLETY[difficulty]}

Their own words were: "${skill.rawPrompt}" — let that steer the subject matter of the argument where it sensibly can, but never at the cost of the logic being clean.`,
      screenedFields: (v) => [v.argument, v.explanation, ...v.options],
    });

    return {
      id: `spot-the-fallacy-${randomSeed()}-${difficulty}`,
      mechanicId: 'spot-the-fallacy',
      skillContext: skill,
      subSkillsTrained: FALLACY_SUB_SKILLS,
      difficulty,
      title: 'Spot the Fallacy',
      trainsLabel: trainsLabel(FALLACY_SUB_SKILLS),
      prompt: 'This short argument commits exactly one logical fallacy. Which one?',
      content: { stem: payload.argument, options: payload.options },
      solution: payload.correctIndex,
      explanation: payload.explanation,
      engine: 'llm' as const,
    };
  },

  grade: gradeMultipleChoice,
};
