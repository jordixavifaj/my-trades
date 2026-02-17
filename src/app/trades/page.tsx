import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/prisma';

export default async function TradesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = 20;
  const symbol = typeof searchParams.symbol === 'string' ? searchParams.symbol : '';
  const status = typeof searchParams.status === 'string' ? searchParams.status : '';
  const normalizedStatus: 'OPEN' | 'CLOSED' | undefined = status === 'OPEN' || status === 'CLOSED' ? status : undefined;

  const where = {
    symbol: symbol ? { contains: symbol, mode: 'insensitive' as const } : undefined,
    status: normalizedStatus,
  };

  let trades: any[] = [];
  let total = 0;
  try {
    [trades, total] = await Promise.all([
      prisma.trade.findMany({ where, include: { strategy: true }, orderBy: { openDate: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }) as any,
      prisma.trade.count({ where }),
    ]);
  } catch {
    trades = [];
    total = 0;
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AppShell>
      <h1 className="mb-4 text-3xl font-bold">Trades</h1>
      <form className="mb-4 flex gap-2" method="get">
        <input className="rounded bg-slate-800 p-2" name="symbol" placeholder="Símbolo" defaultValue={symbol} />
        <select className="rounded bg-slate-800 p-2" name="status" defaultValue={status}>
          <option value="">Todos</option>
          <option value="OPEN">OPEN</option>
          <option value="CLOSED">CLOSED</option>
        </select>
        <button className="rounded bg-cyan-700 px-3">Filtrar</button>
      </form>
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
      <div className="mt-4 flex items-center gap-2">
        <span>Página {page}/{pages}</span>
        {page > 1 && <Link className="rounded bg-slate-800 px-2 py-1" href={`/trades?page=${page - 1}&symbol=${symbol}&status=${status}`}>Anterior</Link>}
        {page < pages && <Link className="rounded bg-slate-800 px-2 py-1" href={`/trades?page=${page + 1}&symbol=${symbol}&status=${status}`}>Siguiente</Link>}
      </div>
    </AppShell>
  );
}
