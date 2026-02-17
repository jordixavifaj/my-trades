'use client';

import { useMemo } from 'react';

type PnlPoint = { date: string; pnl: number };
type EquityPoint = { date: string; equity: number; drawdown: number };
type StrategyPoint = { name: string; trades: number; pnl: number };

export function DashboardCharts({
  pnlTimeline,
  strategyPerformance,
  equityCurve,
}: {
  pnlTimeline: PnlPoint[];
  strategyPerformance: StrategyPoint[];
  equityCurve: EquityPoint[];
}) {
  const chartPoints = useMemo(() => {
    if (!equityCurve.length) return '';
    const max = Math.max(...equityCurve.map((p) => p.equity));
    const min = Math.min(...equityCurve.map((p) => p.equity));
    const range = Math.max(1, max - min);

    return equityCurve
      .map((point, index) => {
        const x = (index / Math.max(1, equityCurve.length - 1)) * 100;
        const y = 100 - ((point.equity - min) / range) * 100;
        return `${x},${y}`;
      })
      .join(' ');
  }, [equityCurve]);

  const maxStrategyPnl = Math.max(1, ...strategyPerformance.map((s) => Math.abs(s.pnl)));

  return (
    <div className="mb-6 grid gap-4 xl:grid-cols-3">
      <section className="panel p-5 xl:col-span-2">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="panel-title">Equity Curve</h3>
          <span className="text-xs text-slate-400">{equityCurve.length} puntos</span>
        </div>
        <div className="h-64 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          {equityCurve.length ? (
            <svg viewBox="0 0 100 100" className="h-full w-full">
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline fill="none" stroke="#22d3ee" strokeWidth="1.2" points={chartPoints} />
              <polyline fill="url(#equityGradient)" stroke="none" points={`${chartPoints} 100,100 0,100`} />
            </svg>
          ) : (
            <p className="text-sm text-slate-400">Sin datos de equity.</p>
          )}
        </div>
      </section>

      <section className="panel p-5">
        <h3 className="panel-title mb-4">PnL diario</h3>
        <div className="space-y-2">
          {pnlTimeline.slice(-8).map((point) => (
            <div key={point.date}>
              <div className="mb-1 flex justify-between text-xs text-slate-300">
                <span>{point.date}</span>
                <span className={point.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{point.pnl.toFixed(2)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div
                  className={`h-2 rounded-full ${point.pnl >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                  style={{ width: `${Math.min(100, Math.abs(point.pnl))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-5 xl:col-span-3">
        <h3 className="panel-title mb-4">Desempeño por estrategia</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {strategyPerformance.map((item) => (
            <article key={item.name} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium">{item.name}</p>
                <span className="text-xs text-slate-400">{item.trades} trades</span>
              </div>
              <p className={`text-lg font-semibold ${item.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{item.pnl.toFixed(2)}</p>
              <div className="mt-3 h-2 rounded-full bg-slate-800">
                <div
                  className="h-2 rounded-full bg-cyan-400"
                  style={{ width: `${Math.max(8, (Math.abs(item.pnl) / maxStrategyPnl) * 100)}%` }}
                />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
