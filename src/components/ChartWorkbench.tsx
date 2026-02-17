'use client';

import { useMemo, useState } from 'react';

type Candle = { t: string; o: number; h: number; l: number; c: number; v: number };

const timeframes = ['1m', '5m', '15m', '1h', '1D'];

function makeCandles(seed = 100): Candle[] {
  const out: Candle[] = [];
  let prev = seed;
  for (let i = 0; i < 180; i += 1) {
    const drift = (Math.random() - 0.48) * 1.8;
    const open = prev;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) + Math.random() * 0.8;
    const low = Math.min(open, close) - Math.random() * 0.8;
    const vol = 1000 + Math.random() * 6000;
    out.push({ t: `${i}`, o: open, h: high, l: low, c: close, v: vol });
    prev = close;
  }
  return out;
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

export function ChartWorkbench({ symbol }: { symbol: string }) {
  const [timeframe, setTimeframe] = useState('5m');
  const [showEMA, setShowEMA] = useState(true);
  const [showVWAP, setShowVWAP] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [zoom, setZoom] = useState(70);
  const [trendline, setTrendline] = useState<Array<{ x: number; y: number }>>([]);

  const candles = useMemo(() => makeCandles(symbol.length * 13 + timeframe.length * 5), [symbol, timeframe]);
  const visible = candles.slice(-zoom);
  const closes = visible.map((c) => c.c);
  const ema20 = ema(closes, 20);

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

  const low = Math.min(...visible.map((c) => c.l));
  const high = Math.max(...visible.map((c) => c.h));
  const range = Math.max(1, high - low);

  const toX = (i: number) => (i / Math.max(1, visible.length - 1)) * 100;
  const toY = (price: number) => 100 - ((price - low) / range) * 100;

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
        </svg>
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
      <p className="mt-3 text-xs text-slate-500">Tip: haz click 2 veces sobre el gráfico para crear una trendline manual.</p>
    </section>
  );
}
