import { NextRequest, NextResponse } from 'next/server';
import { fromZonedTime } from 'date-fns-tz';

export const runtime = 'nodejs';

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: any;
  };
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const date = searchParams.get('date');

  if (!symbol || !date) {
    return NextResponse.json({ error: 'symbol and date are required' }, { status: 400 });
  }

  try {
    // Build NY session window for the requested day.
    const sessionStart = fromZonedTime(`${date}T04:00:00.000`, 'America/New_York');
    const sessionEnd = fromZonedTime(`${date}T16:00:00.000`, 'America/New_York');

    // Yahoo expects unix seconds.
    const period1 = Math.floor(sessionStart.getTime() / 1000);
    const period2 = Math.floor(sessionEnd.getTime() / 1000);

    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?interval=1m&includePrePost=true&events=history` +
      `&period1=${period1}&period2=${period2}`;

    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        // Some environments require a user-agent for Yahoo.
        'user-agent': 'Mozilla/5.0 (compatible; MyTrades/1.0)',
        accept: 'application/json,text/plain,*/*',
      },
    });

    const text = await res.text();
    let data: YahooChartResponse | null = null;
    try {
      data = JSON.parse(text) as YahooChartResponse;
    } catch {
      data = null;
    }

    if (!res.ok) {
      console.error('yahoo intraday fetch failed', { status: res.status, url, body: text.slice(0, 500) });
      return NextResponse.json({ error: 'Yahoo Finance not reachable' }, { status: 502 });
    }

    const result = data?.chart?.result?.[0];
    const ts = result?.timestamp ?? [];
    const quote = result?.indicators?.quote?.[0];

    if (!quote || ts.length === 0) {
      return NextResponse.json({ candles: [] }, { status: 200 });
    }

    const candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> = [];

    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      if (!t) continue;
      if (t < period1 || t > period2) continue;

      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      const volume = quote.volume?.[i];

      if (
        open === null ||
        high === null ||
        low === null ||
        close === null ||
        open === undefined ||
        high === undefined ||
        low === undefined ||
        close === undefined
      ) {
        continue;
      }

      candles.push({
        time: t,
        open,
        high,
        low,
        close,
        volume: typeof volume === 'number' && Number.isFinite(volume) ? volume : 0,
      });
    }

    candles.sort((a, b) => a.time - b.time);

    // Expand to full premarket+RTH window at 1-minute resolution.
    if (candles.length > 0) {
      const startMinute = Math.floor(period1 / 60) * 60;
      const endMinute = Math.floor(period2 / 60) * 60;

      const byMinute = new Map<number, (typeof candles)[number]>();
      for (const c of candles) {
        byMinute.set(Math.floor(c.time / 60) * 60, c);
      }

      let lastClose = candles[0].close;
      const expanded: typeof candles = [];
      for (let t = startMinute; t <= endMinute; t += 60) {
        const existing = byMinute.get(t);
        if (existing) {
          lastClose = existing.close;
          expanded.push({ ...existing, time: t });
        } else {
          expanded.push({ time: t, open: lastClose, high: lastClose, low: lastClose, close: lastClose, volume: 0 });
        }
      }

      return NextResponse.json({ candles: expanded }, { status: 200 });
    }

    return NextResponse.json({ candles: [] }, { status: 200 });
  } catch (err) {
    console.error('yahoo intraday route failed', err);
    return NextResponse.json({ error: 'Yahoo intraday failed' }, { status: 500 });
  }
}
