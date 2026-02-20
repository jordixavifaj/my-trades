'use client';

import { AppShell } from '@/components/AppShell';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Trade = {
  id: string;
  symbol: string;
  side: string;
  openDate: string;
  closeDate: string | null;
  openPrice: number;
  closePrice: number | null;
  quantity: number;
  pnl: number | null;
  commission: number;
  status: string;
  strategy: { name: string } | null;
};

type StudentInfo = { id: string; name: string | null; email: string } | null;

export default function MentorStudentTradesPage() {
  const params = useParams();
  const studentId = params.studentId as string;

  const [trades, setTrades] = useState<Trade[]>([]);
  const [student, setStudent] = useState<StudentInfo>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState('');

  const fetchTrades = useCallback(async (p: number, sym: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: '20' });
      if (sym) params.set('symbol', sym);
      const res = await fetch(`/api/mentor/students/${studentId}/trades?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTrades(data.items ?? []);
      setStudent(data.student ?? null);
      setPages(data.pages ?? 0);
      setTotal(data.total ?? 0);
    } catch {
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchTrades(page, symbol);
  }, [page, symbol, fetchTrades]);

  const netPnl = (t: Trade) => ((t.pnl ?? 0) - t.commission).toFixed(2);

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/mentor" className="text-sm text-cyan-300 hover:text-cyan-200">← Mis Alumnos</Link>
        <span className="text-slate-600">/</span>
        <span className="text-sm text-slate-400">{student?.name ?? student?.email ?? 'Alumno'}</span>
      </div>

      <section className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Trades de {student?.name ?? student?.email ?? '…'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">{total} trades totales</p>
      </section>

      <div className="mb-4 flex items-center gap-3">
        <input
          placeholder="Filtrar por símbolo…"
          value={symbol}
          onChange={(e) => { setSymbol(e.target.value.toUpperCase()); setPage(1); }}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/70 transition focus:ring-2"
        />
        <Link
          href={`/mentor/${studentId}/reports`}
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
        >
          Ver Reports
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-400">Cargando…</p>}

      {!loading && trades.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-8 text-center">
          <p className="text-slate-400">Este alumno no tiene trades.</p>
        </div>
      )}

      {!loading && trades.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-left text-xs text-slate-400">
                <th className="px-4 py-3">Símbolo</th>
                <th className="px-4 py-3">Lado</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Salida</th>
                <th className="px-4 py-3 text-right">P&L</th>
                <th className="px-4 py-3">Estrategia</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => {
                const pnl = parseFloat(netPnl(t));
                return (
                  <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                    <td className="px-4 py-2.5 font-mono text-cyan-300">{t.symbol}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${t.side === 'BUY' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                        {t.side}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">{new Date(t.openDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-slate-300">{t.quantity}</td>
                    <td className="px-4 py-2.5 text-slate-300">${t.openPrice.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-slate-300">{t.closePrice ? `$${t.closePrice.toFixed(2)}` : '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pnl >= 0 ? '+' : ''}{netPnl(t)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">{t.strategy?.name ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40">
            Anterior
          </button>
          <span className="text-sm text-slate-400">Página {page} de {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40">
            Siguiente
          </button>
        </div>
      )}
    </AppShell>
  );
}
