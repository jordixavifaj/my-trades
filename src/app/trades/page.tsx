import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/prisma';

export default async function TradesPage() {
  let trades: any[] = [];
  try {
    trades = await prisma.trade.findMany({ include: { strategy: true }, orderBy: { openDate: 'desc' }, take: 100 });
  } catch {
    trades = [];
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-3xl font-bold">Trades</h1>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="min-w-full bg-slate-900 text-sm">
          <thead className="bg-slate-800 text-left text-slate-300">
            <tr>
              <th className="p-3">Símbolo</th><th className="p-3">Estado</th><th className="p-3">Estrategia</th><th className="p-3">P&L</th><th className="p-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.id} className="border-t border-slate-800">
                <td className="p-3 font-semibold">{trade.symbol}</td>
                <td className="p-3">{trade.status}</td>
                <td className="p-3">{trade.strategy?.name ?? '-'}</td>
                <td className={`p-3 ${(trade.pnl ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{((trade.pnl ?? 0) - trade.commission).toFixed(2)}</td>
                <td className="p-3">{new Date(trade.openDate).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
