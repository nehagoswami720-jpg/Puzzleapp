/**
 * Synonym Match — LLM content-fill (Engine B). Match each word to its synonym.
 * Server-only; grading is the client-safe gradeMatch.
 */
import { z } from 'zod';
import { fillContent } from '../llm/generateInstance';
import { mulberry32, randomSeed, shuffle } from '../rng';
import {
  gradeMatch,
  type MatchAnswer,
  type MatchContent,
  type MatchSolution,
} from './matching';
import { trainsLabel, type SubSkill } from './subskills';
import type { Difficulty, GenerateArgs, Mechanic } from './types';

export const synonymSchema = z.object({
  pairs: z
    .array(z.object({ word: z.string().min(2).max(24), synonym: z.string().min(2).max(24) }))
    .min(4)
    .max(5),
  explanation: z.string().min(10).max(300),
});

const LEVEL: Record<Difficulty, string> = {
  easy: 'Everyday words with clear, common synonyms.',
  medium: 'A mix — a couple of less common words.',
  hard: 'Richer vocabulary; synonyms should be precise, near-miss distractors between rows.',
};

const SYSTEM = `You write synonym-matching puzzles.
Rules:
- Return 4 (easy/medium) or 5 (hard) word→synonym pairs.
- Each word must pair with exactly ONE of the listed synonyms and no other — avoid a synonym that could match two different words in the set.
- All words and synonyms must be real, single words, neutral and worldwide-friendly.
- Vary the words across generations.`;

const SYN_SUB_SKILLS: SubSkill[] = ['vocabulary', 'semantic-relations', 'word-meaning'];

export const synonymMatchMechanic: Mechanic<MatchContent, MatchAnswer, MatchSolution> = {
  id: 'synonym-match',
  name: 'Synonym Match',
  description:
    'Match each word to its synonym. Trains vocabulary depth and precise word meaning.',
  subSkills: SYN_SUB_SKILLS,
  engine: 'llm',
  matchMode: 'content',
  answerType: 'set',
  difficulties: ['easy', 'medium', 'hard'],

  async generate({ skill, difficulty, seed }: GenerateArgs) {
    const count = difficulty === 'hard' ? 5 : 4;
    const payload = await fillContent({
      schema: synonymSchema,
      toolName: 'emit_synonyms',
      toolDescription: 'Return 4–5 word→synonym pairs and a short note.',
      system: SYSTEM,
      effort: 'low',
      userPrompt: `Give ${count} word→synonym pairs for someone practising ${skill.canonicalSkill}.

Difficulty: ${difficulty}. ${LEVEL[difficulty]}

Their words were: "${skill.rawPrompt}" — let that lightly steer the vocabulary where natural.`,
      screenedFields: (v) => v.pairs.flatMap((p) => [p.word, p.synonym]),
    });

    const pairs = payload.pairs.slice(0, count);
    const rng = mulberry32((seed ?? randomSeed()) >>> 0);
    const left = pairs.map((p) => p.word);
    const right = shuffle(pairs.map((p) => p.synonym), rng);
    const solution: MatchSolution = Object.fromEntries(pairs.map((p) => [p.word, p.synonym]));

    return {
      id: `synonym-match-${randomSeed()}-${difficulty}`,
      mechanicId: 'synonym-match',
      skillContext: skill,
      subSkillsTrained: SYN_SUB_SKILLS,
      difficulty,
      title: 'Synonym Match',
      trainsLabel: trainsLabel(SYN_SUB_SKILLS),
      prompt: 'Tap a word, then tap its synonym. Match all the pairs.',
      content: { left, right, leftLabel: 'Word', rightLabel: 'Synonym' },
      solution,
      explanation: payload.explanation,
      engine: 'llm' as const,
    };
  },

  grade: gradeMatch,
};
