import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { requireRequestUser } from '@/lib/request-auth';

export async function POST(request: NextRequest) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  if (!body.tradeId) {
    return NextResponse.json({ error: 'tradeId es obligatorio' }, { status: 400 });
  }

  const trade = await prisma.trade.findUnique({ where: { id: body.tradeId } });
  if (!trade) return NextResponse.json({ error: 'Trade no encontrado' }, { status: 404 });

  const fill = await prisma.fill.create({
    data: {
      tradeId: body.tradeId,
      symbol: body.symbol,
      price: Number(body.price),
      quantity: Number(body.quantity),
      side: body.side,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      commission: Number(body.commission ?? 0),
    },
  });

  await createAuditLog({
    userId: auth.id,
    tradeId: body.tradeId,
    action: 'FILL_CREATE',
    reason: body.reason ?? 'manual_fill_create',
    newValue: fill,
  });

  return NextResponse.json(fill, { status: 201 });
}
