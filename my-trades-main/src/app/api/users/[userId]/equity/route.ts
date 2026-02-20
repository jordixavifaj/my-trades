import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUserWithFreshRole } from '@/lib/request-auth';
import { canViewUser } from '@/lib/access-control';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  const { userId } = params;

  const access = await canViewUser(auth.id, auth.role, userId);
  if (!access) {
    return NextResponse.json({ error: 'No tienes acceso' }, { status: 403 });
  }

  try {
    const trades = await prisma.trade.findMany({
      where: { userId, status: 'CLOSED' },
      orderBy: { closeDate: 'asc' },
      select: { pnl: true, closeDate: true, openDate: true },
    });

    let equity = 0;
    const curve = trades.map((t) => {
      equity += t.pnl ?? 0;
      return {
        date: (t.closeDate ?? t.openDate).toISOString().slice(0, 10),
        equity: Number(equity.toFixed(2)),
      };
    });

    return NextResponse.json({ curve, totalPnl: Number(equity.toFixed(2)), totalTrades: trades.length });
  } catch (error) {
    console.error('GET /api/users/[userId]/equity failed', error);
    return NextResponse.json({ error: 'Error al obtener equity' }, { status: 500 });
  }
}
