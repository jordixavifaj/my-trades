import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUser } from '@/lib/request-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
  }

  const lastFill = await prisma.fill.findFirst({
    where: {
      symbol,
      trade: {
        userId: auth.id,
      },
    },
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true },
  });

  const date = lastFill?.timestamp ? lastFill.timestamp.toISOString().slice(0, 10) : null;
  return NextResponse.json({ symbol, date });
}
