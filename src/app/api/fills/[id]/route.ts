import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { requireRequestUser } from '@/lib/request-auth';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  const before = await prisma.fill.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: 'Fill no encontrado' }, { status: 404 });

  const body = await request.json();
  const updated = await prisma.fill.update({
    where: { id: params.id },
    data: {
      symbol: body.symbol ?? undefined,
      price: body.price !== undefined ? Number(body.price) : undefined,
      quantity: body.quantity !== undefined ? Number(body.quantity) : undefined,
      side: body.side ?? undefined,
      timestamp: body.timestamp ? new Date(body.timestamp) : undefined,
      commission: body.commission !== undefined ? Number(body.commission) : undefined,
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
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'ADMIN') return NextResponse.json({ error: 'Solo admin puede eliminar fills' }, { status: 403 });

  const before = await prisma.fill.findUnique({ where: { id: params.id } });
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
}
