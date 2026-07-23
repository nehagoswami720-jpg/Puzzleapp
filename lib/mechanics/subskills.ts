/**
 * Controlled sub-skill vocabulary (§8).
 *
 * The interpreter and every mechanic draw from this exact set — selection is a
 * tag-overlap problem, so a tag the interpreter invents matches nothing.
 */
export const SUB_SKILLS = [
  'deductive-reasoning',
  'inductive-reasoning',
  'assumption-identification',
  'fallacy-detection',
  'argument-evaluation',
  'logical-consistency',
  'planning',
  'sequential-reasoning',
  'systematic-search',
  'spatial-reasoning',
  'visual-pattern',
  'pattern-recognition',
  'abstract-reasoning',
  'analogical-reasoning',
  'vocabulary',
  'word-meaning',
  'semantic-relations',
  'verbal-fluency',
  'mental-arithmetic',
  'estimation',
  'numerical-pattern',
  'working-memory',
  'recall',
  'categorization',
  'general-knowledge',
] as const;

export type SubSkill = (typeof SUB_SKILLS)[number];

const SUB_SKILL_SET: ReadonlySet<string> = new Set(SUB_SKILLS);

export function isSubSkill(value: string): value is SubSkill {
  return SUB_SKILL_SET.has(value);
}

/** Drop anything outside the vocabulary — used to sanitise LLM interpreter output. */
export function coerceSubSkills(values: readonly string[]): SubSkill[] {
  return values.filter(isSubSkill);
}

/** Human-readable labels for `trainsLabel` and card copy. */
export const SUB_SKILL_LABELS: Record<SubSkill, string> = {
  'deductive-reasoning': 'deductive reasoning',
  'inductive-reasoning': 'inductive reasoning',
  'assumption-identification': 'spotting hidden assumptions',
  'fallacy-detection': 'spotting logical fallacies',
  'argument-evaluation': 'evaluating arguments',
  'logical-consistency': 'logical consistency',
  planning: 'planning ahead',
  'sequential-reasoning': 'sequential reasoning',
  'systematic-search': 'systematic search',
  'spatial-reasoning': 'spatial reasoning',
  'visual-pattern': 'visual pattern recognition',
  'pattern-recognition': 'pattern recognition',
  'abstract-reasoning': 'abstract reasoning',
  'analogical-reasoning': 'reasoning by analogy',
  vocabulary: 'vocabulary',
  'word-meaning': 'word meaning in context',
  'semantic-relations': 'semantic relationships',
  'verbal-fluency': 'verbal fluency',
  'mental-arithmetic': 'mental arithmetic',
  estimation: 'estimation',
  'numerical-pattern': 'numerical patterns',
  'working-memory': 'working memory',
  recall: 'recall',
  categorization: 'categorisation',
  'general-knowledge': 'general knowledge',
};

/** "Trains: planning ahead and spatial reasoning" */
export function trainsLabel(subSkills: readonly SubSkill[]): string {
  const parts = subSkills.slice(0, 2).map((s) => SUB_SKILL_LABELS[s]);
  if (parts.length === 0) return 'Trains: general reasoning';
  if (parts.length === 1) return `Trains: ${parts[0]}`;
  return `Trains: ${parts[0]} and ${parts[1]}`;
}
