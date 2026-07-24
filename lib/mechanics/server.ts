/**
 * Server-side registry bootstrap — the full catalog, procedural and LLM.
 *
 * Importing this pulls in `lib/llm/*`, so it may only be reached from API
 * routes. Client code uses `procedural.ts` instead.
 */
import { connectionsMechanic } from './connectionsMechanic';
import { contextClozeMechanic } from './contextCloze';
import { register } from './index';
import { oddOneOutMechanic } from './oddOneOut';
import { PROCEDURAL_MECHANICS } from './procedural';
import { spotTheFallacyMechanic } from './spotTheFallacy';
import { triviaMechanic } from './trivia';

let bootstrapped = false;

/**
 * Idempotent: serverless handlers re-import freely, and `register` throws on a
 * duplicate id to catch genuine collisions.
 */
export function registerAllMechanics(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  const llm = [
    spotTheFallacyMechanic,
    contextClozeMechanic,
    triviaMechanic,
    oddOneOutMechanic,
    connectionsMechanic,
  ];
  for (const m of [...PROCEDURAL_MECHANICS, ...llm]) {
    register(m);
  }
}
