import { NextResponse } from 'next/server';
import { z } from 'zod';
import { promptToPuzzles } from '@/lib/pipeline';

/**
 * The pipeline endpoint (§10). Interpret + select + generate in one call, which
 * §10 explicitly allows for MVP and which saves a round trip we can't spare
 * once generation follows.
 */
export const runtime = 'nodejs';
/** Planner call, then 3-4 generations in parallel. Headroom over the ~12s norm. */
export const maxDuration = 90;

const bodySchema = z.object({
  prompt: z.string().min(2).max(300),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Tell us the skill you want to practise (2-300 characters).' },
      { status: 400 },
    );
  }

  try {
    const outcome = await promptToPuzzles(parsed.data.prompt);

    if (outcome.instances.length === 0 && !outcome.skillContext.needsClarification) {
      return NextResponse.json(
        { error: 'Could not build a set for that just now. Try rephrasing the skill.' },
        { status: 502 },
      );
    }
    return NextResponse.json(outcome);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed.';
    // A missing key is a deployment problem, not a user problem — say so plainly.
    const isConfig = message.includes('ANTHROPIC_API_KEY');
    return NextResponse.json(
      { error: isConfig ? 'The server is missing its API key.' : message },
      { status: isConfig ? 503 : 500 },
    );
  }
}
