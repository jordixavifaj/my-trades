import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Candle = { t: string; o: number; h: number; l: number; c: number; v: number };

function toMinuteIso(date: Date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d.toISOString();
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.toUpperCase();
  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 });

  const [fills, trades] = await Promise.all([
    prisma.fill.findMany({ where: { symbol }, orderBy: { timestamp: 'asc' } }),
    prisma.trade.findMany({ where: { symbol, status: 'CLOSED' }, orderBy: { closeDate: 'asc' } }),
  ]);

  const candlesMap = new Map<string, Candle>();
  for (const fill of fills) {
    const key = toMinuteIso(fill.timestamp);
    const existing = candlesMap.get(key);
    if (!existing) {
      candlesMap.set(key, { t: key, o: fill.price, h: fill.price, l: fill.price, c: fill.price, v: fill.quantity });
      continue;
    }
    existing.h = Math.max(existing.h, fill.price);
    existing.l = Math.min(existing.l, fill.price);
    existing.c = fill.price;
    existing.v += fill.quantity;
  }

  const candles = Array.from(candlesMap.values()).sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
  const overlays = trades.map((trade) => ({
    id: trade.id,
    symbol: trade.symbol,
    side: trade.side === 'BUY' ? 'LONG' : 'SHORT',
    size: trade.quantity,
    entryPrice: trade.openPrice,
    exitPrice: trade.closePrice,
    entryTime: trade.openDate.toISOString(),
    exitTime: trade.closeDate?.toISOString() ?? trade.openDate.toISOString(),
    pnl: (trade.pnl ?? 0) - trade.commission,
  }));

  return NextResponse.json({ symbol, candles, overlays });
}
