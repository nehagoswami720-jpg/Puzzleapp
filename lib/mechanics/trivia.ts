/**
 * Trivia — LLM content-fill (Engine B).
 *
 * A knowledge question with four options, one correct. Reuses the MultipleChoice
 * format/renderer, so the only new thing here is the prompt and the topic
 * steering. Infinite topics is where a big chunk of the "arcade" variety comes
 * from at near-zero renderer cost.
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

export const triviaSchema = z.object({
  question: z.string().min(12).max(240),
  options: z.array(z.string().min(1).max(70)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  /** what the answer is / one interesting fact about it */
  explanation: z.string().min(20).max(500),
  /** for the card, e.g. "Space", "Music", "World History" */
  topic: z.string().min(2).max(40),
});

const LEVEL: Record<Difficulty, string> = {
  easy: 'A question most people would get — common knowledge, no obscure detail.',
  medium: 'A question a curious generalist would know, but that makes you think.',
  hard: 'A genuinely challenging question — a specific fact, but still fair and checkable, never a trick.',
};

const SYSTEM = `You write single trivia questions for a puzzle app.

Rules:
- One clear factual question with exactly one correct answer among four options.
- The three wrong options must be plausible and the same category as the answer (all years, all countries, all people, etc.) — never obviously silly.
- Keep it neutral and worldwide-friendly: no politics of the last few years, no graphic or distressing content, no trick questions.
- Vary the TOPIC widely across generations — science, space, history, geography, art, music, film, sport, food, language, nature, technology, mythology. Do not default to the same few topics.
- The explanation states the answer and adds one genuinely interesting fact about it.
- Return a short topic label for the card.`;

const TRIVIA_SUB_SKILLS: SubSkill[] = ['general-knowledge', 'recall'];

export const triviaMechanic: Mechanic<
  MultipleChoiceContent,
  MultipleChoiceAnswer,
  MultipleChoiceSolution
> = {
  id: 'trivia',
  name: 'Trivia',
  description:
    'A general-knowledge question with four options, one correct — topics range across science, history, geography, arts, sport and more. Trains recall and breadth of knowledge.',
  subSkills: TRIVIA_SUB_SKILLS,
  engine: 'llm',
  matchMode: 'content',
  answerType: 'exact',
  difficulties: ['easy', 'medium', 'hard'],

  async generate({ skill, difficulty }: GenerateArgs) {
    const payload = await fillContent({
      schema: triviaSchema,
      toolName: 'emit_trivia',
      toolDescription:
        'Return one trivia question, four options, the index of the correct one, an explanation, and a topic label.',
      system: SYSTEM,
      effort: 'low',
      userPrompt: `Write a trivia question for someone practising ${skill.canonicalSkill}.

Difficulty: ${difficulty}. ${LEVEL[difficulty]}

Their own words were: "${skill.rawPrompt}" — let that steer the topic where it sensibly can, but a good, fair question matters more than a perfect topic match.`,
      screenedFields: (v) => [v.question, v.explanation, v.topic, ...v.options],
    });

    return {
      id: `trivia-${randomSeed()}-${difficulty}`,
      mechanicId: 'trivia',
      skillContext: skill,
      subSkillsTrained: TRIVIA_SUB_SKILLS,
      difficulty,
      title: `Trivia · ${payload.topic}`,
      trainsLabel: trainsLabel(TRIVIA_SUB_SKILLS),
      prompt: payload.question,
      content: { stem: payload.question, options: payload.options },
      solution: payload.correctIndex,
      explanation: payload.explanation,
      engine: 'llm' as const,
    };
  },

  grade: gradeMultipleChoice,
};
