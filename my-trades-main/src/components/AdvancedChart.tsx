'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ReferenceLine,
  Scatter
} from 'recharts';

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

interface AdvancedChartProps {
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

const CustomCandlestick = (props: any) => {
  const { x, y, width, height, payload } = props;
  
  if (!payload || payload.o === undefined) return null;
  
  const { o, h, l, c } = payload;
  const isUp = c >= o;
  const color = isUp ? '#22c55e' : '#ef4444';
  
  // Simple candlestick calculation
  const bodyHeight = Math.abs(c - o);
  const bodyTop = y + height - ((h - o) / (h - l)) * height;
  const wickY = y + height - ((h - l) / (h - l)) * height;
  
  return (
    <g>
      {/* Wick - from high to low */}
      <line
        x1={x + width / 2}
        y1={y}
        x2={x + width / 2}
        y2={y + height}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body - from open to close */}
      <rect
        x={x + width * 0.2}
        y={Math.min(bodyTop, bodyTop + bodyHeight)}
        width={width * 0.6}
        height={Math.max(bodyHeight, 2)} // Minimum visible height
        fill={color}
        stroke={color}
      />
    </g>
  );
};

const TradeMarker = ({ cx, cy, payload }: any) => {
  if (!payload.isTrade) return null;
  
  const isLongEntry = payload.entry && payload.side === 'LONG';
  const isShortEntry = payload.entry && payload.side === 'SHORT';
  const isLongExit = !payload.entry && payload.side === 'LONG';
  const isShortExit = !payload.entry && payload.side === 'SHORT';

  let markerColor = '#fff'; // Default color
  let points = '';
  let labelY = cy;

  if (isLongEntry) {
    markerColor = '#22c55e'; // Green for long entry
    points = `${cx},${cy - 8} ${cx - 6},${cy + 2} ${cx + 6},${cy + 2}`;
    labelY = cy - 15;
  } else if (isShortEntry) {
    markerColor = '#ef4444'; // Red for short entry
    points = `${cx},${cy + 8} ${cx - 6},${cy - 2} ${cx + 6},${cy - 2}`;
    labelY = cy + 15;
  } else if (isLongExit) {
    markerColor = '#22c55e'; // Green for long exit
    points = `${cx},${cy + 8} ${cx - 6},${cy - 2} ${cx + 6},${cy - 2}`;
    labelY = cy + 15;
  } else if (isShortExit) {
    markerColor = '#ef4444'; // Red for short exit
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

export function AdvancedChart({ 
  symbol, 
  timeframe, 
  candles, 
  overlays, 
  showVolume, 
  onTimeframeChange, 
  onVolumeToggle 
}: AdvancedChartProps) {
  const chartData = useMemo(() => {
    if (!candles.length) return [];
    
    // Combine candles with trade markers
    const data = candles.map((candle, index) => ({
      ...candle,
      time: new Date(candle.t).getTime(),
      index,
      displayTime: new Date(candle.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    return data;
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

  if (!candles.length) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/70">
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
            {candles.length} velas · {overlays.length} trades
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
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <ResponsiveContainer width="100%" height={showVolume ? 500 : 400}>
          <ComposedChart 
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: showVolume ? 80 : 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            
            <XAxis 
              dataKey="time"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              stroke="#9ca3af"
              fontSize={12}
            />
            
            <YAxis 
              yAxisId="price"
              domain={[minPrice * 0.999, maxPrice * 1.001]}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
              stroke="#9ca3af"
              fontSize={12}
            />
            
            {showVolume && (
              <YAxis 
                yAxisId="volume"
                orientation="right"
                domain={[0, maxVolume * 1.1]}
                tickFormatter={(value) => value.toString()}
                stroke="#9ca3af"
                fontSize={12}
              />
            )}

            <Tooltip content={<CustomTooltip />} />
            
            {/* Simple candlestick representation */}
            <Bar
              yAxisId="price"
              dataKey="h"
              fill="#ef4444"
              opacity={0.3}
            />
            <Bar
              yAxisId="price"
              dataKey="l"
              fill="#22c55e"
              opacity={0.3}
            />
            <Bar
              yAxisId="price"
              dataKey="c"
              fill="#3b82f6"
              opacity={0.8}
            />
            <Bar
              yAxisId="price"
              dataKey="o"
              fill="#f59e0b"
              opacity={0.6}
            />
            
            {/* Volume bars */}
            {showVolume && (
              <Bar
                yAxisId="volume"
                dataKey="v"
                fill="#8b5cf6"
                opacity={0.6}
                maxBarSize={20}
              />
            )}
            
            {/* Trade markers */}
            <Scatter
              yAxisId="price"
              data={chartData.map((d, index) => {
                // Check if this point has a trade (within 1 minute tolerance)
                const entryTrade = overlays.find(trade => {
                  const entryTime = new Date(trade.entryTime).getTime();
                  const timeDiff = Math.abs(entryTime - d.time);
                  return timeDiff < 60000; // Within 1 minute (60 seconds * 1000ms)
                });
                const exitTrade = overlays.find(trade => {
                  const exitTime = new Date(trade.exitTime).getTime();
                  const timeDiff = Math.abs(exitTime - d.time);
                  return timeDiff < 60000; // Within 1 minute
                });
                
                if (entryTrade) {
                  return {
                    ...d,
                    isTrade: true,
                    entry: true,
                    side: entryTrade.side,
                    price: entryTrade.entryPrice
                  };
                }
                
                if (exitTrade) {
                  return {
                    ...d,
                    isTrade: true,
                    entry: false,
                    side: exitTrade.side,
                    price: exitTrade.exitPrice || exitTrade.entryPrice
                  };
                }
                
                return { ...d, isTrade: false };
              })}
              fill="none"
              shape={<TradeMarker />}
            />
            
            {/* Reference lines for trade prices */}
            {overlays.map((trade) => (
              <ReferenceLine
                key={trade.id}
                yAxisId="price"
                y={trade.entryPrice}
                stroke="#22c55e"
                strokeDasharray="5 5"
                strokeWidth={1}
                label={{ value: `Entry ${trade.entryPrice.toFixed(2)}`, position: 'left' }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
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
