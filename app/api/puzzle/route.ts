import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ContentFillError } from '@/lib/llm/generateInstance';
import { getMechanic } from '@/lib/mechanics';
import { registerAllMechanics } from '@/lib/mechanics/server';
import { SUB_SKILLS } from '@/lib/mechanics/subskills';
import type { SkillContext } from '@/lib/mechanics/types';

/**
 * Regenerate a single puzzle — the server side of "Try another" and "Make it
 * harder" for LLM mechanics. (Procedural mechanics regenerate in the browser
 * with no network, so they never reach this route.)
 *
 * The skill context is passed back from the client so regenerated content stays
 * on the skill the user asked for. It's untrusted, so it's validated and only
 * ever used to steer the generation prompt.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const skillSchema = z.object({
  rawPrompt: z.string().max(300),
  canonicalSkill: z.string().max(80),
  subSkills: z.array(z.enum(SUB_SKILLS)).max(8),
  domain: z.enum(['reasoning', 'language', 'numeracy', 'memory', 'spatial', 'knowledge', 'other']),
  needsClarification: z.boolean().optional(),
  clarifyingQuestion: z.string().max(300).optional(),
});

const bodySchema = z.object({
  mechanicId: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  skillContext: skillSchema,
});

export async function POST(request: Request) {
  registerAllMechanics();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const { mechanicId, difficulty, skillContext } = parsed.data;

  const mechanic = getMechanic(mechanicId);
  if (!mechanic) {
    return NextResponse.json({ error: `Unknown mechanic "${mechanicId}".` }, { status: 404 });
  }
  const usableDifficulty = mechanic.difficulties.includes(difficulty)
    ? difficulty
    : mechanic.difficulties[mechanic.difficulties.length - 1];

  const skill: SkillContext = {
    rawPrompt: skillContext.rawPrompt,
    canonicalSkill: skillContext.canonicalSkill,
    subSkills: skillContext.subSkills,
    domain: skillContext.domain,
    needsClarification: false,
  };

  try {
    const instance = await mechanic.generate({ skill, difficulty: usableDifficulty });
    return NextResponse.json({ instance });
  } catch (err) {
    if (err instanceof ContentFillError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : 'Generation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
