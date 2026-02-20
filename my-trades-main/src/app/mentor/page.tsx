'use client';

import { AppShell } from '@/components/AppShell';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Student = {
  assignmentId: string | null;
  assignedAt: string;
  id: string;
  name: string | null;
  email: string;
  role: string;
  joinedAt: string;
  tradeCount: number;
  source: 'assignment' | 'community';
};

type EquityPoint = { date: string; equity: number };

function MiniEquityChart({ userId }: { userId: string }) {
  const [points, setPoints] = useState<EquityPoint[]>([]);

  useEffect(() => {
    fetch(`/api/users/${userId}/equity`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.curve) setPoints(d.curve); })
      .catch(() => {});
  }, [userId]);

  if (points.length < 2) return <div className="h-10 w-24 rounded bg-slate-800/50" />;

  const vals = points.map((p) => p.equity);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const range = Math.max(1, max - min);
  const last = vals[vals.length - 1];
  const color = last >= 0 ? '#34d399' : '#fb7185';

  const polyPoints = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 96;
      const y = 38 - ((p.equity - min) / range) * 36;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 96 40" className="h-10 w-24">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={polyPoints} />
    </svg>
  );
}

export default function MentorPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mentor/students', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStudents(data.students ?? []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? students.filter((s) => (s.name ?? '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    : students;

  return (
    <AppShell>
      <section className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Mis Alumnos</h1>
        <p className="mt-1 text-sm text-slate-400">
          Accede al calendario, trades y reports de tus alumnos para coaching.
        </p>
      </section>

      {!loading && students.length > 0 && (
        <div className="mb-4">
          <input
            placeholder="Buscar alumno…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/70 transition placeholder:text-slate-500 focus:ring-2"
          />
        </div>
      )}

      {loading && <p className="text-sm text-slate-400">Cargando…</p>}

      {!loading && students.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-8 text-center">
          <p className="text-slate-400">No tienes alumnos asignados.</p>
          <p className="mt-1 text-xs text-slate-500">Asigna alumnos manualmente o únete a una comunidad como mentor.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/mentor/${s.id}`}
              className="group flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-cyan-500/40 hover:bg-slate-900/60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-bold text-cyan-300">
                {(s.name ?? s.email).charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-100 group-hover:text-cyan-200">
                  {s.name ?? s.email}
                </p>
                <p className="truncate text-xs text-slate-400">{s.email}</p>
              </div>

              <div className="hidden items-center gap-4 sm:flex">
                <div className="text-right text-xs">
                  <p className="text-slate-500">Trades</p>
                  <p className="font-semibold text-slate-200">{s.tradeCount}</p>
                </div>
                <MiniEquityChart userId={s.id} />
                {s.source === 'community' && (
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500">comunidad</span>
                )}
              </div>

              <svg className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      )}

      {!loading && students.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-slate-400">No se encontraron alumnos con "{search}"</p>
      )}
    </AppShell>
  );
}
