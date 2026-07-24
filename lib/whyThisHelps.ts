/**
 * The "why this helps" line (§12.3) — the sentence that ties a puzzle back to
 * the skill the user asked for.
 *
 * Built deterministically from the instance rather than with another model
 * call: it's derived from data we already have (the trained sub-skills and the
 * canonical skill), so it costs nothing and never contradicts the card.
 */
import { SUB_SKILL_LABELS } from './mechanics/subskills';
import type { PuzzleInstance } from './mechanics/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function whyThisHelps(instance: PuzzleInstance<any, any>): string {
  const labels = instance.subSkillsTrained.map((s) => SUB_SKILL_LABELS[s]).filter(Boolean);
  const skill = instance.skillContext.canonicalSkill;

  const trained =
    labels.length === 0
      ? 'the thinking behind it'
      : labels.length === 1
        ? labels[0]
        : `${labels[0]} and ${labels[1]}`;

  return `Every round of this exercises ${trained} — the faculty ${skill.toLowerCase()} is built on. Reps here compound: the more of these you work through, the more automatic that move becomes.`;
}
