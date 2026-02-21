'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

type PnlPoint = { date: string; pnl: number };
type EquityPoint = { date: string; equity: number; drawdown: number };
type StrategyPoint = { name: string; trades: number; pnl: number };
type MonthPnl = { month: string; pnl: number };

function getTickInterval(range: number): number {
  if (range <= 100) return 10;
  if (range <= 500) return 50;
  if (range <= 2000) return 100;
  if (range <= 10000) return 500;
  return 1000;
}

function generateTicks(min: number, max: number): number[] {
  const range = max - min;
  const interval = getTickInterval(range);
  const start = Math.floor(min / interval) * interval;
  const end = Math.ceil(max / interval) * interval;
  const ticks: number[] = [];
  for (let v = start; v <= end; v += interval) ticks.push(v);
  return ticks;
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

export function DashboardCharts({
  pnlTimeline,
  strategyPerformance,
  equityCurve,
  pnlByMonth,
}: {
  pnlTimeline: PnlPoint[];
  strategyPerformance: StrategyPoint[];
  equityCurve: EquityPoint[];
  pnlByMonth: MonthPnl[];
}) {
  const currentEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : 0;

  const yTicks = useMemo(() => {
    if (!equityCurve.length) return [];
    const values = equityCurve.map((p) => p.equity);
    return generateTicks(Math.min(0, ...values), Math.max(0, ...values));
  }, [equityCurve]);

  const yDomain = useMemo(() => {
    if (!yTicks.length) return [0, 0];
    return [yTicks[0], yTicks[yTicks.length - 1]];
  }, [yTicks]);

  const maxStrategyPnl = Math.max(1, ...strategyPerformance.map((s) => Math.abs(s.pnl)));

  return (
    <div className="mb-6 space-y-4">
      {/* Equity Curve — Full width */}
      <section className="panel p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="panel-title">Equity Curve</h3>
            <p className="mt-0.5 text-xs text-slate-500">{equityCurve.length} trades acumulados</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">PnL Acumulado</p>
            <p className={`text-2xl font-bold tracking-tight ${currentEquity >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {currentEquity >= 0 ? '+' : ''}${currentEquity.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="h-72 rounded-xl border border-slate-800 bg-slate-950/60 p-2">
          {equityCurve.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityCurve} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityFillGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="equityFillRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={0} />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  ticks={yTicks}
                  domain={yDomain}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(v: number) => `$${v}`}
                  width={60}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(2)}`, 'Equity']}
                />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke={currentEquity >= 0 ? '#34d399' : '#fb7185'}
                  strokeWidth={2}
                  fill={currentEquity >= 0 ? 'url(#equityFillGreen)' : 'url(#equityFillRed)'}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-500">Sin datos de equity. Importa trades para ver tu curva.</p>
            </div>
          )}
        </div>
      </section>

      {/* Monthly PnL Calendar + Daily PnL + Strategy */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Monthly PnL Calendar */}
        <section className="panel p-5 xl:col-span-2">
          <h3 className="panel-title mb-4">PnL Mensual</h3>
          {pnlByMonth.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {pnlByMonth.map((m) => {
                const [year, mm] = m.month.split('-');
                return (
                  <div
                    key={m.month}
                    className={`rounded-xl border p-3 text-center transition ${
                      m.pnl > 0
                        ? 'border-emerald-700/60 bg-emerald-500/10'
                        : m.pnl < 0
                          ? 'border-rose-700/60 bg-rose-500/10'
                          : 'border-slate-800 bg-slate-950/70'
                    }`}
                  >
                    <p className="text-xs text-slate-400">{MONTH_NAMES[mm] || mm} {year}</p>
                    <p className={`mt-1 text-lg font-bold ${m.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {m.pnl >= 0 ? '+' : ''}${m.pnl.toFixed(0)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin datos mensuales.</p>
          )}
        </section>

        {/* Daily PnL */}
        <section className="panel p-5">
          <h3 className="panel-title mb-4">PnL diario (últimos 8)</h3>
          <div className="space-y-2">
            {pnlTimeline.slice(-8).map((point) => (
              <div key={point.date}>
                <div className="mb-1 flex justify-between text-xs text-slate-300">
                  <span>{point.date}</span>
                  <span className={point.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                    {point.pnl >= 0 ? '+' : ''}{point.pnl.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div
                    className={`h-2 rounded-full ${point.pnl >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                    style={{ width: `${Math.min(100, Math.abs(point.pnl))}%` }}
                  />
                </div>
              </div>
            ))}
            {pnlTimeline.length === 0 && <p className="text-sm text-slate-500">Sin datos diarios.</p>}
          </div>
        </section>
      </div>

      {/* Strategy Performance */}
      {strategyPerformance.length > 0 && (
        <section className="panel p-5">
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
      )}
    </div>
  );
}
