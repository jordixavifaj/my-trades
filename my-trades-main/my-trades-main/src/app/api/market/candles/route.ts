import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '@/lib/request-auth';

const TIMEFRAME_MAP: Record<string, { multiplier: number; timespan: 'minute' | 'hour' | 'day' }> = {
  '1m': { multiplier: 1, timespan: 'minute' },
  '5m': { multiplier: 5, timespan: 'minute' },
  '15m': { multiplier: 15, timespan: 'minute' },
  '1h': { multiplier: 1, timespan: 'hour' },
  '1D': { multiplier: 1, timespan: 'day' },
};

async function fetchPolygonCandles(args: {
  apiKey: string;
  symbol: string;
  multiplier: number;
  timespan: 'minute' | 'hour' | 'day';
  rangeFrom: string;
  rangeTo: string;
}) {
  const url = new URL(
    `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(args.symbol)}/range/${args.multiplier}/${args.timespan}/${args.rangeFrom}/${args.rangeTo}`,
  );
  url.searchParams.set('adjusted', 'true');
  url.searchParams.set('sort', 'asc');
  url.searchParams.set('limit', '50000');
  url.searchParams.set('apiKey', args.apiKey);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  const payload = await res.json().catch(() => null);
  return { res, payload };
}

export async function GET(request: NextRequest) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'POLYGON_API_KEY no está configurada en el servidor.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') ?? '').trim().toUpperCase();
  const timeframe = (searchParams.get('timeframe') ?? '5m').trim();
  const day = (searchParams.get('day') ?? '').trim();
  const from = (searchParams.get('from') ?? '').trim();
  const to = (searchParams.get('to') ?? '').trim();

  if (!symbol) {
    return NextResponse.json({ error: 'symbol es obligatorio' }, { status: 400 });
  }

  const tf = TIMEFRAME_MAP[timeframe];
  if (!tf) {
    return NextResponse.json({ error: 'timeframe inválido' }, { status: 400 });
  }

  const rangeFrom = day || from;
  const rangeTo = day || to;

  if (!rangeFrom || !rangeTo) {
    return NextResponse.json({ error: 'Debes enviar day=YYYY-MM-DD o from/to' }, { status: 400 });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(rangeFrom) || !dateRegex.test(rangeTo)) {
    return NextResponse.json({ error: 'day/from/to deben tener formato YYYY-MM-DD' }, { status: 400 });
  }

  try {
    const { res, payload } = await fetchPolygonCandles({
      apiKey,
      symbol,
      multiplier: tf.multiplier,
      timespan: tf.timespan,
      rangeFrom,
      rangeTo,
    });

    let effectiveTimeframe = timeframe;
    let effectivePayload = payload;
    let warning: string | undefined;

    if (!res.ok) {
      const message = String(payload?.error || payload?.message || `Polygon error ${res.status}`);

      const shouldFallbackToDaily =
        tf.timespan !== 'day' &&
        /timeframe/i.test(message) &&
        /plan|upgrade|pricing|include/i.test(message);

      if (shouldFallbackToDaily) {
        const fallbackTf = TIMEFRAME_MAP['1D'];
        const fallback = await fetchPolygonCandles({
          apiKey,
          symbol,
          multiplier: fallbackTf.multiplier,
          timespan: fallbackTf.timespan,
          rangeFrom,
          rangeTo,
        });

        if (!fallback.res.ok) {
          const fallbackMessage = String(
            fallback.payload?.error || fallback.payload?.message || `Polygon error ${fallback.res.status}`,
          );
          return NextResponse.json({ error: fallbackMessage }, { status: 502 });
        }

        effectiveTimeframe = '1D';
        effectivePayload = fallback.payload;
        warning = `El plan de Polygon no permite ${timeframe}. Mostrando velas 1D (EOD).`;
      } else {
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    const results = Array.isArray(effectivePayload?.results) ? effectivePayload.results : [];
    const candles = results.map((r: any) => ({
      t: typeof r.t === 'number' ? r.t : 0,
      o: Number(r.o),
      h: Number(r.h),
      l: Number(r.l),
      c: Number(r.c),
      v: Number(r.v),
    }));

    return NextResponse.json({ symbol, timeframe: effectiveTimeframe, candles, warning });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error consultando Polygon' }, { status: 502 });
  }
}
