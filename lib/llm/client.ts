import Anthropic from '@anthropic-ai/sdk';
import { requireApiKey } from '../config';

/**
 * Anthropic SDK wrapper. Server-side only — this module must never be reachable
 * from a client component, or the key would be bundled for the browser.
 *
 * The API-route boundary already enforces that; the runtime guard below turns a
 * subtle leak into a loud failure if an import ever crosses the line.
 */
if (typeof window !== 'undefined') {
  throw new Error(
    'lib/llm/client.ts was imported in the browser. Anthropic calls must stay in server-side API routes.',
  );
}

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: requireApiKey() });
  return client;
}
