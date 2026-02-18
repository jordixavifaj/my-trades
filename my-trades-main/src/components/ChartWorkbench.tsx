'use client';

import { useEffect, useMemo, useState } from 'react';

type Candle = { t: string; o: number; h: number; l: number; c: number; v: number };

type MarketCandle = { t: number; o: number; h: number; l: number; c: number; v: number };

type ChartTrade = {
  id: string;
  symbol: string;
  status: 'OPEN' | 'CLOSED';
  side: 'BUY' | 'SELL';
  quantity: number;
  openDate: string;
  closeDate: string | null;
  openPrice: number;
  closePrice: number | null;
  pnl: number | null;
  commission: number;
  fills?: Array<{ id: string; price: number; quantity: number; side: 'BUY' | 'SELL'; timestamp: string; commission: number }>;
};

const timeframes = ['1m', '5m', '15m', '1h', '1D'] as const;
type Timeframe = (typeof timeframes)[number];

function toISODateUTC(dt: Date) {
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())).toISOString().slice(0, 10);
}

function ema(values: number[], period: number) {
  const k = 2 / (period + 1);
  const result: number[] = [];
  values.forEach((price, i) => {
    if (i === 0) result.push(price);
    else result.push(price * k + result[i - 1] * (1 - k));
  });
  return result;
}

export function ChartWorkbench({ symbol, day }: { symbol: string; day?: string }) {
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const [effectiveTimeframe, setEffectiveTimeframe] = useState<string>('');
  const [showEMA, setShowEMA] = useState(true);
  const [showVWAP, setShowVWAP] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [zoom, setZoom] = useState(70);
  const [trendline, setTrendline] = useState<Array<{ x: number; y: number }>>([]);
  const [trades, setTrades] = useState<ChartTrade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [tradesError, setTradesError] = useState<string | null>(null);
  const [fillTooltip, setFillTooltip] = useState<
    | null
    | {
        x: number;
        y: number;
        symbol: string;
        side: 'BUY' | 'SELL';
        quantity: number;
        price: number;
        timestamp: string;
        positionAfter: number;
        avgPriceAfter: number;
        realizedPnl: number;
        unrealizedPnl: number;
        netPnl: number;
      }
  >(null);

  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [loadingCandles, setLoadingCandles] = useState(false);
  const [candlesError, setCandlesError] = useState<string | null>(null);
  const [candlesWarning, setCandlesWarning] = useState<string | null>(null);

  const visible = candles.slice(-zoom);
  const closes = visible.map((c) => c.c);
  const ema20 = ema(closes, 20);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoadingTrades(true);
      setTradesError(null);
      try {
        const qs = new URLSearchParams({ symbol });
        if (day) qs.set('day', day);
        const res = await fetch(`/api/chart?${qs.toString()}`, { signal: controller.signal });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error || `Error ${res.status}`);
        }
        const payload = (await res.json()) as { items: ChartTrade[] };
        if (!cancelled) setTrades(payload.items ?? []);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setTradesError(e instanceof Error ? e.message : 'Error cargando operaciones');
        setTrades([]);
      } finally {
        if (!cancelled) setLoadingTrades(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [symbol, day]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadCandles() {
      setLoadingCandles(true);
      setCandlesError(null);
      setCandlesWarning(null);
      try {
        let from = '';
        let to = '';

        if (day) {
          from = day;
          to = day;
        } else if (trades.length > 0) {
          const starts = trades.map((t) => new Date(t.openDate));
          const ends = trades.map((t) => new Date(t.closeDate ?? t.openDate));
          const start = new Date(Math.min(...starts.map((d) => d.getTime())));
          const end = new Date(Math.max(...ends.map((d) => d.getTime())));
          from = toISODateUTC(start);
          to = toISODateUTC(end);
        } else {
          setCandles([]);
          return;
        }

        const qs = new URLSearchParams({ symbol, timeframe, from, to });
        const res = await fetch(`/api/market/candles?${qs.toString()}`, { signal: controller.signal });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error || `Error ${res.status}`);
        }
        const payload = (await res.json()) as { candles: MarketCandle[]; timeframe?: string; warning?: string };
        if (!cancelled) {
          setCandles(payload.candles ?? []);
          setEffectiveTimeframe(payload.timeframe ?? '');
          if (payload.warning) setCandlesWarning(payload.warning);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setCandlesError(e instanceof Error ? e.message : 'Error cargando velas');
        setCandles([]);
        setEffectiveTimeframe('');
      } finally {
        if (!cancelled) setLoadingCandles(false);
      }
    }

    void loadCandles();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [symbol, day, timeframe, trades.length]);

  const vwap = useMemo(() => {
    let cumPV = 0;
    let cumV = 0;
    return visible.map((c) => {
      const tp = (c.h + c.l + c.c) / 3;
      cumPV += tp * c.v;
      cumV += c.v;
      return cumPV / cumV;
    });
  }, [visible]);

  const low = visible.length ? Math.min(...visible.map((c) => c.l)) : 0;
  const high = visible.length ? Math.max(...visible.map((c) => c.h)) : 1;
  const range = Math.max(1, high - low);

  const toX = (i: number) => (i / Math.max(1, visible.length - 1)) * 100;
  const toY = (price: number) => 100 - ((price - low) / range) * 100;

  const fills = useMemo(() => {
    const all = trades.flatMap((t) => (t.fills ?? []).map((f) => ({ ...f, tradeId: t.id, symbol: t.symbol })));
    all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return all;
  }, [trades]);

  const fillMetrics = useMemo(() => {
    // Simple position/PnL tracker by symbol (single symbol view)
    let position = 0;
    let avgPrice = 0;
    let realized = 0;

    return fills.map((f) => {
      const qty = f.side === 'BUY' ? f.quantity : -f.quantity;
      const prevPos = position;

      // If increasing position in same direction
      if (prevPos === 0 || Math.sign(prevPos) === Math.sign(qty)) {
        const newPos = prevPos + qty;
        const totalCost = avgPrice * Math.abs(prevPos) + f.price * Math.abs(qty);
        position = newPos;
        avgPrice = Math.abs(newPos) > 0 ? totalCost / Math.abs(newPos) : 0;
      } else {
        // Reducing or flipping position
        const closingQty = Math.min(Math.abs(prevPos), Math.abs(qty));
        const direction = prevPos > 0 ? 1 : -1; // +1 long, -1 short
        const closePnl = direction * (f.price - avgPrice) * closingQty;
        realized += closePnl;
        const newPos = prevPos + qty;
        position = newPos;

        if (newPos === 0) {
          avgPrice = 0;
        } else if (Math.sign(newPos) !== Math.sign(prevPos)) {
          // flipped: remaining qty opens new position at fill price
          avgPrice = f.price;
        }
      }

      return {
        ...f,
        positionAfter: position,
        avgPriceAfter: avgPrice,
        realizedPnl: realized,
      };
    });
  }, [fills]);

  const closeAt = useMemo(() => {
    if (visible.length === 0) return null;

    const ts = visible.map((c) => c.t);
    const closesLocal = visible.map((c) => c.c);

    return (t: number): number | null => {
      if (ts.length === 0) return null;
      if (t <= ts[0]) return closesLocal[0];
      if (t >= ts[ts.length - 1]) return closesLocal[closesLocal.length - 1];

      let lo = 0;
      let hi = ts.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const v = ts[mid];
        if (v === t) return closesLocal[mid];
        if (v < t) lo = mid + 1;
        else hi = mid - 1;
      }

      // hi is now the last index where ts[hi] < t
      return closesLocal[Math.max(0, hi)];
    };
  }, [visible]);

  const fillMarkers = useMemo(() => {
    if (visible.length === 0 || fillMetrics.length === 0) return [];

    const startT = visible[0].t;
    const endT = visible[visible.length - 1].t;
    const span = Math.max(1, endT - startT);

    return fillMetrics
      .filter((f) => {
        const t = new Date(f.timestamp).getTime();
        return t >= startT && t <= endT;
      })
      .map((f, idx) => {
        const t = new Date(f.timestamp).getTime();
        const candleClose = closeAt ? closeAt(t) : null;
        const unrealizedPnl = candleClose === null ? 0 : (candleClose - f.avgPriceAfter) * f.positionAfter;
        const netPnl = f.realizedPnl + unrealizedPnl;
        const x = ((t - startT) / span) * 100;
        const y = toY(f.price);
        return {
          key: `${f.tradeId}-${idx}`,
          x,
          y,
          color: f.side === 'BUY' ? '#34d399' : '#fb7185',
          label: f.side === 'BUY' ? 'B' : 'S',
          tooltip: {
            symbol,
            side: f.side,
            quantity: f.quantity,
            price: f.price,
            timestamp: f.timestamp,
            positionAfter: f.positionAfter,
            avgPriceAfter: f.avgPriceAfter,
            realizedPnl: f.realizedPnl,
            unrealizedPnl,
            netPnl,
          },
        };
      });
  }, [closeAt, fillMetrics, symbol, visible, toY]);

  const rsi = useMemo(() => {
    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = 1; i < closes.length; i += 1) {
      const diff = closes[i] - closes[i - 1];
      gains.push(Math.max(0, diff));
      losses.push(Math.max(0, -diff));
    }
    const avgGain = gains.reduce((a, b) => a + b, 0) / Math.max(1, gains.length);
    const avgLoss = losses.reduce((a, b) => a + b, 0) / Math.max(1, losses.length);
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }, [closes]);

  const clickChart = (evt: React.MouseEvent<SVGSVGElement>) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * 100;
    const y = ((evt.clientY - rect.top) / rect.height) * 100;
    setTrendline((prev) => (prev.length < 2 ? [...prev, { x, y }] : [{ x, y }]));
  };

  return (
    <section className="panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{symbol.toUpperCase()} · Chart</h2>
          <p className="text-sm text-slate-400">Velas estilo TradingView con herramientas de análisis.</p>
          {day && <p className="mt-1 text-xs text-slate-500">Filtro día: {day}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {timeframes.map((tf) => (
            <button
              key={tf}
              className={`rounded-lg border px-3 py-1 text-xs ${timeframe === tf ? 'border-cyan-400 bg-cyan-400/10 text-cyan-200' : 'border-slate-700 text-slate-300'}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-300">
        <label><input type="checkbox" checked={showEMA} onChange={(e) => setShowEMA(e.target.checked)} className="mr-1" />EMA(20)</label>
        <label><input type="checkbox" checked={showVWAP} onChange={(e) => setShowVWAP(e.target.checked)} className="mr-1" />VWAP</label>
        <label><input type="checkbox" checked={showRSI} onChange={(e) => setShowRSI(e.target.checked)} className="mr-1" />RSI</label>
        <label className="ml-auto flex items-center gap-2">Zoom
          <input type="range" min={40} max={180} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-slate-400">Velas</p>
          {loadingCandles && <p className="text-xs text-slate-400">Cargando velas…</p>}
        </div>
        {candlesError && <p className="mb-2 text-sm text-rose-300">{candlesError}</p>}
        {candlesWarning && <p className="mb-2 text-sm text-amber-200">{candlesWarning}</p>}
        {!candlesError && effectiveTimeframe && effectiveTimeframe !== timeframe && (
          <p className="mb-2 text-xs text-slate-400">Timeframe efectivo: {effectiveTimeframe}</p>
        )}
        {visible.length === 0 ? (
          <p className="text-sm text-slate-400">No hay velas disponibles para este rango.</p>
        ) : (
          <div className="relative">
            <svg viewBox="0 0 100 100" className="h-[360px] w-full" onClick={clickChart}>
            {visible.map((candle, i) => {
              const x = toX(i);
              const wickTop = toY(candle.h);
              const wickBottom = toY(candle.l);
              const openY = toY(candle.o);
              const closeY = toY(candle.c);
              const up = candle.c >= candle.o;
              return (
                <g key={candle.t}>
                  <line x1={x} x2={x} y1={wickTop} y2={wickBottom} stroke={up ? '#34d399' : '#fb7185'} strokeWidth="0.35" />
                  <rect x={x - 0.25} y={Math.min(openY, closeY)} width={0.5} height={Math.max(0.7, Math.abs(closeY - openY))} fill={up ? '#34d399' : '#fb7185'} />
                </g>
              );
            })}

            {showEMA && <polyline fill="none" stroke="#38bdf8" strokeWidth="0.45" points={ema20.map((v, i) => `${toX(i)},${toY(v)}`).join(' ')} />}
            {showVWAP && <polyline fill="none" stroke="#f59e0b" strokeWidth="0.45" points={vwap.map((v, i) => `${toX(i)},${toY(v)}`).join(' ')} />}
            {trendline.length === 2 && <line x1={trendline[0].x} y1={trendline[0].y} x2={trendline[1].x} y2={trendline[1].y} stroke="#a78bfa" strokeWidth="0.5" />}

            {fillMarkers.map((m) => (
              <g key={m.key}>
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={1.1}
                  fill={m.color}
                  onMouseEnter={(evt) => {
                    setFillTooltip({
                      x: evt.clientX,
                      y: evt.clientY,
                      ...m.tooltip,
                    });
                  }}
                  onMouseMove={(evt) => {
                    setFillTooltip((prev) => (prev ? { ...prev, x: evt.clientX, y: evt.clientY } : prev));
                  }}
                  onMouseLeave={() => setFillTooltip(null)}
                />
                <text x={m.x + 1.2} y={m.y + 0.9} fontSize="2.4" fill="#e2e8f0">
                  {m.label}
                </text>
              </g>
            ))}
            </svg>

            {fillTooltip && (
              <div
                className="pointer-events-none fixed z-50 w-72 rounded-xl border border-slate-700 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-xl"
                style={{ left: fillTooltip.x + 12, top: fillTooltip.y + 12 }}
              >
                <p className="text-sm font-semibold">{fillTooltip.symbol.toUpperCase()} · {fillTooltip.side}</p>
                <p className="mt-1 text-slate-400">{new Date(fillTooltip.timestamp).toLocaleString('es-ES')}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-slate-400">Fill</p>
                    <p>{fillTooltip.quantity} @ {fillTooltip.price}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Posición</p>
                    <p>{fillTooltip.positionAfter}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Avg</p>
                    <p>{Number.isFinite(fillTooltip.avgPriceAfter) ? fillTooltip.avgPriceAfter.toFixed(4) : '0'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">PnL (realizado)</p>
                    <p className={fillTooltip.realizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{fillTooltip.realizedPnl.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">PnL (flotante)</p>
                    <p className={fillTooltip.unrealizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{fillTooltip.unrealizedPnl.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">PnL (total)</p>
                    <p className={fillTooltip.netPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{fillTooltip.netPnl.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showRSI && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-center justify-between text-xs">
            <span>RSI(14)</span>
            <span className={`${rsi >= 70 ? 'text-rose-300' : rsi <= 30 ? 'text-emerald-300' : 'text-slate-300'}`}>{rsi.toFixed(2)}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-800">
            <div className="h-2 rounded-full bg-violet-400" style={{ width: `${Math.min(100, Math.max(0, rsi))}%` }} />
          </div>
        </div>
      )}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-200">Operaciones</p>
          {loadingTrades && <p className="text-xs text-slate-400">Cargando…</p>}
        </div>
        {tradesError && <p className="mt-2 text-sm text-rose-300">{tradesError}</p>}
        {!loadingTrades && !tradesError && trades.length === 0 && <p className="mt-2 text-sm text-slate-400">No hay operaciones para este símbolo{day ? ' en ese día' : ''}.</p>}
        <div className="mt-3 space-y-2">
          {fillMetrics.slice(0, 60).map((f, idx) => (
            <div key={`${f.tradeId}-${idx}`} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-sm">
              <div>
                <p className="font-medium">
                  {f.side} · {f.quantity} @ {f.price}
                </p>
                <p className="text-xs text-slate-400">{new Date(f.timestamp).toLocaleString('es-ES')}</p>
                <p className="text-xs text-slate-400">Posición: {f.positionAfter} · Avg: {Number.isFinite(f.avgPriceAfter) ? f.avgPriceAfter.toFixed(4) : '0'}</p>
              </div>
              <p className={f.realizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{f.realizedPnl.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Tip: haz click 2 veces sobre el gráfico para crear una trendline manual.</p>
    </section>
  );
}
