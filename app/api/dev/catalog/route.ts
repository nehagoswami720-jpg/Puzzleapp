import { NextResponse } from 'next/server';
import { catalog } from '@/lib/mechanics';
import { registerAllMechanics } from '@/lib/mechanics/server';

/**
 * The trimmed catalog view (§10). In Phase 2 this is what the planner model
 * sees; here it drives the /dev picker so the harness never hardcodes a
 * mechanic list that could drift from the registry.
 */
export const runtime = 'nodejs';

export async function GET() {
  registerAllMechanics();
  return NextResponse.json({ mechanics: catalog() });
}
