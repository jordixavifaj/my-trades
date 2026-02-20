import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function backendBase() {
  return process.env.TICKER_LAB_BACKEND_URL ?? 'http://127.0.0.1:8001';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 });

  const url = `${backendBase()}/ticker/news?symbol=${encodeURIComponent(symbol)}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    console.error('ticker-lab proxy error (news)', { url, err });
    return NextResponse.json(
      { error: 'Ticker Lab backend is not reachable', url },
      { status: 502 },
    );
  }
}
