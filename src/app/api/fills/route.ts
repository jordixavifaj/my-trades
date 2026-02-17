import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { requireRequestUser } from '@/lib/request-auth';
import { logError } from '@/lib/logger';
import { parseDate, parseInteger, parseNumber, parseString } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    if (!body.tradeId) {
      return NextResponse.json({ error: 'tradeId es obligatorio' }, { status: 400 });
    }

    const trade = await prisma.trade.findFirst({ where: { id: body.tradeId, userId: auth.id } });
    if (!trade) return NextResponse.json({ error: 'Trade no encontrado' }, { status: 404 });

    const fill = await prisma.fill.create({
      data: {
        tradeId: body.tradeId,
        symbol: parseString(body.symbol, 'symbol', { minLength: 1, maxLength: 16 }).toUpperCase(),
        price: parseNumber(body.price, 'price', { min: 0 }),
        quantity: parseInteger(body.quantity, 'quantity', { min: 1 }),
        side: body.side,
        timestamp: body.timestamp ? parseDate(body.timestamp, 'timestamp') : new Date(),
        commission: parseNumber(body.commission ?? 0, 'commission', { min: 0 }),
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
  } catch (error) {
    logError('POST /api/fills failed', error, { userId: auth.id });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo crear el fill' }, { status: 400 });
  }
}
