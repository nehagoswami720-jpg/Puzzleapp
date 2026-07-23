/**
 * Server-side registry bootstrap — the full catalog, procedural and LLM.
 *
 * Importing this pulls in `lib/llm/*`, so it may only be reached from API
 * routes. Client code uses `procedural.ts` instead.
 */
import { contextClozeMechanic } from './contextCloze';
import { register } from './index';
import { PROCEDURAL_MECHANICS } from './procedural';
import { spotTheFallacyMechanic } from './spotTheFallacy';

let bootstrapped = false;

/**
 * Idempotent: serverless handlers re-import freely, and `register` throws on a
 * duplicate id to catch genuine collisions.
 */
export function registerAllMechanics(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  for (const m of [...PROCEDURAL_MECHANICS, spotTheFallacyMechanic, contextClozeMechanic]) {
    register(m);
  }
}
