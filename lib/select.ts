/**
 * Mechanic selection (§10 step 2).
 *
 * Two jobs:
 *
 * 1. `rankMechanics` — a deterministic tag-overlap scorer. It's the cheap
 *    fallback when the planner call fails, and it makes selection testable
 *    offline with no model in the loop.
 * 2. `enforceVariety` — applied to *whatever* produced the shortlist, planner or
 *    fallback, so "not four multiple-choice puzzles" and "at least one easier
 *    win" hold no matter which path we came down.
 */
import type { CatalogEntry, Difficulty, SkillContext } from './mechanics/types';

export interface Selection {
  mechanicId: string;
  difficulty: Difficulty;
  /** short rationale — surfaced in dev, useful for debugging a bad match */
  reason: string;
}

export interface RankedMechanic {
  entry: CatalogEntry;
  score: number;
}

/** Domains that lean on meaning, where a content-matched mechanic fits better. */
const CONTENT_DOMAINS = new Set(['language', 'knowledge']);

/**
 * Score = how many of the interpreted sub-skills this mechanic trains, with a
 * nudge toward the right match mode for the domain. Deliberately simple: it
 * only has to be a sane backstop, not a clever ranker.
 */
export function rankMechanics(
  skill: SkillContext,
  entries: CatalogEntry[],
): RankedMechanic[] {
  const wanted = new Set<string>(skill.subSkills);

  return entries
    .map((entry) => {
      const overlap = entry.subSkills.filter((s) => wanted.has(s)).length;
      let score = overlap * 10;

      // A content-matched mechanic answers a language/knowledge ask more
      // directly; a cognitive one answers a reasoning/spatial ask.
      const wantsContent = CONTENT_DOMAINS.has(skill.domain);
      if (wantsContent === (entry.matchMode === 'content')) score += 3;

      // With no overlap at all, keep it eligible but clearly last.
      if (overlap === 0) score -= 5;

      return { entry, score };
    })
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
}

/** Deterministic shortlist — the fallback path. */
export function fallbackSelect(
  skill: SkillContext,
  entries: CatalogEntry[],
  count = 4,
): Selection[] {
  const ranked = rankMechanics(skill, entries);
  const picked = ranked.slice(0, Math.min(count, ranked.length)).map(({ entry }, i) => ({
    mechanicId: entry.id,
    difficulty: (i === 0 ? 'easy' : 'medium') as Difficulty,
    reason: `Trains ${entry.subSkills.slice(0, 2).join(' and ')}.`,
  }));
  return enforceVariety(picked, entries);
}

/**
 * §10's two selection rules, enforced after the fact.
 *
 * Variety is measured by `answerType` because that's what actually determines
 * how a puzzle *feels* to answer — two mechanics that both render as four
 * options are the same interaction twice, however different their subject
 * matter.
 */
export function enforceVariety(
  selections: Selection[],
  entries: CatalogEntry[],
  maxPerAnswerType = 2,
): Selection[] {
  const byId = new Map(entries.map((e) => [e.id, e]));

  // Drop unknown ids and duplicates. An id outside the catalog can only come
  // from a model that ignored its instructions — the core invariant says it
  // never gets to invent one.
  const seen = new Set<string>();
  const known = selections.filter((s) => {
    if (!byId.has(s.mechanicId) || seen.has(s.mechanicId)) return false;
    seen.add(s.mechanicId);
    return true;
  });

  // Cap how many share an interaction shape.
  const typeCounts = new Map<string, number>();
  const varied: Selection[] = [];
  const benched: Selection[] = [];
  for (const s of known) {
    const type = byId.get(s.mechanicId)!.answerType;
    const n = typeCounts.get(type) ?? 0;
    if (n >= maxPerAnswerType) {
      benched.push(s);
      continue;
    }
    typeCounts.set(type, n + 1);
    varied.push(s);
  }

  // Backfill from mechanics we haven't used, preferring an unseen answer type.
  if (varied.length < 3) {
    const unused = entries
      .filter((e) => !seen.has(e.id))
      .sort((a, b) => {
        const aNew = (typeCounts.get(a.answerType) ?? 0) === 0 ? -1 : 0;
        const bNew = (typeCounts.get(b.answerType) ?? 0) === 0 ? -1 : 0;
        return aNew - bNew;
      });
    for (const e of unused) {
      if (varied.length >= 3) break;
      typeCounts.set(e.answerType, (typeCounts.get(e.answerType) ?? 0) + 1);
      varied.push({
        mechanicId: e.id,
        difficulty: 'medium',
        reason: `Adds variety — trains ${e.subSkills[0]}.`,
      });
      seen.add(e.id);
    }
    // Still short: rather than show two cards, allow a benched duplicate shape back.
    for (const s of benched) {
      if (varied.length >= 3) break;
      varied.push(s);
    }
  }

  const result = varied.slice(0, 4);

  // At least one easier win, so the set never opens with a wall.
  if (result.length > 0 && !result.some((s) => s.difficulty === 'easy')) {
    const target =
      result.find((s) => byId.get(s.mechanicId)?.difficulties.includes('easy')) ?? result[0];
    target.difficulty = 'easy';
  }

  return result;
}
