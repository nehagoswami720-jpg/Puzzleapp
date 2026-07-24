import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Broken-puzzle report (§12.5). No database in MVP, so "log it" means exactly
 * that — a structured console line Vercel captures. It's a quality signal to
 * mine later, not a feature with a UI of its own.
 */
export const runtime = 'nodejs';

const bodySchema = z.object({
  instanceId: z.string().min(1).max(120),
  mechanicId: z.string().min(1).max(60),
  difficulty: z.string().max(20).optional(),
  reason: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid report.' }, { status: 400 });
  }
  console.warn('[broken-puzzle]', JSON.stringify(parsed.data));
  return NextResponse.json({ ok: true });
}
