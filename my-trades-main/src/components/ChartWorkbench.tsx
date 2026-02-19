'use client';

import { useEffect, useState } from 'react';
import { SimpleCandlestickChart } from './SimpleCandlestickChart';

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

type Timeframe = '1m' | '5m' | '15m' | '1h' | '1d';

export function ChartWorkbench({ initialSymbol }: { initialSymbol?: string }) {
  const [symbol, setSymbol] = useState(initialSymbol || 'AAPL');
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [showVolume, setShowVolume] = useState(false);
  const [useMarketData, setUseMarketData] = useState(false);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return; // Don't fetch if symbol is empty
    
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/chart?symbol=${encodeURIComponent(symbol.toUpperCase())}&timeframe=${timeframe}&marketData=${useMarketData}`)
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
  }, [symbol, timeframe]);

  const visible = candles;
  const low = visible.length ? Math.min(...visible.map((c) => c.l)) : 0;
  const high = visible.length ? Math.max(...visible.map((c) => c.h)) : 1;
  const range = Math.max(1, high - low);

  // Calculate volume scale
  const maxVolume = visible.length ? Math.max(...visible.map((c) => c.v)) : 1;
  const volumeHeight = showVolume ? 20 : 0; // 20% of chart height for volume

  const toX = (ts: string) => {
    if (!visible.length) return 0;
    const first = new Date(visible[0].t).getTime();
    const last = new Date(visible[visible.length - 1].t).getTime();
    const current = new Date(ts).getTime();
    if (last <= first) return 0;
    return ((current - first) / (last - first)) * 100;
  };
  const toY = (price: number) => {
  const chartHeight = 100 - volumeHeight;
  return chartHeight - ((price - low) / range) * chartHeight;
};

const toVolumeY = (volume: number) => {
  return 100 - (volume / maxVolume) * volumeHeight;
};

  const markers = overlays.flatMap((trade) => [
    { key: `${trade.id}-entry`, x: toX(trade.entryTime), y: toY(trade.entryPrice), color: '#22c55e', label: `🟢 ${trade.side} size ${trade.size} @ ${trade.entryPrice.toFixed(2)}` },
    { key: `${trade.id}-exit`, x: toX(trade.exitTime), y: toY(trade.exitPrice ?? trade.entryPrice), color: '#ef4444', label: `🔴 Exit ${trade.exitPrice?.toFixed(2) ?? '-'} PnL ${trade.pnl.toFixed(2)}` },
  ]);


  if (loading) return <section className="panel p-5">Cargando gráfico {timeframe}...</section>;
  if (error) return <section className="panel p-5 text-rose-300">{error}</section>;

  return (
    <section className="panel p-5">
      <div className="mb-4 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Enter symbol (e.g., AAPL)"
            className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200"
          />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={useMarketData}
              onChange={(e) => setUseMarketData(e.target.checked)}
              className="rounded border-slate-600"
            />
            Datos del Mercado (TradingView)
          </label>
        </div>
      </div>
      <SimpleCandlestickChart
        symbol={symbol}
        timeframe={timeframe}
        candles={candles}
        overlays={overlays}
        showVolume={showVolume}
        onTimeframeChange={(value: string) => setTimeframe(value as Timeframe)}
        onVolumeToggle={() => setShowVolume(!showVolume)}
      />
    </section>
  );
}
