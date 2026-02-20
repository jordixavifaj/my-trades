import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface PolygonBar {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: number;
  vw?: number;
  n?: number;
}

interface PolygonResponse {
  results?: PolygonBar[];
  resultsCount?: number;
  status?: string;
  error?: string;
  next_url?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const ticker = searchParams.get('ticker');
    const date = searchParams.get('date');

    if (!ticker || !date) {
      return NextResponse.json({ error: 'ticker and date query params required' }, { status: 400 });
    }

    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'POLYGON_API_KEY not configured. Add it to your .env file.' },
        { status: 500 },
      );
    }

    const allBars: PolygonBar[] = [];
    let url: string | null =
      `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker.toUpperCase())}/range/1/minute/${date}/${date}?adjusted=true&sort=asc&limit=50000&apiKey=${apiKey}`;

    while (url) {
      const response = await fetch(url);
      if (!response.ok) {
        const text = await response.text();
        console.error('Polygon API error:', response.status, text);
        return NextResponse.json(
          { error: `Polygon API error: ${response.status}` },
          { status: 502 },
        );
      }

      const data: PolygonResponse = await response.json();

      if (data.results && data.results.length > 0) {
        allBars.push(...data.results);
      }

      if (data.next_url) {
        url = `${data.next_url}&apiKey=${apiKey}`;
      } else {
        url = null;
      }
    }

    if (allBars.length === 0) {
      return NextResponse.json(
        { error: `No candle data found for ${ticker} on ${date}` },
        { status: 404 },
      );
    }

    const candles = allBars.map((bar) => ({
      time: bar.t / 1000,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
    }));

    return NextResponse.json({ ticker, date, count: candles.length, candles });
  } catch (error) {
    console.error('Error fetching Polygon candles:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
