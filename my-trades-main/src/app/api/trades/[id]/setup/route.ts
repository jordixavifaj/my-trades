import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUser } from '@/lib/request-auth';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  const tradeId = params.id;
  if (!tradeId) return NextResponse.json({ error: 'trade id is required' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const setupName = typeof body?.setupName === 'string' ? body.setupName.trim() : '';
  const setupSource = typeof body?.setupSource === 'string' ? body.setupSource.trim() : 'MANUAL';

  const trade = await prisma.trade.findFirst({ where: { id: tradeId, userId: auth.id } });
  if (!trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 });

  const updated = await prisma.trade.update({
    where: { id: tradeId },
    data: {
      setupName: setupName.length ? setupName : null,
      setupSource: setupName.length ? setupSource : null,
    },
    select: { id: true, symbol: true, setupName: true, setupSource: true, updatedAt: true },
  });

  return NextResponse.json(updated);
}
