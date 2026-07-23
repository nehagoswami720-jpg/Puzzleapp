/**
 * The planner — §10 steps 1 and 2 in a single model call.
 *
 * The spec allows combining interpret and select, and combining them is the
 * right call here: they need the same context, and one round trip instead of
 * two is the difference between a comfortable wait and a timeout risk once
 * generation follows.
 *
 * The core invariant is enforced *structurally* rather than by instruction: the
 * `mechanicId` field is a Zod enum built from the live catalog, so a plan naming
 * a mechanic that doesn't exist fails validation and is retried. The model
 * cannot invent a game type because the schema has no way to express one.
 */
import { z } from 'zod';
import type { Selection } from '../select';
import { enforceVariety, fallbackSelect } from '../select';
import { SUB_SKILLS } from '../mechanics/subskills';
import type { CatalogEntry, SkillContext } from '../mechanics/types';
import { fillContent } from './generateInstance';

export interface Plan {
  skill: SkillContext;
  selections: Selection[];
  /** true when the deterministic scorer stood in for a failed planner call */
  usedFallback: boolean;
}

const DOMAINS = [
  'reasoning',
  'language',
  'numeracy',
  'memory',
  'spatial',
  'knowledge',
  'other',
] as const;

function plannerSchema(mechanicIds: string[]) {
  return z.object({
    canonicalSkill: z.string().min(2).max(60),
    subSkills: z.array(z.enum(SUB_SKILLS)).min(1).max(6),
    domain: z.enum(DOMAINS),
    needsClarification: z.boolean(),
    /**
     * Empty string when none. Strict tool use is happiest when every property
     * is required, so this is a required field with an empty sentinel rather
     * than an optional one.
     */
    clarifyingQuestion: z.string().max(300),
    /**
     * The prompt asks for 3-4, but the floor is 0, not 3: when the model
     * decides to clarify it legitimately returns few or none, and rejecting
     * that would burn retries and drop us to the fallback on exactly the inputs
     * the planner handles best. `enforceVariety` guarantees ≥3 for the play
     * path; the clarify path returns before generation, so a short list there
     * is harmless.
     */
    selections: z
      .array(
        z.object({
          mechanicId: z.enum(mechanicIds as [string, ...string[]]),
          difficulty: z.enum(['easy', 'medium', 'hard']),
          reason: z.string().min(5).max(160),
        }),
      )
      .max(4),
  });
}

function systemPrompt(catalog: CatalogEntry[]): string {
  const menu = catalog
    .map(
      (m) =>
        `- id: ${m.id}\n  name: ${m.name}\n  trains: ${m.subSkills.join(', ')}\n  match: ${m.matchMode === 'content' ? 'by subject matter' : 'by mental faculty exercised'}\n  interaction: ${m.answerType}\n  what it is: ${m.description}`,
    )
    .join('\n');

  return `You plan practice sets for a puzzle app. A user describes a skill they want to improve; you interpret that request and choose which puzzles to give them.

You may ONLY choose from this fixed catalog. You cannot invent a puzzle type, and you cannot request one that isn't listed:

${menu}

Sub-skill vocabulary — use these exact strings and no others:
${SUB_SKILLS.join(', ')}

How to choose:
- Pick 3 or 4 mechanics that genuinely serve the request.
- Two kinds of match exist. Content-matched puzzles fit when the SUBJECT is the skill (a fallacy puzzle is about critical thinking). Cognitive-matched puzzles fit when the MENTAL FACULTY is the skill (Zip trains planning and spatial reasoning, so it suits "planning" or "logical reasoning" — but it must never be offered for "vocabulary", because filling a grid does nothing for word knowledge).
- Vary the interaction. Do not return a set where every puzzle is answered the same way.
- Include at least one easier item so the set opens with a win.
- Set difficulty per puzzle based on how confident and specific the user sounds.

Clarification:
- Set needsClarification to true ONLY when the request is too vague to choose sub-skills at all — "get smarter", "improve at games", "be better".
- A request naming any recognisable skill needs no clarification. "Improve my vocabulary" is perfectly clear.
- When you do ask, ask ONE short question offering a couple of concrete directions. Otherwise return an empty string.
- Choose 3-4 mechanics regardless, so the set is ready if they confirm.

canonicalSkill is a short title-case name for what they're practising, e.g. "Critical Thinking", "Vocabulary", "Mental Arithmetic".`;
}

/** Interpret the prompt and choose mechanics; fall back to tag overlap on failure. */
export async function plan(rawPrompt: string, catalog: CatalogEntry[]): Promise<Plan> {
  const ids = catalog.map((m) => m.id);

  try {
    const result = await fillContent({
      schema: plannerSchema(ids),
      toolName: 'emit_practice_plan',
      toolDescription:
        'Return the interpreted skill and the 3-4 catalog mechanics to generate for it.',
      system: systemPrompt(catalog),
      // Classification and selection — depth here costs latency without
      // improving the choice much.
      effort: 'low',
      userPrompt: `The user wrote: "${rawPrompt}"\n\nInterpret this and choose their practice set.`,
      screenedFields: (v) => [v.canonicalSkill, v.clarifyingQuestion],
    });

    const skill: SkillContext = {
      rawPrompt,
      canonicalSkill: result.canonicalSkill,
      subSkills: result.subSkills,
      domain: result.domain,
      needsClarification: result.needsClarification,
      clarifyingQuestion: result.clarifyingQuestion.trim() || undefined,
    };

    return {
      skill,
      selections: enforceVariety(result.selections, catalog),
      usedFallback: false,
    };
  } catch (err) {
    // §10: keep a deterministic scorer so a failed planner call degrades to a
    // reasonable set rather than to nothing. Log why — a silent fallback that
    // fires often looks like a working planner making poor choices.
    console.warn(
      '[planner] falling back to tag overlap:',
      err instanceof Error ? err.message : err,
    );
    const skill: SkillContext = {
      rawPrompt,
      canonicalSkill: rawPrompt.slice(0, 60),
      subSkills: [],
      domain: 'other',
      needsClarification: false,
    };
    return { skill, selections: fallbackSelect(skill, catalog), usedFallback: true };
  }
}
