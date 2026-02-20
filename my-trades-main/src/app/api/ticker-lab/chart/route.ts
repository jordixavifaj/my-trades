import { NextRequest, NextResponse } from 'next/server';

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

const INTERVAL_CONFIG: Record<string, { range: string; yahooInterval: string }> = {
  '1m':  { range: '1d',  yahooInterval: '1m' },
  '5m':  { range: '5d',  yahooInterval: '5m' },
  '15m': { range: '5d',  yahooInterval: '15m' },
  '1h':  { range: '1mo', yahooInterval: '1h' },
  '1d':  { range: '6mo', yahooInterval: '1d' },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const interval = searchParams.get('interval') ?? '5m';

  if (!symbol) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
  }

  const config = INTERVAL_CONFIG[interval];
  if (!config) {
    return NextResponse.json({ error: `Invalid interval: ${interval}. Valid: ${Object.keys(INTERVAL_CONFIG).join(', ')}` }, { status: 400 });
  }

  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?interval=${config.yahooInterval}&range=${config.range}&includePrePost=true&events=history`;

    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
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
      console.error('ticker-lab chart fetch failed', { status: res.status, url, body: text.slice(0, 500) });
      return NextResponse.json({ error: 'Yahoo Finance not reachable' }, { status: 502 });
    }

    const result = data?.chart?.result?.[0];
    const ts = result?.timestamp ?? [];
    const quote = result?.indicators?.quote?.[0];

    if (!quote || ts.length === 0) {
      return NextResponse.json({ candles: [], interval, symbol }, { status: 200 });
    }

    const candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> = [];

    for (let i = 0; i < ts.length; i++) {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      const volume = quote.volume?.[i];

      if (open == null || high == null || low == null || close == null) continue;

      candles.push({
        time: ts[i]!,
        open,
        high,
        low,
        close,
        volume: typeof volume === 'number' && Number.isFinite(volume) ? volume : 0,
      });
    }

    candles.sort((a, b) => a.time - b.time);

    return NextResponse.json({ candles, interval, symbol }, { status: 200 });
  } catch (err) {
    console.error('ticker-lab chart route failed', err);
    return NextResponse.json({ error: 'Chart data fetch failed' }, { status: 500 });
  }
}
