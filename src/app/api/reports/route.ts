import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const trades = await prisma.trade.findMany({ include: { strategy: true }, orderBy: { openDate: 'desc' } });

    const byStrategy = Object.values(
      trades.reduce<Record<string, { strategy: string; trades: number; pnl: number }>>((acc, trade) => {
        const key = trade.strategy?.name ?? 'Sin estrategia';
        if (!acc[key]) {
          acc[key] = { strategy: key, trades: 0, pnl: 0 };
        }
        acc[key].trades += 1;
        acc[key].pnl += (trade.pnl ?? 0) - trade.commission;
        return acc;
      }, {}),
    );

    return NextResponse.json({
      totalTrades: trades.length,
      byStrategy,
      trades,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo generar reporte' }, { status: 500 });
  }
}
