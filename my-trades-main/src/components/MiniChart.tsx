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

interface MiniChartProps {
  symbol: string;
  candles: Candle[];
  overlays: Overlay[];
  width?: number;
  height?: number;
  onClick?: () => void;
}

export function MiniChart({ 
  symbol, 
  candles, 
  overlays, 
  width = 200, 
  height = 60,
  onClick 
}: MiniChartProps) {
  const chartData = useMemo(() => {
    if (!candles.length) return [];
    return candles.slice(-20); // Last 20 candles for mini view
  }, [candles]);

  const minPrice = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.min(...chartData.map(d => d.l));
  }, [chartData]);

  const maxPrice = useMemo(() => {
    if (!chartData.length) return 100;
    return Math.max(...chartData.map(d => d.h));
  }, [chartData]);

  if (!chartData.length) {
    return (
      <div 
        className="flex items-center justify-center bg-slate-900 rounded cursor-pointer hover:bg-slate-800 transition-colors"
        style={{ width, height }}
        onClick={onClick}
      >
        <span className="text-xs text-slate-500">No data</span>
      </div>
    );
  }

  const xScale = (index: number) => (index / Math.max(1, chartData.length - 1)) * width;
  const yScale = (price: number) => height - ((price - minPrice) / (maxPrice - minPrice)) * height;

  return (
    <div 
      className="bg-slate-900 rounded cursor-pointer hover:bg-slate-800 transition-colors relative"
      style={{ width, height }}
      onClick={onClick}
    >
      <svg width={width} height={height} className="overflow-hidden">
        {/* Mini candlesticks */}
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
          
          const candleWidth = width / chartData.length;
          const bodyWidth = Math.max(candleWidth * 0.6, 1);
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
                strokeWidth={0.5}
                opacity={0.7}
              />
              {/* Body (cuerpo) */}
              {bodyHeight > 0.5 ? (
                <rect
                  x={bodyX}
                  y={bodyY}
                  width={bodyWidth}
                  height={Math.max(bodyHeight, 0.5)}
                  fill={isUp ? bodyColor : 'transparent'}
                  stroke={bodyColor}
                  strokeWidth={0.5}
                  opacity={0.8}
                />
              ) : (
                // Doji (vela sin cuerpo)
                <line
                  x1={bodyX}
                  y1={bodyY}
                  x2={bodyX + bodyWidth}
                  y2={bodyY}
                  stroke={bodyColor}
                  strokeWidth={0.8}
                  opacity={0.8}
                />
              )}
            </g>
          );
        })}
        
        {/* Mini trade markers */}
        {overlays.slice(-3).map((trade) => {
          const entryTime = new Date(trade.entryTime).getTime();
          const exitTime = new Date(trade.exitTime).getTime();
          
          const entryIndex = chartData.findIndex((d: any) => Math.abs((d as any).time - entryTime) < 30000);
          const exitIndex = chartData.findIndex((d: any) => Math.abs((d as any).time - exitTime) < 30000);
          
          const markers = [];
          
          if (entryIndex >= 0) {
            const entryX = xScale(entryIndex);
            const entryY = yScale(trade.entryPrice);
            const isLong = trade.side === 'LONG';
            
            markers.push(
              <polygon
                key={`${trade.id}-entry`}
                points={`${entryX},${entryY - 3} ${entryX - 2},${entryY + 1} ${entryX + 2},${entryY + 1}`}
                fill={isLong ? '#22c55e' : '#ef4444'}
                stroke="#fff"
                strokeWidth={0.5}
              />
            );
          }
          
          if (exitIndex >= 0) {
            const exitX = xScale(exitIndex);
            const exitY = yScale(trade.exitPrice || trade.entryPrice);
            const isLong = trade.side === 'LONG';
            
            markers.push(
              <polygon
                key={`${trade.id}-exit`}
                points={`${exitX},${exitY + 3} ${exitX - 2},${exitY - 1} ${exitX + 2},${exitY - 1}`}
                fill={isLong ? '#22c55e' : '#ef4444'}
                stroke="#fff"
                strokeWidth={0.5}
              />
            );
          }
          
          return markers;
        })}
      </svg>
      
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-blue-500/10 opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
}
