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
    const before = await prisma.fill.findFirst({ where: { id: params.id, trade: { userId: auth.id } } });
    if (!before) return NextResponse.json({ error: 'Fill no encontrado' }, { status: 404 });

    const body = await request.json();
    const updated = await prisma.fill.update({
      where: { id: params.id },
      data: {
        symbol: body.symbol !== undefined ? parseString(body.symbol, 'symbol', { minLength: 1, maxLength: 16 }).toUpperCase() : undefined,
        price: body.price !== undefined ? parseNumber(body.price, 'price', { min: 0 }) : undefined,
        quantity: body.quantity !== undefined ? parseInteger(body.quantity, 'quantity', { min: 1 }) : undefined,
        side: body.side ?? undefined,
        timestamp: body.timestamp ? parseDate(body.timestamp, 'timestamp') : undefined,
        commission: body.commission !== undefined ? parseNumber(body.commission, 'commission', { min: 0 }) : undefined,
      },
    });

    await createAuditLog({
      userId: auth.id,
      tradeId: updated.tradeId,
      action: 'FILL_UPDATE',
      reason: body.reason ?? 'manual_fill_update',
      oldValue: before,
      newValue: updated,
    });

    return NextResponse.json(updated);
  } catch (error) {
    logError('PATCH /api/fills/[id] failed', error, { userId: auth.id, fillId: params.id });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo actualizar el fill' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'ADMIN') return NextResponse.json({ error: 'Solo admin puede eliminar fills' }, { status: 403 });

  try {
    const before = await prisma.fill.findFirst({ where: { id: params.id, trade: { userId: auth.id } } });
    if (!before) return NextResponse.json({ error: 'Fill no encontrado' }, { status: 404 });

    await prisma.fill.delete({ where: { id: params.id } });
    await createAuditLog({
      userId: auth.id,
      tradeId: before.tradeId,
      action: 'FILL_DELETE',
      reason: 'manual_fill_delete',
      oldValue: before,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError('DELETE /api/fills/[id] failed', error, { userId: auth.id, fillId: params.id });
    return NextResponse.json({ error: 'No se pudo eliminar el fill' }, { status: 500 });
  }
}
