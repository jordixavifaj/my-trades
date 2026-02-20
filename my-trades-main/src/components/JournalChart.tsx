'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  createSeriesMarkers,
  CandlestickData,
  Time,
  IChartApi,
  LineStyle,
} from 'lightweight-charts';
import { fromZonedTime } from 'date-fns-tz';

export interface JournalCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface JournalTrade {
  id: string;
  ticker: string;
  date: string;
  direction: 'LONG' | 'SHORT';
  entry_time: string;
  entry_price: number;
  exit_time: string;
  exit_price: number;
  size: number;
  pnl: number;
  fills?: Array<{
    id: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    timestamp: string;
    commission: number;
  }>;
}

type ExecMarkerMeta = {
  time: number;
  minuteTime: number;
  price: number;
  kind: 'ENTRY' | 'EXIT';
  side: 'BUY' | 'SELL';
  trade: JournalTrade;
  quantity: number;
  avgEntryPrice: number;
  positionSigned: number;
  cumulativeSize: number;
  realizedPnl: number;
};

interface JournalChartProps {
  candles: JournalCandle[];
  trades: JournalTrade[];
  ticker: string;
  date: string;
}

export function JournalChart({ candles, trades, ticker, date }: JournalChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const markersRef = useRef<ExecMarkerMeta[]>([]);

  const [selected, setSelected] = useState<
    | null
    | {
        kind: 'ENTRY' | 'EXIT';
        side: 'BUY' | 'SELL';
        trade: JournalTrade;
        quantity: number;
        price: number;
        cumulativeSize: number;
        realizedPnl: number;
        floatingPnl: number | null;
        candleTime: number;
        px: number;
        py: number;
      }
  >(null);

  const buildChart = useCallback(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    setSelected(null);

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 600,
      layout: {
        background: { color: '#0a0e1a' },
        textColor: '#94a3b8',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#475569', width: 1, style: LineStyle.Dashed },
        horzLine: { color: '#475569', width: 1, style: LineStyle.Dashed },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#334155',
        rightOffset: 5,
        barSpacing: 6,
      },
      rightPriceScale: {
        borderColor: '#334155',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const volumeSeries = candles.length
      ? chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        })
      : null;

    if (volumeSeries) {
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
    }

    const candleData: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData = candles.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
    }));

    // Build expanded candle data covering the full day (04:00–16:00 NY).
    let finalCandleData: CandlestickData<Time>[] = candleData;

    if (candles.length) {
      const sessionStart = fromZonedTime(`${date}T04:00:00.000`, 'America/New_York');
      const sessionEnd = fromZonedTime(`${date}T16:00:00.000`, 'America/New_York');
      const startMinute = Math.floor(sessionStart.getTime() / 1000 / 60) * 60;
      const endMinute = Math.floor(sessionEnd.getTime() / 1000 / 60) * 60;

      const basePrice = (() => {
        const byTrade = trades
          .map((t) => ({ t, time: new Date(t.entry_time).getTime() }))
          .filter((x) => Number.isFinite(x.time) && Number.isFinite(x.t.entry_price) && x.t.entry_price > 0)
          .sort((a, b) => a.time - b.time)[0];
        return byTrade?.t.entry_price ?? (candleData[0]?.open ?? null);
      })();

      const byMinute = new Map<number, CandlestickData<Time>>();
      for (const c of candleData) {
        byMinute.set(Math.floor((c.time as number) / 60) * 60, c);
      }

      let lastClose: number | null = basePrice;
      const expanded: CandlestickData<Time>[] = [];
      for (let t = startMinute; t <= endMinute; t += 60) {
        const existing = byMinute.get(t);
        if (existing) {
          lastClose = existing.close;
          expanded.push({ ...existing, time: t as Time });
        } else if (lastClose !== null) {
          expanded.push({ time: t as Time, open: lastClose, high: lastClose, low: lastClose, close: lastClose });
        }
      }

      finalCandleData = expanded.length ? expanded : candleData;
      candleSeries.setData(finalCandleData);
      volumeSeries?.setData(volumeData);
    }

    // Build execution marker metadata from fills.
    const markerMeta: ExecMarkerMeta[] = [];

    for (const trade of trades) {
      const fills = Array.isArray(trade.fills) ? trade.fills : [];
      if (fills.length === 0) continue;

      const fillsSorted = fills
        .slice()
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const isEntrySide = (side: 'BUY' | 'SELL') => (trade.direction === 'LONG' ? side === 'BUY' : side === 'SELL');
      const isExitSide = (side: 'BUY' | 'SELL') => (trade.direction === 'LONG' ? side === 'SELL' : side === 'BUY');

      let pos = 0;
      let avgEntry = 0;
      let realized = 0;

      for (const f of fillsSorted) {
        const t = Math.floor(new Date(f.timestamp).getTime() / 1000);
        const minuteTime = Math.floor(t / 60) * 60;
        const kind: 'ENTRY' | 'EXIT' | null = isEntrySide(f.side) ? 'ENTRY' : isExitSide(f.side) ? 'EXIT' : null;
        if (!kind) continue;

        const price = f.price;
        const qty = f.quantity;

        if (kind === 'ENTRY') {
          const newAbs = Math.abs(pos) + qty;
          avgEntry = newAbs === 0 ? 0 : (avgEntry * Math.abs(pos) + price * qty) / newAbs;
          pos = trade.direction === 'LONG' ? pos + qty : pos - qty;
        } else {
          const closeQty = Math.min(Math.abs(pos), qty);
          const gross = trade.direction === 'LONG' ? (price - avgEntry) * closeQty : (avgEntry - price) * closeQty;
          realized += gross;
          pos = trade.direction === 'LONG' ? pos - closeQty : pos + closeQty;
        }

        markerMeta.push({
          time: t,
          minuteTime,
          price,
          kind,
          side: f.side,
          trade,
          quantity: qty,
          avgEntryPrice: avgEntry,
          positionSigned: pos,
          cumulativeSize: Math.abs(pos),
          realizedPnl: realized,
        });
      }
    }

    markersRef.current = markerMeta;

    // Native markers via createSeriesMarkers (v5 API).
    const buildNativeMarkers = () =>
      markerMeta
        .slice()
        .sort((a, b) => a.minuteTime - b.minuteTime)
        .map((m) => ({
          time: m.minuteTime as Time,
          position: 'atPriceMiddle' as const,
          price: m.price,
          color: m.side === 'BUY' ? '#39ff14' : '#991b1b',
          shape: (m.side === 'BUY' ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown',
          size: 0.5,
          text: '',
        }));

    if (markerMeta.length > 0) {
      createSeriesMarkers(candleSeries, buildNativeMarkers());
    }

    // Handle synthetic candles when no real candles are provided.
    if (!candles.length && markerMeta.length > 0) {
      const sorted = markerMeta.slice().sort((a, b) => a.time - b.time);
      const candleMap = new Map<number, { time: number; open: number; high: number; low: number; close: number }>();

      for (const m of sorted) {
        const minute = Math.floor(m.time / 60) * 60;
        const existing = candleMap.get(minute);
        if (!existing) {
          candleMap.set(minute, { time: minute, open: m.price, high: m.price, low: m.price, close: m.price });
        } else {
          existing.high = Math.max(existing.high, m.price);
          existing.low = Math.min(existing.low, m.price);
          existing.close = m.price;
        }
      }

      const synthetic = Array.from(candleMap.values())
        .sort((a, b) => a.time - b.time)
        .map((c) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close }));

      const sessionStart = fromZonedTime(`${date}T04:00:00.000`, 'America/New_York');
      const sessionEnd = fromZonedTime(`${date}T16:00:00.000`, 'America/New_York');
      const startMinute = Math.floor(sessionStart.getTime() / 1000 / 60) * 60;
      const endMinute = Math.floor(sessionEnd.getTime() / 1000 / 60) * 60;

      const byMinute = new Map<number, CandlestickData<Time>>();
      for (const c of synthetic) {
        byMinute.set(c.time as number, c);
      }

      const basePrice = (() => {
        const byTrade = trades
          .map((t) => ({ t, time: new Date(t.entry_time).getTime() }))
          .filter((x) => Number.isFinite(x.time) && Number.isFinite(x.t.entry_price) && x.t.entry_price > 0)
          .sort((a, b) => a.time - b.time)[0];
        return byTrade?.t.entry_price ?? synthetic[0]?.close ?? null;
      })();

      let lastClose: number | null = basePrice;
      const expanded: CandlestickData<Time>[] = [];

      for (let t = startMinute; t <= endMinute; t += 60) {
        const existing = byMinute.get(t);
        if (existing) {
          lastClose = existing.close;
          expanded.push(existing);
        } else if (lastClose !== null) {
          expanded.push({ time: t as Time, open: lastClose, high: lastClose, low: lastClose, close: lastClose });
        }
      }

      finalCandleData = expanded.length ? expanded : synthetic;
      candleSeries.setData(finalCandleData);

      if (markerMeta.length > 0) {
        createSeriesMarkers(candleSeries, buildNativeMarkers());
      }
    }

    // Click handler: match by candle minute time, pick closest by price.
    chart.subscribeClick((param) => {
      if (!param.time) { setSelected(null); return; }
      const clickedTime = param.time as number;
      const atMinute = markersRef.current.filter((m) => m.minuteTime === clickedTime);
      if (atMinute.length === 0) { setSelected(null); return; }
      let best = atMinute[0];
      if (param.point) {
        const priceAtClick = candleSeries.coordinateToPrice(param.point.y);
        if (priceAtClick !== null) {
          let bestDist = Math.abs(best.price - (priceAtClick as number));
          for (let i = 1; i < atMinute.length; i++) {
            const dist = Math.abs(atMinute[i].price - (priceAtClick as number));
            if (dist < bestDist) { bestDist = dist; best = atMinute[i]; }
          }
        }
      }
      const m = best;
      const candle = finalCandleData.find((c) => (c.time as number) === clickedTime);
      const close = candle ? candle.close : null;
      const floating =
        close === null || m.positionSigned === 0
          ? null
          : m.positionSigned > 0
            ? (close - m.avgEntryPrice) * Math.abs(m.positionSigned)
            : (m.avgEntryPrice - close) * Math.abs(m.positionSigned);
      setSelected({
        kind: m.kind, side: m.side, trade: m.trade, quantity: m.quantity, price: m.price,
        cumulativeSize: m.cumulativeSize, realizedPnl: m.realizedPnl,
        floatingPnl: floating, candleTime: m.time,
        px: param.point?.x ?? 0, py: param.point?.y ?? 0,
      });
    });

    chart.timeScale().fitContent();
  }, [candles, trades, date, ticker]);

  useEffect(() => {
    buildChart();

    const handleResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [buildChart]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            {ticker} <span className="text-sm font-normal text-slate-400">· 1min · {date}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {candles.length} velas · {trades.length} trades superpuestos
          </p>
        </div>
        {trades.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="inline-block h-0 w-0 border-b-[6px] border-l-[5px] border-r-[5px] border-l-transparent border-r-transparent" style={{ borderBottomColor: '#00ff00' }} /> Buy
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0 w-0 border-t-[6px] border-l-[5px] border-r-[5px] border-l-transparent border-r-transparent" style={{ borderTopColor: '#ff0000' }} /> Sell
            </span>
          </div>
        )}
      </div>
      <div
        className="relative w-full rounded-xl border border-slate-800 bg-[#0a0e1a]"
        style={{ minHeight: 600 }}
      >
        <div ref={containerRef} className="h-[600px] w-full" />

        {selected && (
          <div
            className="absolute z-50 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm"
            style={{
              left: Math.min(selected.px + 12, (containerRef.current?.clientWidth ?? 600) - 200),
              top: Math.max(selected.py - 60, 8),
              minWidth: 180,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="font-semibold" style={{ color: selected.side === 'BUY' ? '#39ff14' : '#cc0000' }}>
                {selected.side} · {selected.kind}
              </span>
              <button className="text-slate-500 hover:text-slate-300" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="space-y-0.5 text-slate-300">
              <p>Size: <span className="text-slate-100 font-medium">{Math.round(selected.quantity)} sh</span></p>
              <p>Price: <span className="text-slate-100 font-medium">${selected.price.toFixed(4)}</span></p>
              <p>Acum: <span className="text-slate-100 font-medium">{Math.round(selected.cumulativeSize)} sh</span></p>
              <p>PnL: <span className={selected.realizedPnl >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                {selected.realizedPnl >= 0 ? '+' : ''}{selected.realizedPnl.toFixed(2)}
              </span></p>
              {selected.floatingPnl !== null && (
                <p>Floating: <span className={selected.floatingPnl >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                  {selected.floatingPnl >= 0 ? '+' : ''}{selected.floatingPnl.toFixed(2)}
                </span></p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
