import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { requireRequestUser } from '@/lib/request-auth';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  const before = await prisma.trade.findUnique({ where: { id: params.id }, include: { fills: true } });
  if (!before) return NextResponse.json({ error: 'Trade no encontrado' }, { status: 404 });

  const body = await request.json();
  const updated = await prisma.trade.update({
    where: { id: params.id },
    data: {
      symbol: body.symbol ?? undefined,
      status: body.status ?? undefined,
      strategyId: body.strategyId ?? undefined,
      openDate: body.openDate ? new Date(body.openDate) : undefined,
      closeDate: body.closeDate ? new Date(body.closeDate) : body.closeDate === null ? null : undefined,
      openPrice: body.openPrice !== undefined ? Number(body.openPrice) : undefined,
      closePrice: body.closePrice !== undefined ? (body.closePrice === null ? null : Number(body.closePrice)) : undefined,
      quantity: body.quantity !== undefined ? Number(body.quantity) : undefined,
      side: body.side ?? undefined,
      pnl: body.pnl !== undefined ? (body.pnl === null ? null : Number(body.pnl)) : undefined,
      commission: body.commission !== undefined ? Number(body.commission) : undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
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
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'ADMIN') return NextResponse.json({ error: 'Solo admin puede eliminar' }, { status: 403 });

  const before = await prisma.trade.findUnique({ where: { id: params.id }, include: { fills: true } });
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
}
