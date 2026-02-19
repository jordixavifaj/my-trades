'use client';

import { useMemo } from 'react';

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

interface SimpleCandlestickChartProps {
  symbol: string;
  timeframe: string;
  candles: Candle[];
  overlays: Overlay[];
  showVolume: boolean;
  onTimeframeChange: (timeframe: string) => void;
  onVolumeToggle: () => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">
        <p className="font-semibold text-slate-200">{new Date(label).toLocaleString()}</p>
        <p className="text-emerald-300">Open: ${data.o?.toFixed(2)}</p>
        <p className="text-red-300">High: ${data.h?.toFixed(2)}</p>
        <p className="text-red-300">Low: ${data.l?.toFixed(2)}</p>
        <p className="text-emerald-300">Close: ${data.c?.toFixed(2)}</p>
        {data.v && <p className="text-blue-300">Volume: {data.v}</p>}
      </div>
    );
  }
  return null;
};

const TradeMarker = ({ cx, cy, payload }: any) => {
  if (!payload.isTrade) return null;
  
  const isLongEntry = payload.entry && payload.side === 'LONG';
  const isShortEntry = payload.entry && payload.side === 'SHORT';
  const isLongExit = !payload.entry && payload.side === 'LONG';
  const isShortExit = !payload.entry && payload.side === 'SHORT';

  let markerColor = '#fff';
  let points = '';
  let labelY = cy;

  if (isLongEntry) {
    markerColor = '#22c55e';
    points = `${cx},${cy - 8} ${cx - 6},${cy + 2} ${cx + 6},${cy + 2}`;
    labelY = cy - 15;
  } else if (isShortEntry) {
    markerColor = '#ef4444';
    points = `${cx},${cy + 8} ${cx - 6},${cy - 2} ${cx + 6},${cy - 2}`;
    labelY = cy + 15;
  } else if (isLongExit) {
    markerColor = '#22c55e';
    points = `${cx},${cy + 8} ${cx - 6},${cy - 2} ${cx + 6},${cy - 2}`;
    labelY = cy + 15;
  } else if (isShortExit) {
    markerColor = '#ef4444';
    points = `${cx},${cy - 8} ${cx - 6},${cy + 2} ${cx + 6},${cy + 2}`;
    labelY = cy - 15;
  }

  return (
    <g>
      <polygon points={points} fill={markerColor} stroke="#fff" strokeWidth={1} />
      <text
        x={cx}
        y={labelY}
        fill="#fff"
        fontSize={10}
        textAnchor="middle"
        fontWeight="bold"
      >
        {payload.entry ? 'Entry' : 'Exit'}: ${payload.price.toFixed(2)}
      </text>
    </g>
  );
};

export function SimpleCandlestickChart({ 
  symbol, 
  timeframe, 
  candles, 
  overlays, 
  showVolume, 
  onTimeframeChange, 
  onVolumeToggle 
}: SimpleCandlestickChartProps) {
  const chartData = useMemo(() => {
    if (!candles.length) return [];
    
    // Show last 7 days of data, sorted by time
    const sortedCandles = candles
      .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
    
    return sortedCandles.map((candle, index) => ({
      ...candle,
      time: new Date(candle.t).getTime(),
      index,
      displayTime: new Date(candle.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      displayDate: new Date(candle.t).toLocaleDateString([], { month: 'short', day: 'numeric' })
    }));
  }, [candles]);

  const minPrice = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.min(...chartData.map(d => d.l));
  }, [chartData]);

  const maxPrice = useMemo(() => {
    if (!chartData.length) return 100;
    return Math.max(...chartData.map(d => d.h));
  }, [chartData]);

  const maxVolume = useMemo(() => {
    if (!chartData.length) return 1;
    return Math.max(...chartData.map(d => d.v || 0));
  }, [chartData]);

  // Calculate positions for SVG
  const chartWidth = 1200; // Increased width for full day view
  const chartHeight = showVolume ? 500 : 600;
  const volumeHeight = showVolume ? 120 : 0;
  const priceHeight = chartHeight - volumeHeight;

  const xScale = (index: number) => (index / Math.max(1, chartData.length - 1)) * chartWidth;
  const yScale = (price: number) => priceHeight - ((price - minPrice) / (maxPrice - minPrice)) * priceHeight;

  if (!candles.length) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/70">
        <p className="text-slate-400">No hay datos para {symbol}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-200">
            {symbol} · {timeframe}
          </h2>
          <p className="text-sm text-slate-400">
            Últimos 7 días
          </p>
          <p className="text-xs text-slate-500">
            {candles.length} velas · {overlays.length} trades · Rango: ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            value={timeframe} 
            onChange={(e) => onTimeframeChange(e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-200"
          >
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="1d">1d</option>
          </select>
          
          <button
            onClick={onVolumeToggle}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              showVolume 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Volumen
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 overflow-x-auto">
        <div className="min-w-max">
          <svg width={chartWidth} height={chartHeight + volumeHeight} viewBox={`0 0 ${chartWidth} ${chartHeight + volumeHeight}`}>
            {/* Grid */}
            {chartData.map((_, index) => {
              const x = xScale(index);
              return (
                <line
                  key={`grid-h-${index}`}
                  x1={0}
                  y1={yScale(chartData[index].l)}
                  x2={chartWidth}
                  y2={yScale(chartData[index].l)}
                  stroke="#374151"
                  strokeWidth={0.5}
                  opacity={0.3}
                />
              );
            })}
            
            {/* Candlesticks */}
            {chartData.map((candle, index) => {
              const x = xScale(index);
              const isUp = candle.c >= candle.o;
              const bodyColor = isUp ? '#22c55e' : '#ef4444';
              const wickColor = isUp ? '#22c55e' : '#ef4444';
              
              const wickTop = yScale(candle.h);
              const wickBottom = yScale(candle.l);
              const openY = yScale(candle.o);
              const closeY = yScale(candle.c);
              const bodyHeight = Math.abs(closeY - openY);
              const bodyY = Math.min(openY, closeY);
              
              const candleWidth = chartWidth / chartData.length;
              const bodyWidth = candleWidth * 0.6;
              const bodyX = x + (candleWidth - bodyWidth) / 2;
              const wickX = x + candleWidth / 2;
              
              return (
                <g key={candle.t}>
                  {/* Wick (mecha) */}
                  <line
                    x1={wickX}
                    y1={wickTop}
                    x2={wickX}
                    y2={wickBottom}
                    stroke={wickColor}
                    strokeWidth={1}
                    opacity={0.8}
                  />
                  {/* Body (cuerpo) */}
                  {bodyHeight > 0 ? (
                    <rect
                      x={bodyX}
                      y={bodyY}
                      width={bodyWidth}
                      height={bodyHeight}
                      fill={isUp ? bodyColor : 'transparent'}
                      stroke={bodyColor}
                      strokeWidth={1}
                      opacity={0.9}
                    />
                  ) : (
                    // Doji (vela sin cuerpo)
                    <line
                      x1={bodyX}
                      y1={bodyY}
                      x2={bodyX + bodyWidth}
                      y2={bodyY}
                      stroke={bodyColor}
                      strokeWidth={2}
                      opacity={0.9}
                    />
                  )}
                </g>
              );
            })}
            
            {/* Volume bars */}
            {showVolume && chartData.map((candle, index) => {
              const x = xScale(index);
              const volumeBarHeight = (candle.v / maxVolume) * volumeHeight * 0.8;
              const volumeY = chartHeight + volumeHeight - volumeBarHeight;
              const isUp = candle.c >= candle.o;
              
              return (
                <rect
                  key={`volume-${candle.t}`}
                  x={x + chartWidth / chartData.length * 0.1}
                  y={volumeY}
                  width={chartWidth / chartData.length * 0.8}
                  height={volumeBarHeight}
                  fill={isUp ? '#22c55e' : '#ef4444'}
                  opacity={0.6}
                />
              );
            })}
            
            {/* Trade markers */}
            {overlays.map((trade) => {
              const entryTime = new Date(trade.entryTime).getTime();
              const exitTime = new Date(trade.exitTime).getTime();
              
              const entryIndex = chartData.findIndex((d: any) => Math.abs((d as any).time - entryTime) < 30000);
              const exitIndex = chartData.findIndex((d: any) => Math.abs((d as any).time - exitTime) < 30000);
              
              const markers = [];
              
              if (entryIndex >= 0) {
                const entryX = xScale(entryIndex);
                const entryY = yScale(trade.entryPrice);
                markers.push(
                  <g key={`${trade.id}-entry`}>
                    <TradeMarker cx={entryX} cy={entryY} payload={{...trade, entry: true, price: trade.entryPrice, side: trade.side}} />
                  </g>
                );
              }
              
              if (exitIndex >= 0) {
                const exitX = xScale(exitIndex);
                const exitY = yScale(trade.exitPrice || trade.entryPrice);
                markers.push(
                  <g key={`${trade.id}-exit`}>
                    <TradeMarker cx={exitX} cy={exitY} payload={{...trade, entry: false, price: trade.exitPrice || trade.entryPrice, side: trade.side}} />
                  </g>
                );
              }
              
              return markers;
            })}
          </svg>
        </div>
      </div>

      {/* Trade info */}
      {overlays.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Trades Ejecutados</h3>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {overlays.map((trade) => (
              <div 
                key={trade.id}
                className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-cyan-400">{trade.symbol}</span>
                  <span className={`font-semibold ${trade.pnl >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  <div>{trade.side} · {trade.size} shares</div>
                  <div>Entry: ${trade.entryPrice.toFixed(2)}</div>
                  {trade.exitPrice && <div>Exit: ${trade.exitPrice.toFixed(2)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
