/**
 * Single source of truth for model + tunables.
 *
 * The model string is confirmed from the current Claude API docs map. Claude
 * Opus 4.8 takes adaptive thinking only (`{type: "adaptive"}`) and rejects
 * `temperature` / `top_p` / `top_k` and assistant prefills.
 */
export const CLAUDE_MODEL = 'claude-opus-4-8';

/** Keep generation snappy — content-fill responses are small JSON payloads. */
export const LLM_MAX_TOKENS = 2048;

/** §14: LLM output must pass Zod; retry at most twice, then drop the mechanic. */
export const LLM_MAX_RETRIES = 2;

/** Optional SEED for reproducible procedural generation in tests (§15). */
export function envSeed(): number | undefined {
  const raw = process.env.SEED;
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n >>> 0 : undefined;
}

/**
 * Server-only. Throws rather than silently constructing a keyless client, so a
 * missing env var fails at the API route instead of at the model call.
 */
export function requireApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to .env.local (local) or the Vercel project env (deployed).',
    );
  }
  return key;
}
