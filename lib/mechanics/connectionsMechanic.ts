/**
 * Connections generator (Engine B). Server-only — imports lib/llm. The
 * client-safe types + grader live in `connections.ts`.
 *
 * The verify step matters here: the four groups must be a clean partition with
 * no item that could plausibly sit in two groups, or the puzzle has more than
 * one solution. Zod enforces the shape; a post-check enforces 16 distinct items.
 */
import { z } from 'zod';
import { fillContent } from '../llm/generateInstance';
import { mulberry32, randomSeed, shuffle } from '../rng';
import {
  gradeConnections,
  type ConnectionsAnswer,
  type ConnectionsContent,
  type ConnectionsSolution,
} from './connections';
import { trainsLabel, type SubSkill } from './subskills';
import type { Difficulty, GenerateArgs, Mechanic } from './types';

const groupSchema = z.object({
  label: z.string().min(2).max(60),
  members: z.array(z.string().min(1).max(28)).length(4),
});

export const connectionsSchema = z
  .object({
    groups: z.array(groupSchema).length(4),
    /** a note shown after a full solve */
    explanation: z.string().min(10).max(400),
  })
  .refine(
    (v) => {
      const all = v.groups.flatMap((g) => g.members.map((m) => m.toLowerCase().trim()));
      return new Set(all).size === 16;
    },
    { message: 'the 16 items must all be distinct', path: ['groups'] },
  );

const LEVEL: Record<Difficulty, string> = {
  easy: 'Groups should be clear categories (e.g. colours, fruits, planets). Little overlap between groups.',
  medium:
    'At least one group should be a wordplay or less-obvious connection, and a couple of items should look like they could belong to the wrong group at first glance.',
  hard: 'Use overlapping traps: several items should plausibly fit more than one group until you find the arrangement where all four groups work. You MAY include one wordplay group ("___ + a word", homophones, genuinely hidden words) — but ONLY if every one of its four members cleanly and correctly fits; if not, use another clean category instead. A loose group is worse than no wordplay.',
};

const SYSTEM = `You write "Connections" grouping puzzles for a puzzle app (16 items, four hidden groups of four).

Rules:
- Produce exactly four groups of four items. All 16 items must be distinct single words or very short phrases.
- CRITICAL: every item must be a REAL, correctly-spelled, recognisable word, name, or phrase. NEVER invent, misspell, or mangle a word to force a connection. If a wordplay group would need a made-up word, drop that idea and use a different, cleaner connection.
- A "hidden word" group only works if you use genuine everyday words that really contain the hidden element (e.g. hiding body parts: cHIPmunk, sHINe, EARl, sHOULDERed). If you can't find four real ones, don't use that theme.
- CRITICAL: the four groups must form the ONLY valid way to split the 16 items into four themed groups of four. Every item belongs to exactly one group. Avoid an item that fits two groups equally — unless the intended twist is that it looks like it fits another group but only one arrangement makes all four groups whole.
- Keep items short and the subject matter neutral and worldwide-friendly.
- Give each group a short label naming the connection.
- Vary the themes widely across generations.
- The explanation is one line of colour about the trickiest group.`;

const CONNECTIONS_SUB_SKILLS: SubSkill[] = ['categorization', 'pattern-recognition', 'semantic-relations'];

export const connectionsMechanic: Mechanic<
  ConnectionsContent,
  ConnectionsAnswer,
  ConnectionsSolution
> = {
  id: 'connections',
  name: 'Connections',
  description:
    'Sixteen items hide four groups of four; find every group. Trains categorisation, spotting connections, and resisting the obvious-but-wrong grouping.',
  subSkills: CONNECTIONS_SUB_SKILLS,
  engine: 'llm',
  matchMode: 'content',
  answerType: 'set',
  difficulties: ['easy', 'medium', 'hard'],

  async generate({ skill, difficulty, seed }: GenerateArgs) {
    const payload = await fillContent({
      schema: connectionsSchema,
      toolName: 'emit_connections',
      toolDescription:
        'Return four themed groups of four items each (16 distinct items total) and a short explanation.',
      system: SYSTEM,
      effort: difficulty === 'easy' ? 'low' : 'medium',
      userPrompt: `Write a Connections puzzle for someone practising ${skill.canonicalSkill}.

Difficulty: ${difficulty}. ${LEVEL[difficulty]}

Their own words were: "${skill.rawPrompt}" — let that steer the themes where it sensibly can, but a clean single-solution grid matters more than a perfect theme match.`,
      screenedFields: (v) => [v.explanation, ...v.groups.flatMap((g) => [g.label, ...g.members])],
    });

    // Shuffle the 16 items deterministically so the grid never reveals the groups.
    const rng = mulberry32((seed ?? randomSeed()) >>> 0);
    const items = shuffle(payload.groups.flatMap((g) => g.members), rng);

    return {
      id: `connections-${randomSeed()}-${difficulty}`,
      mechanicId: 'connections',
      skillContext: skill,
      subSkillsTrained: CONNECTIONS_SUB_SKILLS,
      difficulty,
      title: 'Connections',
      trainsLabel: trainsLabel(CONNECTIONS_SUB_SKILLS),
      prompt: 'Find the four groups of four. Select four items, then submit the group.',
      content: { items },
      solution: payload.groups,
      explanation: payload.explanation,
      engine: 'llm' as const,
    };
  },

  grade: gradeConnections,
};
