import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUserWithFreshRole } from '@/lib/request-auth';
import { canViewUser } from '@/lib/access-control';
import { fromZonedTime } from 'date-fns-tz';

export const runtime = 'nodejs';

const TZ = 'America/New_York';

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  const { userId } = params;

  const access = await canViewUser(auth.id, auth.role, userId);
  if (!access) {
    return NextResponse.json({ error: 'No tienes acceso a este usuario' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const date = searchParams.get('date');

  if (!symbol || !date) {
    return NextResponse.json({ error: 'symbol and date are required' }, { status: 400 });
  }

  const start = fromZonedTime(`${date}T00:00:00.000`, TZ);
  const end = fromZonedTime(`${date}T23:59:59.999`, TZ);

  try {
    const trades = await prisma.trade.findMany({
      where: {
        userId,
        symbol,
        fills: {
          some: {
            timestamp: { gte: start, lte: end },
          },
        },
      },
      orderBy: { openDate: 'asc' },
      include: {
        fills: {
          where: { timestamp: { gte: start, lte: end } },
        },
      },
    });

    return NextResponse.json({
      symbol,
      date,
      trades: trades.map((t) => ({
        id: t.id,
        ticker: t.symbol,
        date,
        direction: t.side === 'BUY' ? ('LONG' as const) : ('SHORT' as const),
        entry_time: t.openDate.toISOString(),
        entry_price: t.openPrice,
        exit_time: (t.closeDate ?? t.openDate).toISOString(),
        exit_price: t.closePrice ?? t.openPrice,
        size: t.quantity,
        pnl: t.pnl ?? 0,
        fills: t.fills
          .slice()
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
          .map((f) => ({
            id: f.id,
            side: f.side as 'BUY' | 'SELL',
            quantity: f.quantity,
            price: f.price,
            timestamp: f.timestamp.toISOString(),
            commission: f.commission,
          })),
      })),
    });
  } catch (error) {
    console.error('GET /api/users/[userId]/dashboard/trades failed', error);
    return NextResponse.json({ error: 'Error al obtener trades' }, { status: 500 });
  }
}
