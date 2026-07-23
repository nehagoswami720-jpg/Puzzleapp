/**
 * Client-safe mechanic set.
 *
 * Procedural generators are pure TypeScript with no network and no secrets, so
 * they can run in the browser — which is also what makes offline play possible
 * later (§18). This module must stay free of any `lib/llm/*` import.
 */
import { sequenceMechanic } from './sequence';
import type { Mechanic } from './types';
import { zipMechanic } from './zip';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PROCEDURAL_MECHANICS: Mechanic<any, any, any>[] = [zipMechanic, sequenceMechanic];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getProceduralMechanic(id: string): Mechanic<any, any, any> | undefined {
  return PROCEDURAL_MECHANICS.find((m) => m.id === id);
}
