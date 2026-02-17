import { AppShell } from '@/components/AppShell';
import { TradingCalendar } from '@/components/TradingCalendar';
import { getDashboardMetrics } from '@/lib/metrics';
import { DashboardCharts } from '@/components/DashboardCharts';

export default async function DashboardPage() {
  const data = await getDashboardMetrics();

  return (
    <AppShell>
      <h1 className="mb-4 text-3xl font-bold">Dashboard</h1>
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="P&L Total" value={`$${data.summary.totalPnl}`} />
        <StatCard label="Win Rate" value={`${data.summary.winRate}%`} />
        <StatCard label="Trades" value={`${data.summary.totalTrades}`} />
        <StatCard label="Abiertos" value={`${data.summary.openTrades}`} />
      </div>

      <DashboardCharts pnlTimeline={data.pnlTimeline} strategyPerformance={data.strategyPerformance} />

      <TradingCalendar days={data.pnlTimeline} />
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-cyan-300">{value}</p>
    </div>
  );
}
