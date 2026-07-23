import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ContentFillError } from '@/lib/llm/generateInstance';
import { getMechanic } from '@/lib/mechanics';
import { registerAllMechanics } from '@/lib/mechanics/server';
import type { SkillContext } from '@/lib/mechanics/types';

/**
 * Dev-only generation endpoint: one named mechanic at one difficulty.
 *
 * Phase 2 replaces this with /api/generate, which interprets a prompt, selects
 * 3–4 mechanics and returns a set. This route exists so the harness can drive
 * each mechanic in isolation, which is the whole point of Phase 1.
 */
export const runtime = 'nodejs';
/** LLM mechanics do a model call plus up to two validation retries. */
export const maxDuration = 60;

const bodySchema = z.object({
  mechanicId: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  /** free text, so the harness can check that the prompt actually steers content */
  prompt: z.string().max(300).optional(),
  seed: z.number().int().optional(),
});

export async function POST(request: Request) {
  registerAllMechanics();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const { mechanicId, difficulty, prompt, seed } = parsed.data;

  const mechanic = getMechanic(mechanicId);
  if (!mechanic) {
    return NextResponse.json({ error: `Unknown mechanic "${mechanicId}".` }, { status: 404 });
  }
  if (!mechanic.difficulties.includes(difficulty)) {
    return NextResponse.json(
      { error: `"${mechanicId}" does not support ${difficulty}.` },
      { status: 400 },
    );
  }

  // Phase 2 builds this from /api/interpret. Here it's a stand-in so the
  // mechanics can be exercised without the pipeline existing yet.
  const skill: SkillContext = {
    rawPrompt: prompt?.trim() || 'general practice',
    canonicalSkill: prompt?.trim() || 'General Reasoning',
    subSkills: [],
    domain: 'other',
    needsClarification: false,
  };

  const startedAt = Date.now();
  try {
    const instance = await mechanic.generate({ skill, difficulty, seed });
    return NextResponse.json({ instance, ms: Date.now() - startedAt });
  } catch (err) {
    if (err instanceof ContentFillError) {
      // §10: a mechanic that can't produce a valid instance is dropped, not shown.
      return NextResponse.json(
        { error: err.message, attempts: err.attempts, ms: Date.now() - startedAt },
        { status: 422 },
      );
    }
    const message = err instanceof Error ? err.message : 'Generation failed.';
    return NextResponse.json({ error: message, ms: Date.now() - startedAt }, { status: 500 });
  }
}
