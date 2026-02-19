'use client';

import { useEffect, useState } from 'react';

type Candle = { t: string; o: number; h: number; l: number; c: number; v: number };
type Overlay = {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  exitPrice: number | null;
  entryTime: string;
  exitTime: string;
  pnl: number;
};

export function ChartWorkbench({ symbol }: { symbol: string }) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/chart?symbol=${encodeURIComponent(symbol.toUpperCase())}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudieron cargar datos del ticker');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setCandles(data.candles ?? []);
        setOverlays(data.overlays ?? []);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const visible = candles;
  const low = visible.length ? Math.min(...visible.map((c) => c.l)) : 0;
  const high = visible.length ? Math.max(...visible.map((c) => c.h)) : 1;
  const range = Math.max(1, high - low);

  const toX = (ts: string) => {
    if (!visible.length) return 0;
    const first = new Date(visible[0].t).getTime();
    const last = new Date(visible[visible.length - 1].t).getTime();
    const current = new Date(ts).getTime();
    if (last <= first) return 0;
    return ((current - first) / (last - first)) * 100;
  };
  const toY = (price: number) => 100 - ((price - low) / range) * 100;

  const markers = overlays.flatMap((trade) => [
    { key: `${trade.id}-entry`, x: toX(trade.entryTime), y: toY(trade.entryPrice), color: '#22c55e', label: `🟢 ${trade.side} size ${trade.size} @ ${trade.entryPrice.toFixed(2)}` },
    { key: `${trade.id}-exit`, x: toX(trade.exitTime), y: toY(trade.exitPrice ?? trade.entryPrice), color: '#ef4444', label: `🔴 Exit ${trade.exitPrice?.toFixed(2) ?? '-'} PnL ${trade.pnl.toFixed(2)}` },
  ]);


  if (loading) return <section className="panel p-5">Cargando gráfico 1m...</section>;
  if (error) return <section className="panel p-5 text-rose-300">{error}</section>;
  if (!candles.length) return <section className="panel p-5">No hay ejecuciones para {symbol.toUpperCase()}.</section>;

  return (
    <section className="panel p-5">
      <h2 className="text-xl font-semibold tracking-tight">{symbol.toUpperCase()} · 1m</h2>
      <p className="mb-4 text-sm text-slate-400">Entradas y salidas derivadas del XLS procesado.</p>

      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <svg viewBox="0 0 100 100" className="h-[380px] w-full">
          {visible.map((candle, i) => {
            const x = (i / Math.max(1, visible.length - 1)) * 100;
            const wickTop = toY(candle.h);
            const wickBottom = toY(candle.l);
            const openY = toY(candle.o);
            const closeY = toY(candle.c);
            const up = candle.c >= candle.o;
            return (
              <g key={candle.t}>
                <line x1={x} x2={x} y1={wickTop} y2={wickBottom} stroke={up ? '#34d399' : '#fb7185'} strokeWidth="0.35" />
                <rect x={x - 0.28} y={Math.min(openY, closeY)} width={0.56} height={Math.max(0.7, Math.abs(closeY - openY))} fill={up ? '#34d399' : '#fb7185'} />
              </g>
            );
          })}

          {markers.map((marker) => (
            <g key={marker.key}>
              <circle cx={marker.x} cy={marker.y} r={0.8} fill={marker.color}>
                <title>{marker.label}</title>
              </circle>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
