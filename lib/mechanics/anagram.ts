/**
 * Anagram — LLM content-fill (Engine B). Unscramble the letters into a word.
 * Server-only (imports lib/llm); grading is the client-safe gradeAnagram.
 */
import { z } from 'zod';
import { fillContent } from '../llm/generateInstance';
import { mulberry32, randomSeed, shuffle } from '../rng';
import { trainsLabel, type SubSkill } from './subskills';
import { gradeAnagram, type TextInputAnswer, type TextInputContent } from './textInput';
import type { Difficulty, GenerateArgs, Mechanic } from './types';

export const anagramSchema = z.object({
  /** the target word (letters only), 4–9 letters */
  word: z.string().min(4).max(9).regex(/^[A-Za-z]+$/),
  /** a one-line clue that does NOT contain the word */
  hint: z.string().min(8).max(140),
});

const LEVEL: Record<Difficulty, string> = {
  easy: 'A common 4–5 letter word.',
  medium: 'A familiar 6–7 letter word.',
  hard: 'A less common 7–9 letter word.',
};

const SYSTEM = `You write anagram puzzles.
Rules:
- Return one real, common-enough English word (letters only) and a one-line clue for it.
- The clue must NOT contain the word or an obvious form of it.
- Avoid words with many equally-common anagrams; pick a word whose letters most naturally spell just that word.
- Keep it neutral and worldwide-friendly.`;

function scramble(word: string, seed: number): string {
  const rng = mulberry32(seed >>> 0);
  let out = word;
  // Reshuffle until it actually looks scrambled (not the original).
  for (let i = 0; i < 6 && out.toLowerCase() === word.toLowerCase(); i++) {
    out = shuffle(word.split(''), rng).join('');
  }
  return out.toUpperCase().split('').join(' ');
}

const ANAGRAM_SUB_SKILLS: SubSkill[] = ['vocabulary', 'verbal-fluency', 'working-memory'];

export const anagramMechanic: Mechanic<TextInputContent, TextInputAnswer, string> = {
  id: 'anagram',
  name: 'Anagram',
  description:
    'Rearrange the scrambled letters into a word, helped by a short clue. Trains vocabulary and mental letter-shuffling.',
  subSkills: ANAGRAM_SUB_SKILLS,
  engine: 'llm',
  matchMode: 'content',
  answerType: 'exact',
  difficulties: ['easy', 'medium', 'hard'],

  async generate({ skill, difficulty, seed }: GenerateArgs) {
    const payload = await fillContent({
      schema: anagramSchema,
      toolName: 'emit_anagram',
      toolDescription: 'Return a target word (letters only) and a one-line clue that avoids the word.',
      system: SYSTEM,
      effort: 'low',
      userPrompt: `Give an anagram word for someone practising ${skill.canonicalSkill}.

Difficulty: ${difficulty}. ${LEVEL[difficulty]}

Their words were: "${skill.rawPrompt}" — let that lightly steer the word choice where natural.`,
      screenedFields: (v) => [v.word, v.hint],
    });

    const s = (seed ?? randomSeed()) >>> 0;
    return {
      id: `anagram-${s}-${difficulty}`,
      mechanicId: 'anagram',
      skillContext: skill,
      subSkillsTrained: ANAGRAM_SUB_SKILLS,
      difficulty,
      title: 'Anagram',
      trainsLabel: trainsLabel(ANAGRAM_SUB_SKILLS),
      prompt: `Unscramble the letters into a word. Clue: ${payload.hint}`,
      content: {
        display: scramble(payload.word, s),
        placeholder: 'your word',
      },
      solution: payload.word,
      explanation: `The word was "${payload.word}". ${payload.hint}`,
      engine: 'llm' as const,
    };
  },

  grade: gradeAnagram,
};
