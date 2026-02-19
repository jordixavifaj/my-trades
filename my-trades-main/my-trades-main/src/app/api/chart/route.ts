import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUser } from '@/lib/request-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = requireRequestUser(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get('symbol') ?? '').trim();
    const day = (searchParams.get('day') ?? '').trim();

    if (!symbol) {
      return NextResponse.json({ error: 'symbol es obligatorio' }, { status: 400 });
    }

    let range: { start: Date; end: Date } | null = null;
    if (day) {
      const match = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) {
        return NextResponse.json({ error: 'day debe tener formato YYYY-MM-DD' }, { status: 400 });
      }

      const y = Number.parseInt(match[1], 10);
      const m = Number.parseInt(match[2], 10);
      const d = Number.parseInt(match[3], 10);
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
        return NextResponse.json({ error: 'day inválido' }, { status: 400 });
      }

      const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      const end = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
      range = { start, end };
    }

    const where = {
      userId: auth.id,
      symbol: { equals: symbol, mode: 'insensitive' as const },
      ...(range
        ? {
            OR: [
              { openDate: { gte: range.start, lt: range.end } },
              { closeDate: { gte: range.start, lt: range.end } },
            ],
          }
        : {}),
    };

    const trades = await prisma.trade.findMany({
      where,
      include: { fills: true, strategy: true },
      orderBy: { openDate: 'asc' },
    });

    return NextResponse.json({ items: trades });
  } catch (error) {
    console.error('Chart API error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
