import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function backendBase() {
  return process.env.TICKER_LAB_BACKEND_URL ?? 'http://127.0.0.1:8001';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const date = searchParams.get('date');

  if (!symbol || !date) {
    return NextResponse.json({ error: 'symbol and date are required' }, { status: 400 });
  }

  const url = `${backendBase()}/ticker/intraday?symbol=${encodeURIComponent(symbol)}&date=${encodeURIComponent(date)}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    console.error('ticker-lab proxy error (intraday)', { url, err });
    return NextResponse.json(
      { error: 'Ticker Lab backend is not reachable', url },
      { status: 502 },
    );
  }
}
