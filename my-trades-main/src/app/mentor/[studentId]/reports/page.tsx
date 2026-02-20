'use client';

import { AppShell } from '@/components/AppShell';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type StrategyBreakdown = { strategy: string; trades: number; pnl: number };

type ReportData = {
  student: { id: string; name: string | null; email: string } | null;
  totalTrades: number;
  totalPnl: number;
  winners: number;
  losers: number;
  winRate: string;
  byStrategy: StrategyBreakdown[];
};

export default function MentorStudentReportsPage() {
  const params = useParams();
  const studentId = params.studentId as string;

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/mentor/students/${studentId}/reports`, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Error al cargar reports');
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/mentor" className="text-sm text-cyan-300 hover:text-cyan-200">← Mis Alumnos</Link>
        <span className="text-slate-600">/</span>
        <span className="text-sm text-slate-400">{data?.student?.name ?? data?.student?.email ?? 'Alumno'}</span>
      </div>

      <section className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Reports de {data?.student?.name ?? data?.student?.email ?? '…'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Resumen de rendimiento para coaching.
        </p>
      </section>

      {loading && <p className="text-sm text-slate-400">Cargando…</p>}
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {!loading && data && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Trades" value={String(data.totalTrades)} />
            <StatCard label="P&L Total" value={`$${data.totalPnl.toFixed(2)}`} positive={data.totalPnl >= 0} />
            <StatCard label="Win Rate" value={`${data.winRate}%`} />
            <StatCard label="W / L" value={`${data.winners} / ${data.losers}`} />
          </div>

          {data.byStrategy.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-lg font-semibold text-slate-100">Rendimiento por Estrategia</h2>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-left text-xs text-slate-400">
                      <th className="px-4 py-3">Estrategia</th>
                      <th className="px-4 py-3">Trades</th>
                      <th className="px-4 py-3 text-right">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byStrategy.map((s) => (
                      <tr key={s.strategy} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                        <td className="px-4 py-2.5 font-medium text-slate-200">{s.strategy}</td>
                        <td className="px-4 py-2.5 text-slate-300">{s.trades}</td>
                        <td className={`px-4 py-2.5 text-right font-medium ${s.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {s.pnl >= 0 ? '+' : ''}{s.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="flex gap-3">
            <Link
              href={`/mentor/${studentId}/trades`}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20"
            >
              Ver Trades Detallados
            </Link>
          </div>
        </>
      )}
    </AppShell>
  );
}

function StatCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${positive === true ? 'text-emerald-400' : positive === false ? 'text-rose-400' : 'text-slate-100'}`}>
        {value}
      </p>
    </div>
  );
}
