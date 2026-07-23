import type { CatalogEntry, Mechanic } from './types';

/**
 * The fixed mechanic catalog. The LLM only ever chooses from and fills what is
 * registered here — it never invents a new game type (§10 invariant).
 *
 * Phase 0 registers nothing; Phase 1 adds zip, sequence, spotTheFallacy and
 * contextCloze.
 */
const registry = new Map<string, Mechanic<never, never, never>>();

export function register<C, A, S>(mechanic: Mechanic<C, A, S>): void {
  if (registry.has(mechanic.id)) {
    throw new Error(`Mechanic "${mechanic.id}" is already registered`);
  }
  registry.set(mechanic.id, mechanic as unknown as Mechanic<never, never, never>);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMechanic(id: string): Mechanic<any, any, any> | undefined {
  return registry.get(id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function allMechanics(): Mechanic<any, any, any>[] {
  return [...registry.values()];
}

/** The trimmed view handed to the planner — ids the model may pick from. */
export function catalog(): CatalogEntry[] {
  return allMechanics().map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    subSkills: m.subSkills,
    engine: m.engine,
    matchMode: m.matchMode,
    difficulties: m.difficulties,
  }));
}
