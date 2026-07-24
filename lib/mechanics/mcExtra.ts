/**
 * A family of multiple-choice puzzle types built on one factory. They all reuse
 * the MultipleChoice format/renderer, so each new type is just a prompt + a
 * catalog entry — this is where a lot of the "arcade" variety comes from at
 * near-zero renderer cost.
 *
 * Server-only (imports lib/llm). Grading is the shared client-safe
 * gradeMultipleChoice.
 */
import { z } from 'zod';
import { fillContent } from '../llm/generateInstance';
import { randomSeed } from '../rng';
import {
  gradeMultipleChoice,
  type MultipleChoiceContent,
  type MultipleChoiceSolution,
} from './multipleChoice';
import { trainsLabel, type SubSkill } from './subskills';
import type { Difficulty, GenerateArgs, Mechanic, MatchMode } from './types';

const mcSchema = z.object({
  /** the context the options answer — sentence, argument, sequence, or blank */
  stem: z.string().min(1).max(600),
  options: z.array(z.string().min(1).max(90)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(15).max(700),
});

interface McConfig {
  id: string;
  name: string;
  description: string;
  subSkills: SubSkill[];
  matchMode?: MatchMode;
  toolName: string;
  toolDescription: string;
  system: string;
  level: Record<Difficulty, string>;
  /** instruction shown to the player */
  promptInstruction: string;
  title: string;
  /** blank the stem box (when the options are self-contained, e.g. real-word) */
  hideStem?: boolean;
  effort?: (d: Difficulty) => 'low' | 'medium' | 'high';
}

function makeMc(
  cfg: McConfig,
): Mechanic<MultipleChoiceContent, number, MultipleChoiceSolution> {
  return {
    id: cfg.id,
    name: cfg.name,
    description: cfg.description,
    subSkills: cfg.subSkills,
    engine: 'llm',
    matchMode: cfg.matchMode ?? 'content',
    answerType: 'exact',
    difficulties: ['easy', 'medium', 'hard'],

    async generate({ skill, difficulty }: GenerateArgs) {
      const payload = await fillContent({
        schema: mcSchema,
        toolName: cfg.toolName,
        toolDescription: cfg.toolDescription,
        system: cfg.system,
        effort: cfg.effort?.(difficulty) ?? (difficulty === 'hard' ? 'medium' : 'low'),
        userPrompt: `Write a "${cfg.name}" puzzle for someone practising ${skill.canonicalSkill}.

Difficulty: ${difficulty}. ${cfg.level[difficulty]}

Their own words were: "${skill.rawPrompt}" — let that steer the subject matter where it sensibly can, but a clean single-answer puzzle matters more than a perfect topic match.`,
        screenedFields: (v) => [v.stem, v.explanation, ...v.options],
      });

      return {
        id: `${cfg.id}-${randomSeed()}-${difficulty}`,
        mechanicId: cfg.id,
        skillContext: skill,
        subSkillsTrained: cfg.subSkills,
        difficulty,
        title: cfg.title,
        trainsLabel: trainsLabel(cfg.subSkills),
        prompt: cfg.promptInstruction,
        content: { stem: cfg.hideStem ? '' : payload.stem, options: payload.options },
        solution: payload.correctIndex,
        explanation: payload.explanation,
        engine: 'llm' as const,
      };
    },

    grade: gradeMultipleChoice,
  };
}

// ------------------------------------------------------------- the mechanics --

export const verbalAnalogyMechanic = makeMc({
  id: 'verbal-analogy',
  name: 'Verbal Analogy',
  description:
    'Complete the analogy — A is to B as C is to ? — by choosing the word with the same relationship. Trains reasoning by analogy.',
  subSkills: ['analogical-reasoning', 'semantic-relations'],
  toolName: 'emit_analogy',
  toolDescription: 'Return an analogy stem, four candidate completions, the correct index, and an explanation.',
  title: 'Verbal Analogy',
  promptInstruction: 'Which word best completes the analogy?',
  system: `You write verbal-analogy puzzles.
Rules:
- The stem is of the form "A is to B as C is to ?" (write it out in words, e.g. "Kitten is to cat as puppy is to ?").
- Exactly one option shares the SAME relationship as A→B. The three distractors must be related to C but by a DIFFERENT relationship, so there is one clean answer.
- Keep words common and neutral. Vary the relationship type (part/whole, cause/effect, degree, category, function, opposite).
- The explanation names the relationship.`,
  level: {
    easy: 'A simple, familiar relationship (young/adult, tool/use).',
    medium: 'A relationship that needs a moment, with tempting distractors.',
    hard: 'A subtle or abstract relationship; distractors should each be plausibly related.',
  },
});

export const hiddenAssumptionMechanic = makeMc({
  id: 'hidden-assumption',
  name: 'Hidden Assumption',
  description:
    'An everyday argument leans on one unstated assumption; identify it. Trains spotting what an argument takes for granted.',
  subSkills: ['assumption-identification', 'argument-evaluation'],
  toolName: 'emit_assumption',
  toolDescription: 'Return a short argument, four candidate assumptions, the correct index, and an explanation.',
  title: 'Hidden Assumption',
  promptInstruction: 'Which unstated assumption does this argument depend on?',
  system: `You write "hidden assumption" puzzles.
Rules:
- The stem is a 1-2 sentence everyday argument that reaches a conclusion.
- Exactly one option is an assumption the argument NEEDS in order to work (remove it and the argument collapses). The other three are things that sound related but the argument does not actually rely on.
- Keep it neutral and workplace-safe. The explanation says why the answer is load-bearing and why the closest distractor is not.`,
  level: {
    easy: 'The gap between premise and conclusion should be fairly clear.',
    medium: 'The assumption should be easy to miss on a first read.',
    hard: 'Two distractors should be tempting assumptions the argument does not strictly need.',
  },
  effort: (d) => (d === 'hard' ? 'high' : 'medium'),
});

export const whatFollowsMechanic = makeMc({
  id: 'what-follows',
  name: 'What Follows',
  description:
    'Given a couple of premises, choose what must logically be true. Trains valid deduction and avoiding tempting non-sequiturs.',
  subSkills: ['deductive-reasoning', 'logical-consistency'],
  toolName: 'emit_deduction',
  toolDescription: 'Return premises, four candidate conclusions, the correct index, and an explanation.',
  title: 'What Follows',
  promptInstruction: 'If the statements are true, which one MUST also be true?',
  system: `You write short deduction puzzles.
Rules:
- The stem gives one or two clear premises (e.g. "All Bloops are Razzies. All Razzies are Lazzies.").
- Exactly one option follows with certainty from the premises. The other three are plausible-sounding but do NOT strictly follow (converse errors, over-general claims, unrelated additions).
- Use neutral or lightly abstract content. The explanation shows why the answer necessarily follows and flags the tempting invalid one.`,
  level: {
    easy: 'A single, direct syllogism.',
    medium: 'Two premises to chain, with one converse-error distractor.',
    hard: 'Multiple steps or a quantifier subtlety; every distractor should tempt.',
  },
  effort: (d) => (d === 'easy' ? 'low' : 'medium'),
});

export const realWordMechanic = makeMc({
  id: 'real-word',
  name: 'Real Word?',
  description:
    'Three of the four are invented; pick the one that is a genuine (if uncommon) word. Trains vocabulary breadth.',
  subSkills: ['vocabulary', 'word-meaning'],
  toolName: 'emit_real_word',
  toolDescription: 'Return four word-like strings (one a real word, three invented), the correct index, and an explanation.',
  title: 'Real Word?',
  promptInstruction: 'Three of these are made up. Which is a real word?',
  hideStem: true,
  system: `You write "spot the real word" puzzles.
Rules:
- Put a short framing in the stem (it will not be shown). The four OPTIONS are the puzzle: exactly one is a genuine English word (uncommon is good), and three are invented but plausible-looking non-words.
- The three fakes must look and sound like they could be words (right phonotactics), never obviously nonsense, and must NOT be real words.
- The explanation gives the real word's meaning.`,
  level: {
    easy: 'The real word is one many adults know; the fakes are clearly odd.',
    medium: 'The real word is uncommon; the fakes are convincing.',
    hard: 'The real word is rare/archaic; all four look equally plausible.',
  },
  effort: () => 'medium',
});

export const estimationMechanic = makeMc({
  id: 'estimation',
  name: 'Ballpark',
  description:
    'Pick the closest order-of-magnitude estimate for a real-world quantity. Trains estimation and numeric sense.',
  subSkills: ['estimation', 'general-knowledge'],
  toolName: 'emit_estimation',
  toolDescription: 'Return an estimation question, four magnitude options, the closest correct index, and an explanation.',
  title: 'Ballpark',
  promptInstruction: 'Roughly — which is the closest estimate?',
  matchMode: 'cognitive',
  system: `You write estimation ("ballpark") puzzles.
Rules:
- The stem asks for a rough real-world quantity (e.g. "About how many heartbeats does an average person have in a day?").
- The four options are numeric estimates spaced roughly an order of magnitude apart, so exactly one is clearly the closest to the true value.
- Use well-established, checkable facts. The explanation gives the real figure.
- Keep numbers readable (use words like "million", "billion").`,
  level: {
    easy: 'An everyday quantity most people can ballpark.',
    medium: 'A quantity that needs a moment of reasoning.',
    hard: 'A less intuitive quantity where the naive guess is wrong.',
  },
});

export const whatComesNextMechanic = makeMc({
  id: 'what-comes-next',
  name: 'What Comes Next',
  description:
    'A short abstract sequence of letters or symbols follows a rule; pick what comes next. Trains abstract pattern recognition.',
  subSkills: ['pattern-recognition', 'abstract-reasoning', 'visual-pattern'],
  toolName: 'emit_next',
  toolDescription: 'Return a sequence stem, four candidate next terms, the correct index, and an explanation.',
  title: 'What Comes Next',
  matchMode: 'cognitive',
  promptInstruction: 'What comes next in the sequence?',
  system: `You write "what comes next" abstract-pattern puzzles.
Rules:
- The stem is a short sequence using LETTERS or simple typed symbols (e.g. "A, C, F, J, ?" or "△ ○ △ ○ △ ?" or "AZ, BY, CX, ?"). Do not use numbers-only sequences (those are a separate puzzle).
- The sequence follows ONE clear rule. Exactly one option continues it; the three distractors break the rule in a tempting way.
- Keep it self-contained and solvable from the stem alone. The explanation states the rule.`,
  level: {
    easy: 'A simple step or alternation.',
    medium: 'Two interacting rules (e.g. position + letter shift).',
    hard: 'A rule that needs real insight; distractors each fit a wrong theory.',
  },
  effort: (d) => (d === 'hard' ? 'high' : 'medium'),
});

export const MC_EXTRA_MECHANICS = [
  verbalAnalogyMechanic,
  hiddenAssumptionMechanic,
  whatFollowsMechanic,
  realWordMechanic,
  estimationMechanic,
  whatComesNextMechanic,
];
