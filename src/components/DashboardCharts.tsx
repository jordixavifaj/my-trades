'use client';

export function DashboardCharts({
  pnlTimeline,
  strategyPerformance,
}: {
  pnlTimeline: Array<{ date: string; pnl: number }>;
  strategyPerformance: Array<{ name: string; trades: number; pnl: number }>;
}) {
  const maxPnl = Math.max(1, ...strategyPerformance.map((item) => Math.abs(item.pnl)));

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 text-lg font-semibold">Evolución P&L</h3>
        <div className="space-y-1">
          {pnlTimeline.slice(-10).map((point) => (
            <div key={point.date} className="flex items-center gap-2 text-xs">
              <span className="w-20 text-slate-400">{point.date.slice(5)}</span>
              <div className="h-2 flex-1 rounded bg-slate-800">
                <div
                  className={`h-2 rounded ${point.pnl >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                  style={{ width: `${Math.min(100, Math.abs(point.pnl))}%` }}
                />
              </div>
              <span className={point.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{point.pnl.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 text-lg font-semibold">Rendimiento por estrategia</h3>
        <div className="space-y-2">
          {strategyPerformance.map((item) => (
            <div key={item.name}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{item.name}</span>
                <span>{item.pnl.toFixed(2)}</span>
              </div>
              <div className="h-2 rounded bg-slate-800">
                <div className="h-2 rounded bg-cyan-400" style={{ width: `${(Math.abs(item.pnl) / maxPnl) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
