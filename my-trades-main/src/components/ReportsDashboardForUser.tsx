'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type SetupPerformanceRow = {
  setupName: string;
  trades: number;
  wins: number;
  losses: number;
  pnlTotal: number;
  avgWin: number;
  avgLoss: number;
  winRate: number;
  lossRate: number;
  winLossRatio: number | null;
  expectancy: number;
  contributionPct: number;
};

type StatsData = {
  totalGainLoss: number;
  largestGain: number;
  largestLoss: number;
  avgDailyGainLoss: number;
  avgDailyVolume: number;
  avgPerShareGainLoss: number;
  avgTradeGainLoss: number;
  avgWinningTrade: number;
  avgLosingTrade: number;
  totalTrades: number;
  winningTrades: number;
  winningTradesPct: number;
  losingTrades: number;
  losingTradesPct: number;
  scratchTrades: number;
  scratchTradesPct: number;
  avgHoldWinningMin: number;
  avgHoldLosingMin: number;
  avgHoldScratchMin: number;
  maxConsecWins: number;
  maxConsecLosses: number;
  stdDev: number;
  sqn: number;
  probRandomChance: number;
  kellyPct: number;
  kRatio: number;
  profitFactor: number | string;
  totalCommissions: number;
  totalFees: number;
  avgMAE: number;
  avgMFE: number;
  tradingDays: number;
};

type ReportsResponse = {
  filters: { from: string | null; to: string | null; setup: string | null; ticker: string | null; tz: string; ecnFeePerShare: number };
  totals: { trades: number; pnlGrossTotal: number; ecnFeesTotal: number; pnlNetTotal: number };
  stats: StatsData;
  setupPerformance: SetupPerformanceRow[];
  temporal: {
    pnlByTimeBucket: Array<{ bucket: string; pnl: number; trades: number }>;
    bestTimeBucket: { bucket: string; pnl: number; trades: number } | null;
    worstTimeBucket: { bucket: string; pnl: number; trades: number } | null;
  };
  price: {
    pnlByPriceBucket: Array<{ bucket: string; pnl: number; trades: number }>;
    bestPriceBucket: { bucket: string; pnl: number; trades: number } | null;
    worstPriceBucket: { bucket: string; pnl: number; trades: number } | null;
  };
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function lastNDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function pnlColor(v: number) {
  return v >= 0 ? 'text-emerald-300' : 'text-rose-300';
}

export function ReportsDashboardForUser({ userId }: { userId: string }) {
  const [from, setFrom] = useState(() => lastNDaysIso(30));
  const [to, setTo] = useState(() => todayIso());
  const [ticker, setTicker] = useState('');
  const [ecnFeePerShare, setEcnFeePerShare] = useState('0');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReportsResponse | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      if (ticker.trim()) qs.set('ticker', ticker.trim().toUpperCase());
      if (ecnFeePerShare.trim()) qs.set('ecnFeePerShare', ecnFeePerShare.trim());
      const res = await fetch(`/api/users/${userId}/dashboard/reports?${qs.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'No se pudo cargar Reports');
        setData(null);
        return;
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, ticker, ecnFeePerShare, userId]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const topWinners = useMemo(() => {
    if (!data?.setupPerformance?.length) return [];
    return data.setupPerformance.slice().sort((a, b) => b.pnlTotal - a.pnlTotal).slice(0, 6);
  }, [data]);

  const topLosers = useMemo(() => {
    if (!data?.setupPerformance?.length) return [];
    return data.setupPerformance.slice().sort((a, b) => a.pnlTotal - b.pnlTotal).slice(0, 6);
  }, [data]);

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Reports del Alumno</h2>
            <p className="mt-1 text-sm text-slate-400">Agregados por setup, hora y rango de precio (TZ: America/New_York).</p>
          </div>

          <form
            className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-4"
            onSubmit={(e) => { e.preventDefault(); void loadReports(); }}
          >
            <label className="text-xs text-slate-400">
              Desde
              <input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 p-2 text-sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="text-xs text-slate-400">
              Hasta
              <input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 p-2 text-sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <label className="text-xs text-slate-400">
              Ticker
              <input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 p-2 text-sm" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="AAPL" />
            </label>
            <label className="text-xs text-slate-400">
              ECN fee / share
              <input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 p-2 text-sm" value={ecnFeePerShare} onChange={(e) => setEcnFeePerShare(e.target.value)} placeholder="0.003" />
            </label>
            <div className="sm:col-span-2 lg:col-span-4">
              <button type="submit" className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950" disabled={loading}>
                {loading ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {error && (
        <section className="panel p-5">
          <p className="text-sm font-medium text-rose-300">{error}</p>
        </section>
      )}

      {data && (
        <>
          <section className="panel p-5">
            <h3 className="panel-title mb-4">Trading Statistics</h3>
            <div className="grid gap-px rounded-xl border border-slate-800 bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ['Total P&L', pnlColor(data.stats.totalGainLoss), `$${data.stats.totalGainLoss.toFixed(2)}`],
                ['Largest Gain', 'text-emerald-300', `$${data.stats.largestGain.toFixed(2)}`],
                ['Largest Loss', 'text-rose-300', `$${data.stats.largestLoss.toFixed(2)}`],
                ['Profit Factor', 'text-slate-100', String(data.stats.profitFactor)],
                ['Avg Daily P&L', pnlColor(data.stats.avgDailyGainLoss), `$${data.stats.avgDailyGainLoss.toFixed(2)}`],
                ['Avg Daily Volume', 'text-slate-100', `${data.stats.avgDailyVolume} trades`],
                ['Avg Per-Share P&L', pnlColor(data.stats.avgPerShareGainLoss), `$${data.stats.avgPerShareGainLoss.toFixed(4)}`],
                ['Avg Trade P&L', pnlColor(data.stats.avgTradeGainLoss), `$${data.stats.avgTradeGainLoss.toFixed(2)}`],
                ['Avg Winning Trade', 'text-emerald-300', `$${data.stats.avgWinningTrade.toFixed(2)}`],
                ['Avg Losing Trade', 'text-rose-300', `$${data.stats.avgLosingTrade.toFixed(2)}`],
                ['Total Trades', 'text-slate-100', `${data.stats.totalTrades}`],
                ['Trading Days', 'text-slate-100', `${data.stats.tradingDays}`],
                ['Winning Trades', 'text-emerald-300', `${data.stats.winningTrades} (${data.stats.winningTradesPct}%)`],
                ['Losing Trades', 'text-rose-300', `${data.stats.losingTrades} (${data.stats.losingTradesPct}%)`],
                ['Scratch Trades', 'text-slate-400', `${data.stats.scratchTrades} (${data.stats.scratchTradesPct}%)`],
                ['Max Consec. Wins', 'text-emerald-300', `${data.stats.maxConsecWins}`],
                ['Max Consec. Losses', 'text-rose-300', `${data.stats.maxConsecLosses}`],
                ['Avg Hold (winners)', 'text-slate-100', `${data.stats.avgHoldWinningMin} min`],
                ['Avg Hold (losers)', 'text-slate-100', `${data.stats.avgHoldLosingMin} min`],
                ['Avg Hold (scratch)', 'text-slate-100', `${data.stats.avgHoldScratchMin} min`],
                ['P&L Std Deviation', 'text-slate-100', `$${data.stats.stdDev.toFixed(2)}`],
                ['SQN', 'text-cyan-300', `${data.stats.sqn.toFixed(2)}`],
                ['Prob. Random Chance', 'text-slate-100', `${(data.stats.probRandomChance * 100).toFixed(2)}%`],
                ['Kelly %', 'text-cyan-300', `${data.stats.kellyPct.toFixed(2)}%`],
                ['K-Ratio', 'text-slate-100', `${data.stats.kRatio.toFixed(2)}`],
                ['Total Commissions', 'text-slate-100', `$${data.stats.totalCommissions.toFixed(2)}`],
                ['Total Fees', 'text-slate-100', `$${data.stats.totalFees.toFixed(2)}`],
                ['Avg Position MAE', 'text-rose-300', `$${data.stats.avgMAE.toFixed(2)}`],
                ['Avg Position MFE', 'text-emerald-300', `$${data.stats.avgMFE.toFixed(2)}`],
              ] as [string, string, string][]).map(([label, color, value]) => (
                <div key={label} className="bg-slate-950/80 px-4 py-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`mt-0.5 text-sm font-semibold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <article className="panel p-4">
              <p className="text-sm text-slate-400">Trades</p>
              <p className="metric-value mt-1">{data.totals.trades}</p>
            </article>
            <article className="panel p-4">
              <p className="text-sm text-slate-400">PnL neto (after ECN)</p>
              <p className={`metric-value mt-1 ${data.totals.pnlNetTotal >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{data.totals.pnlNetTotal.toFixed(2)}</p>
              <p className="mt-1 text-xs text-slate-500">Gross: {data.totals.pnlGrossTotal.toFixed(2)} · ECN: {data.totals.ecnFeesTotal.toFixed(2)}</p>
            </article>
            <article className="panel p-4">
              <p className="text-sm text-slate-400">Mejor franja</p>
              <p className="mt-1 text-sm text-slate-100">
                {data.temporal.bestTimeBucket ? `${data.temporal.bestTimeBucket.bucket} (${data.temporal.bestTimeBucket.pnl.toFixed(2)})` : 'N/A'}
              </p>
              <p className="text-xs text-slate-500">
                {data.temporal.worstTimeBucket ? `Peor: ${data.temporal.worstTimeBucket.bucket} (${data.temporal.worstTimeBucket.pnl.toFixed(2)})` : ''}
              </p>
            </article>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="panel p-5">
              <h3 className="panel-title mb-3">Top setups (PnL)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topWinners} margin={{ left: 8, right: 8, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="setupName" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={0} angle={-15} height={60} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#0a0e1a', border: '1px solid #334155', color: '#e2e8f0' }} />
                    <Legend />
                    <Bar dataKey="pnlTotal" name="PnL" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel p-5">
              <h3 className="panel-title mb-3">Bottom setups (PnL)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topLosers} margin={{ left: 8, right: 8, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="setupName" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={0} angle={-15} height={60} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#0a0e1a', border: '1px solid #334155', color: '#e2e8f0' }} />
                    <Legend />
                    <Bar dataKey="pnlTotal" name="PnL" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="panel p-5">
            <h3 className="panel-title mb-3">Performance por setup</h3>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="py-2 pr-3">Setup</th>
                    <th className="py-2 pr-3">Trades</th>
                    <th className="py-2 pr-3">PnL</th>
                    <th className="py-2 pr-3">Win rate</th>
                    <th className="py-2 pr-3">W/L ratio</th>
                    <th className="py-2 pr-3">Expectancy</th>
                    <th className="py-2 pr-3">% contrib</th>
                  </tr>
                </thead>
                <tbody>
                  {data.setupPerformance.map((row) => (
                    <tr key={row.setupName} className="border-t border-slate-800/70">
                      <td className="py-2 pr-3 font-medium text-slate-100">{row.setupName}</td>
                      <td className="py-2 pr-3 text-slate-200">{row.trades}</td>
                      <td className={`py-2 pr-3 ${row.pnlTotal >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{row.pnlTotal.toFixed(2)}</td>
                      <td className="py-2 pr-3 text-slate-200">{row.winRate.toFixed(2)}%</td>
                      <td className="py-2 pr-3 text-slate-200">{row.winLossRatio === null ? 'N/A' : row.winLossRatio.toFixed(2)}</td>
                      <td className="py-2 pr-3 text-slate-200">{row.expectancy.toFixed(2)}</td>
                      <td className="py-2 pr-3 text-slate-200">{row.contributionPct.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="panel p-5">
              <h3 className="panel-title mb-3">PnL por franja horaria (30m)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.temporal.pnlByTimeBucket} margin={{ left: 8, right: 8, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="bucket" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={1} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#0a0e1a', border: '1px solid #334155', color: '#e2e8f0' }} />
                    <Bar dataKey="pnl" name="PnL" fill="#22d3ee" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel p-5">
              <h3 className="panel-title mb-3">PnL por rango de precio (entry)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.price.pnlByPriceBucket} margin={{ left: 8, right: 8, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="bucket" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#0a0e1a', border: '1px solid #334155', color: '#e2e8f0' }} />
                    <Bar dataKey="pnl" name="PnL" fill="#a78bfa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Mejor: {data.price.bestPriceBucket ? `${data.price.bestPriceBucket.bucket} (${data.price.bestPriceBucket.pnl.toFixed(2)})` : 'N/A'} · Peor: {data.price.worstPriceBucket ? `${data.price.worstPriceBucket.bucket} (${data.price.worstPriceBucket.pnl.toFixed(2)})` : 'N/A'}
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
