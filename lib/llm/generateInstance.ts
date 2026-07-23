/**
 * Engine B — LLM content-fill (§4, §14).
 *
 * The model is never asked for prose describing a puzzle. It is handed a single
 * tool whose input schema *is* the mechanic's content schema, and forced to call
 * it. What comes back is validated with Zod; on failure we retry with the
 * validation error fed back, at most twice, then give up so the caller can drop
 * the mechanic rather than show something malformed.
 */
import type { z } from 'zod';
import { z as zod } from 'zod';
import { CLAUDE_MODEL, LLM_MAX_RETRIES, LLM_MAX_TOKENS } from '../config';
import { anthropic } from './client';

export class ContentFillError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
  ) {
    super(message);
    this.name = 'ContentFillError';
  }
}

/**
 * Strict tool use guarantees the input validates against the schema, but it
 * doesn't accept every JSON Schema keyword — length and numeric bounds among
 * them. Strip those for the wire; Zod still enforces them on the way back, which
 * is where they actually matter.
 */
const UNSUPPORTED = new Set([
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'pattern',
  'format',
  '$schema',
]);

function sanitiseSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitiseSchema);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (UNSUPPORTED.has(k)) continue;
      out[k] = sanitiseSchema(v);
    }
    return out;
  }
  return node;
}

/**
 * A deliberately light screen (§14). The real defence is the prompt and the
 * model itself; this only catches an obvious slip before it reaches a screen.
 */
const BANNED = /\b(fuck|shit|bitch|bastard|slut|whore|rape|nigger|faggot)\b/i;

export function passesContentFilter(text: string): boolean {
  return !BANNED.test(text);
}

export interface ContentFillArgs<T> {
  /** the mechanic's content schema — also the tool's input schema */
  schema: z.ZodType<T>;
  /** tool name the model is forced to call, e.g. "emit_fallacy_puzzle" */
  toolName: string;
  toolDescription: string;
  system: string;
  /** the generation request; difficulty and skill are interpolated by the caller */
  userPrompt: string;
  /** thinking depth vs latency. Content-fill is short work — 'low'/'medium'. */
  effort?: 'low' | 'medium' | 'high';
  /** joined and screened to catch inappropriate output before it renders */
  screenedFields?: (value: T) => string[];
}

/**
 * Calls the model, validates, retries. Returns validated content or throws
 * `ContentFillError` after `LLM_MAX_RETRIES` retries.
 */
export async function fillContent<T>(args: ContentFillArgs<T>): Promise<T> {
  const {
    schema,
    toolName,
    toolDescription,
    system,
    userPrompt,
    effort = 'medium',
    screenedFields,
  } = args;

  const inputSchema = sanitiseSchema(zod.toJSONSchema(schema)) as Record<string, unknown>;
  const failures: string[] = [];

  for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
    const correction =
      failures.length === 0
        ? ''
        : `\n\nYour previous attempt was rejected: ${failures[failures.length - 1]}\nProduce a fresh puzzle that satisfies every constraint.`;

    let toolInput: unknown;
    try {
      const response = await anthropic().messages.create({
        model: CLAUDE_MODEL,
        max_tokens: LLM_MAX_TOKENS,
        system,
        // Forced tool use is incompatible with thinking, and content-fill is
        // short structured work that doesn't benefit from it. Effort carries
        // the quality knob instead.
        thinking: { type: 'disabled' },
        output_config: { effort },
        tools: [
          {
            name: toolName,
            description: toolDescription,
            strict: true,
            input_schema: inputSchema as never,
          },
        ],
        tool_choice: { type: 'tool', name: toolName },
        messages: [{ role: 'user', content: userPrompt + correction }],
      });

      if (response.stop_reason === 'refusal') {
        throw new ContentFillError('The model declined this request.', attempt + 1);
      }
      const block = response.content.find((b) => b.type === 'tool_use');
      if (!block) {
        failures.push('you did not call the required tool');
        continue;
      }
      toolInput = block.input;
    } catch (err) {
      if (err instanceof ContentFillError) throw err;
      // Network/API error — no point re-prompting with a correction.
      throw new ContentFillError(
        `Model call failed: ${err instanceof Error ? err.message : String(err)}`,
        attempt + 1,
      );
    }

    const parsed = schema.safeParse(toolInput);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .slice(0, 4)
        .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
        .join('; ');
      // Each retry costs a full round trip, so a recurring failure here is a
      // latency bug, not just a quality one — surface it rather than absorb it.
      console.warn(`[${toolName}] attempt ${attempt + 1} failed validation: ${detail}`);
      failures.push(detail);
      continue;
    }

    const screened = screenedFields?.(parsed.data) ?? [];
    if (!screened.every(passesContentFilter)) {
      failures.push('the wording was inappropriate; keep it everyday and neutral');
      continue;
    }

    return parsed.data;
  }

  throw new ContentFillError(
    `Could not produce valid content after ${LLM_MAX_RETRIES + 1} attempts. Last problem: ${failures[failures.length - 1] ?? 'unknown'}`,
    LLM_MAX_RETRIES + 1,
  );
}
