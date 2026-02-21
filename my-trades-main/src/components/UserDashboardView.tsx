'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TradingCalendar } from '@/components/TradingCalendar';
import { JournalChart, JournalCandle, JournalTrade } from '@/components/JournalChart';
import { DashboardCharts } from '@/components/DashboardCharts';

type CalendarTrade = {
  id: string;
  symbol: string;
  pnl: number;
  side: 'BUY' | 'SELL';
  quantity: number;
  openDate: string;
  closeDate: string | null;
  status: 'OPEN' | 'CLOSED';
};

type DashboardData = {
  summary: {
    totalTrades: number;
    totalPnl: number;
    winRate: number;
    maxDrawdown: number;
  };
  pnlTimeline: Array<{ date: string; pnl: number }>;
  pnlByMonth?: Array<{ month: string; pnl: number }>;
  equityCurve: Array<{ date: string; equity: number; drawdown: number }>;
  strategyPerformance: Array<{ name: string; trades: number; pnl: number }>;
  tradesByDay: Record<string, CalendarTrade[]>;
};

export function UserDashboardView({
  userId,
  showCharts = true,
}: {
  userId: string;
  showCharts?: boolean;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<{ date: string; symbol: string } | null>(null);
  const [candles, setCandles] = useState<JournalCandle[]>([]);
  const [trades, setTrades] = useState<JournalTrade[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/users/${userId}/dashboard`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('No tienes acceso a este usuario');
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  const title = useMemo(() => {
    if (!selected) return null;
    return `${selected.symbol} · ${selected.date}`;
  }, [selected]);

  const handleSymbolSelected = useCallback(async (payload: { date: string; symbol: string }) => {
    setSelected(payload);
    setCandles([]);
    setTrades([]);
    setChartError(null);
    setChartLoading(true);

    try {
      const [candlesRes, tradesRes] = await Promise.all([
        fetch(`/api/yahoo/intraday?symbol=${encodeURIComponent(payload.symbol)}&date=${payload.date}`),
        fetch(`/api/users/${userId}/dashboard/trades?symbol=${encodeURIComponent(payload.symbol)}&date=${payload.date}`),
      ]);

      const candlesJson = candlesRes.ok ? await candlesRes.json() : { candles: [] };
      const tradesJson = await tradesRes.json();

      if (!tradesRes.ok) {
        setChartError(tradesJson.error || 'Error cargando trades del día');
        return;
      }

      setCandles(candlesJson.candles ?? []);
      setTrades(tradesJson.trades ?? []);
    } catch (e) {
      setChartError(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setChartLoading(false);
    }
  }, [userId]);

  if (loading) return <p className="text-sm text-slate-400">Cargando dashboard…</p>;
  if (error) return <p className="text-sm text-rose-400">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="P&L Total" value={`$${data.summary.totalPnl.toFixed(2)}`} positive={data.summary.totalPnl >= 0} />
        <StatCard label="Win Rate" value={`${data.summary.winRate}%`} />
        <StatCard label="Trades" value={`${data.summary.totalTrades}`} />
        <StatCard label="Max Drawdown" value={`$${data.summary.maxDrawdown.toFixed(2)}`} positive={false} />
      </div>

      {/* Charts */}
      {showCharts && (
        <DashboardCharts
          pnlTimeline={data.pnlTimeline}
          strategyPerformance={data.strategyPerformance}
          equityCurve={data.equityCurve}
          pnlByMonth={data.pnlByMonth ?? []}
        />
      )}

      {/* Calendar */}
      <TradingCalendar
        days={data.pnlTimeline}
        tradesByDay={data.tradesByDay}
        onSymbolSelected={handleSymbolSelected}
      />

      {/* Intraday chart */}
      <section className="panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="panel-title">Gráfico intradía + ejecuciones</h3>
          {title && <span className="text-sm text-slate-400">{title}</span>}
        </div>

        {!selected && (
          <div className="flex h-[600px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60">
            <p className="text-sm text-slate-400">Selecciona un día y luego un ticker para ver el gráfico.</p>
          </div>
        )}

        {selected && chartLoading && (
          <div className="flex h-[600px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
              <p className="text-sm text-slate-400">Cargando datos...</p>
            </div>
          </div>
        )}

        {selected && !chartLoading && chartError && (
          <div className="flex h-[600px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60">
            <p className="text-sm font-medium text-rose-300">{chartError}</p>
          </div>
        )}

        {selected && !chartLoading && !chartError && trades.length > 0 && (
          <JournalChart candles={candles} trades={trades} ticker={selected.symbol} date={selected.date} />
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, positive = true }: { label: string; value: string; positive?: boolean }) {
  return (
    <article className="panel p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`metric-value mt-1 ${positive ? 'text-slate-100' : 'text-rose-300'}`}>{value}</p>
    </article>
  );
}
