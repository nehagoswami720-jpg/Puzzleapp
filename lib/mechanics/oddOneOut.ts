/**
 * Odd One Out — LLM content-fill (Engine B).
 *
 * Four items share a hidden property; one doesn't. Pick the one that doesn't
 * belong. Reuses the MultipleChoice format; the "options" are the items.
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

export const oddOneOutSchema = z.object({
  /** the four candidate items */
  items: z.array(z.string().min(1).max(40)).length(4),
  /** index of the item that does not belong */
  correctIndex: z.number().int().min(0).max(3),
  /** the property the other three share */
  sharedProperty: z.string().min(3).max(120),
  /** why the odd one is odd */
  explanation: z.string().min(20).max(500),
  /** short card label for the theme, e.g. "Animals", "Elements" */
  theme: z.string().min(2).max(40),
});

const LEVEL: Record<Difficulty, string> = {
  easy: 'The shared property should be obvious once seen (all fruit, all even, all planets).',
  medium: 'The shared property should take a moment — a category that is not surface-level.',
  hard: 'The shared property should be subtle, and the odd one should be a near-miss that superficially looks like it belongs.',
};

const SYSTEM = `You write "odd one out" puzzles for a puzzle app.

Rules:
- Four short items. Exactly three share ONE clear property; the fourth does not.
- Crucially, there must be only ONE defensible answer — do not make a set where two different items could each be argued to be the odd one out. Choose items so the intended property is the ONLY thing that cleanly splits 3 from 1.
- Keep items short (a word or two) and the subject matter neutral and worldwide-friendly.
- Vary the theme widely — animals, foods, countries, numbers, elements, sports, colours, instruments, planets, etc.
- The explanation names the shared property and says why the odd one fails it.`;

const ODD_SUB_SKILLS: SubSkill[] = ['categorization', 'semantic-relations'];

export const oddOneOutMechanic: Mechanic<
  MultipleChoiceContent,
  MultipleChoiceAnswer,
  MultipleChoiceSolution
> = {
  id: 'odd-one-out',
  name: 'Odd One Out',
  description:
    'Three of four items share a hidden property; spot the one that does not belong. Trains categorisation and seeing what things have in common.',
  subSkills: ODD_SUB_SKILLS,
  engine: 'llm',
  matchMode: 'content',
  answerType: 'exact',
  difficulties: ['easy', 'medium', 'hard'],

  async generate({ skill, difficulty }: GenerateArgs) {
    const payload = await fillContent({
      schema: oddOneOutSchema,
      toolName: 'emit_odd_one_out',
      toolDescription:
        'Return four items, the index of the one that does not belong, the shared property, an explanation, and a theme label.',
      system: SYSTEM,
      effort: difficulty === 'hard' ? 'medium' : 'low',
      userPrompt: `Write an "odd one out" puzzle for someone practising ${skill.canonicalSkill}.

Difficulty: ${difficulty}. ${LEVEL[difficulty]}

Their own words were: "${skill.rawPrompt}" — let that steer the theme where it sensibly can, but a clean single-answer puzzle matters more than a perfect theme match.`,
      screenedFields: (v) => [v.explanation, v.sharedProperty, v.theme, ...v.items],
    });

    return {
      id: `odd-one-out-${randomSeed()}-${difficulty}`,
      mechanicId: 'odd-one-out',
      skillContext: skill,
      subSkillsTrained: ODD_SUB_SKILLS,
      difficulty,
      title: 'Odd One Out',
      trainsLabel: trainsLabel(ODD_SUB_SKILLS),
      prompt: 'Three of these belong together. Which one does not?',
      content: { stem: '', options: payload.items },
      solution: payload.correctIndex,
      explanation: payload.explanation,
      engine: 'llm' as const,
    };
  },

  grade: gradeMultipleChoice,
};
