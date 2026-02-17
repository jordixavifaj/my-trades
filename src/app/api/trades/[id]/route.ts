import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { requireRequestUser } from '@/lib/request-auth';
import { logError } from '@/lib/logger';
import { parseDate, parseInteger, parseNumber, parseString } from '@/lib/validation';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const before = await prisma.trade.findFirst({ where: { id: params.id, userId: auth.id }, include: { fills: true } });
    if (!before) return NextResponse.json({ error: 'Trade no encontrado' }, { status: 404 });

    const body = await request.json();
    const updated = await prisma.trade.update({
      where: { id: params.id },
      data: {
        symbol: body.symbol !== undefined ? parseString(body.symbol, 'symbol', { minLength: 1, maxLength: 16 }).toUpperCase() : undefined,
        status: body.status ?? undefined,
        strategyId: body.strategyId ?? undefined,
        openDate: body.openDate ? parseDate(body.openDate, 'openDate') : undefined,
        closeDate: body.closeDate ? parseDate(body.closeDate, 'closeDate') : body.closeDate === null ? null : undefined,
        openPrice: body.openPrice !== undefined ? parseNumber(body.openPrice, 'openPrice', { min: 0 }) : undefined,
        closePrice:
          body.closePrice !== undefined ? (body.closePrice === null ? null : parseNumber(body.closePrice, 'closePrice', { min: 0 })) : undefined,
        quantity: body.quantity !== undefined ? parseInteger(body.quantity, 'quantity', { min: 1 }) : undefined,
        side: body.side ?? undefined,
        pnl: body.pnl !== undefined ? (body.pnl === null ? null : parseNumber(body.pnl, 'pnl')) : undefined,
        commission: body.commission !== undefined ? parseNumber(body.commission, 'commission', { min: 0 }) : undefined,
        notes: body.notes !== undefined ? (body.notes === null ? null : parseString(body.notes, 'notes', { maxLength: 2000 })) : undefined,
      },
      include: { fills: true, strategy: true },
    });

    await createAuditLog({
      userId: auth.id,
      tradeId: updated.id,
      action: 'TRADE_UPDATE',
      reason: body.reason ?? 'manual_update',
      oldValue: before,
      newValue: updated,
    });

    return NextResponse.json(updated);
  } catch (error) {
    logError('PATCH /api/trades/[id] failed', error, { userId: auth.id, tradeId: params.id });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo actualizar el trade' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'ADMIN') return NextResponse.json({ error: 'Solo admin puede eliminar' }, { status: 403 });

  try {
    const before = await prisma.trade.findFirst({ where: { id: params.id, userId: auth.id }, include: { fills: true } });
    if (!before) return NextResponse.json({ error: 'Trade no encontrado' }, { status: 404 });

    await prisma.trade.delete({ where: { id: params.id } });
    await createAuditLog({
      userId: auth.id,
      tradeId: params.id,
      action: 'TRADE_DELETE',
      reason: 'manual_delete',
      oldValue: before,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError('DELETE /api/trades/[id] failed', error, { userId: auth.id, tradeId: params.id });
    return NextResponse.json({ error: 'No se pudo eliminar el trade' }, { status: 500 });
  }
}
