import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMarketData } from '@/lib/market-data';

type Candle = { t: string; o: number; h: number; l: number; c: number; v: number };

type Timeframe = '1m' | '5m' | '15m' | '1h' | '1d';

function roundToTimeframe(date: Date, timeframe: Timeframe): Date {
  const d = new Date(date);
  switch (timeframe) {
    case '1m':
      d.setSeconds(0, 0);
      break;
    case '5m':
      d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
      break;
    case '15m':
      d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0);
      break;
    case '1h':
      d.setMinutes(0, 0, 0);
      break;
    case '1d':
      d.setHours(0, 0, 0, 0);
      break;
  }
  return d;
}

function toTimeframeIso(date: Date, timeframe: Timeframe): string {
  return roundToTimeframe(date, timeframe).toISOString();
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.toUpperCase();
  const timeframe = (request.nextUrl.searchParams.get('timeframe') ?? '1m') as Timeframe;
  const useMarketData = request.nextUrl.searchParams.get('marketData') === 'true';
  
  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
  if (!['1m', '5m', '15m', '1h', '1d'].includes(timeframe)) {
    return NextResponse.json({ error: 'invalid timeframe' }, { status: 400 });
  }

  let candles: Candle[] = [];
  let overlays: any[] = [];

  if (useMarketData) {
    // Get market data from TradingView-like API
    try {
      const marketCandles = await getMarketData(symbol, timeframe, 7);
      candles = marketCandles.map(c => ({
        t: c.time,
        o: c.open,
        h: c.high,
        l: c.low,
        c: c.close,
        v: c.volume
      }));
    } catch (error) {
      console.error('Error getting market data:', error);
      // Fallback to user data
    }
  }

  // Always get user trades for overlays
  const today = new Date();
  const daysBack = 7;
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysBack);
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const [fills, trades] = await Promise.all([
    prisma.fill.findMany({ 
      where: { 
        symbol,
        timestamp: {
          gte: startDate,
          lt: endDate
        }
      }, 
      orderBy: { timestamp: 'asc' } 
    }),
    prisma.trade.findMany({ 
      where: { 
        symbol, 
        status: 'CLOSED',
        openDate: {
          gte: startDate,
          lt: endDate
        }
      }, 
      orderBy: { closeDate: 'asc' } 
    }),
  ]);

  // If no market data, use user fills to generate candles
  if (candles.length === 0) {
    const candlesMap = new Map<string, Candle>();
    for (const fill of fills) {
      const key = toTimeframeIso(fill.timestamp, timeframe);
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
    candles = Array.from(candlesMap.values()).sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
  }

  overlays = trades.map((trade) => ({
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

  return NextResponse.json({ 
    symbol, 
    timeframe, 
    candles, 
    overlays,
    dataSource: useMarketData ? 'market' : 'user',
    candleCount: candles.length 
  });
}
