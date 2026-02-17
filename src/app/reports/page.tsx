import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/prisma';

export default async function ReportsPage() {
  let byStrategy: Array<{ strategy: string; trades: number; pnl: number }> = [];
  let totalTrades = 0;

  try {
    const trades = await prisma.trade.findMany({ include: { strategy: true }, orderBy: { openDate: 'desc' } });
    totalTrades = trades.length;
    byStrategy = Object.values(
      trades.reduce<Record<string, { strategy: string; trades: number; pnl: number }>>((acc, trade) => {
        const key = trade.strategy?.name ?? 'Sin estrategia';
        if (!acc[key]) acc[key] = { strategy: key, trades: 0, pnl: 0 };
        acc[key].trades += 1;
        acc[key].pnl += (trade.pnl ?? 0) - trade.commission;
        return acc;
      }, {}),
    );
  } catch {
    byStrategy = [];
    totalTrades = 0;
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-3xl font-bold">Reports</h1>
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <p>Total de trades: {totalTrades}</p>
        <h3 className="mt-4 text-xl">Por estrategia</h3>
        <ul className="mt-2 space-y-2">
          {byStrategy.map((item) => (
            <li key={item.strategy} className="rounded bg-slate-800 p-2">
              {item.strategy}: {item.trades} trades / P&L {item.pnl.toFixed(2)}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <button className="rounded bg-cyan-600 px-3 py-2 text-sm">Exportar PDF</button>
          <button className="rounded bg-emerald-600 px-3 py-2 text-sm">Exportar Excel</button>
        </div>
      </div>
    </AppShell>
  );
}
