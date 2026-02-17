import { AppShell } from '@/components/AppShell';
import { TradingCalendar } from '@/components/TradingCalendar';
import { getDashboardMetrics } from '@/lib/metrics';
import { DashboardCharts } from '@/components/DashboardCharts';

export default async function DashboardPage() {
  const data = await getDashboardMetrics();

  return (
    <AppShell>
      <section className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Trading Performance Dashboard</h1>
          <p className="mt-1 text-slate-400">Panel ejecutivo con visión completa de resultados, consistencia y riesgo.</p>
        </div>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="P&L Total" value={`$${data.summary.totalPnl.toFixed(2)}`} positive={data.summary.totalPnl >= 0} />
        <StatCard label="Win Rate" value={`${data.summary.winRate}%`} />
        <StatCard label="Trades" value={`${data.summary.totalTrades}`} />
        <StatCard label="Abiertos" value={`${data.summary.openTrades}`} />
        <StatCard label="Max Drawdown" value={`$${data.summary.maxDrawdown.toFixed(2)}`} positive={false} />
      </div>

      <DashboardCharts pnlTimeline={data.pnlTimeline} strategyPerformance={data.strategyPerformance} equityCurve={data.equityCurve} />

      <TradingCalendar days={data.pnlTimeline} tradesByDay={data.tradesByDay} />
    </AppShell>
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
