/**
 * Prompt → puzzles (§10 steps 3 and 4).
 *
 * Generation runs in parallel. That's not just speed: LLM mechanics take ~6s
 * each, so three in series would push a serverless function toward its limit,
 * while three at once cost about as long as the slowest one.
 *
 * `Promise.allSettled` also gives §10's fall-through for free — a mechanic that
 * can't produce a valid instance is dropped rather than shown, and a
 * next-ranked mechanic is generated in its place so the user still gets a full
 * set instead of a gap.
 */
import { plan } from './llm/planner';
import { catalog, getMechanic } from './mechanics';
import { registerAllMechanics } from './mechanics/server';
import type { PuzzleInstance, SkillContext } from './mechanics/types';
import { rankMechanics, type Selection } from './select';

export interface GenerateOutcome {
  skillContext: SkillContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instances: PuzzleInstance<any, any>[];
  diagnostics: {
    usedFallbackSelection: boolean;
    planned: Selection[];
    /** mechanics that failed generation and why — a quality signal worth keeping */
    dropped: { mechanicId: string; reason: string }[];
    substituted: string[];
    ms: number;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateOne(sel: Selection, skill: SkillContext): Promise<PuzzleInstance<any, any>> {
  const mechanic = getMechanic(sel.mechanicId);
  if (!mechanic) throw new Error(`"${sel.mechanicId}" is not in the catalog`);
  const difficulty = mechanic.difficulties.includes(sel.difficulty)
    ? sel.difficulty
    : mechanic.difficulties[0];
  return mechanic.generate({ skill, difficulty });
}

export async function promptToPuzzles(rawPrompt: string): Promise<GenerateOutcome> {
  registerAllMechanics();
  const startedAt = Date.now();
  const entries = catalog();

  const { skill, selections, usedFallback } = await plan(rawPrompt, entries);

  // A vague prompt gets one question, not a half-relevant set (§12.4).
  if (skill.needsClarification && skill.clarifyingQuestion) {
    return {
      skillContext: skill,
      instances: [],
      diagnostics: {
        usedFallbackSelection: usedFallback,
        planned: selections,
        dropped: [],
        substituted: [],
        ms: Date.now() - startedAt,
      },
    };
  }

  const settled = await Promise.allSettled(selections.map((s) => generateOne(s, skill)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instances: PuzzleInstance<any, any>[] = [];
  const dropped: { mechanicId: string; reason: string }[] = [];
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === 'fulfilled') instances.push(outcome.value);
    else {
      dropped.push({
        mechanicId: selections[i].mechanicId,
        reason: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      });
    }
  }

  // Backfill from the next-ranked mechanics we haven't tried. One round only —
  // a second failure means something is broadly wrong, and a user waiting on a
  // retry loop is worse than a set of three.
  const substituted: string[] = [];
  if (dropped.length > 0) {
    const tried = new Set(selections.map((s) => s.mechanicId));
    const backups = rankMechanics(skill, entries)
      .map((r) => r.entry)
      .filter((e) => !tried.has(e.id))
      .slice(0, dropped.length);

    const refills = await Promise.allSettled(
      backups.map((e) =>
        generateOne({ mechanicId: e.id, difficulty: 'medium', reason: 'substitute' }, skill),
      ),
    );
    for (const [i, outcome] of refills.entries()) {
      if (outcome.status === 'fulfilled') {
        instances.push(outcome.value);
        substituted.push(backups[i].id);
      }
    }
  }

  return {
    skillContext: skill,
    instances,
    diagnostics: {
      usedFallbackSelection: usedFallback,
      planned: selections,
      dropped,
      substituted,
      ms: Date.now() - startedAt,
    },
  };
}
