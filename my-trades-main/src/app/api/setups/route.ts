import { NextResponse } from 'next/server';
import { setupCatalog } from '@/lib/ticker-intelligence/setups';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    items: setupCatalog
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ id: s.id, name: s.name, side: s.side, phase: s.phase, summary: s.summary })),
  });
}
